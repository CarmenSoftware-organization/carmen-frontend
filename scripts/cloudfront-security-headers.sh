#!/usr/bin/env bash
# ติดตั้ง security headers ให้ CloudFront distribution (สร้าง response-headers-policy
# แล้วผูกเข้ากับ default cache behavior)
#
# Usage: scripts/cloudfront-security-headers.sh <distribution-id> <config-file>
#   <config-file> คือ public/config.<env>.json ของ environment นั้น — ใช้อ่าน
#   BACKEND_URL/WS_URL มาใส่ connect-src ของ CSP (S3+CloudFront ยิงข้าม origin เสมอ)
#
# Idempotent — รันซ้ำได้ ทั้งตอนสร้างครั้งแรกและตอนแก้ policy (เช่น backend ย้าย origin)
set -euo pipefail

DIST_ID="${1:?Usage: cloudfront-security-headers.sh <distribution-id> <config-file>}"
CONFIG_FILE="${2:?Usage: cloudfront-security-headers.sh <distribution-id> <config-file>}"

log() { echo "[cf-security-headers] $*"; }

command -v aws >/dev/null 2>&1 || { log "aws cli not found"; exit 1; }
[ -f "${CONFIG_FILE}" ] || { log "config file not found: ${CONFIG_FILE}"; exit 1; }

read_key() { bun -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(c[process.argv[2]]??""))' "${CONFIG_FILE}" "$1"; }
BACKEND_URL_VAL="$(read_key BACKEND_URL)"
WS_URL_VAL="$(read_key WS_URL)"
[ -n "${BACKEND_URL_VAL}" ] || { log "BACKEND_URL missing/empty in ${CONFIG_FILE}"; exit 1; }

# hash ของ inline script ใน index.html (font-scale ก่อน paint แรก) —
# lib/__tests__/security-headers.test.ts ฟ้องเมื่อสคริปต์นั้นเปลี่ยนแล้วลืมแก้ที่นี่
SCRIPT_HASH="sha256-0k0itUkfTj7bMCkHluURmLkIOOj6e8nXNyXCiHJ+vS8="
CONNECT_SRC="'self' ${BACKEND_URL_VAL}"
[ -z "${WS_URL_VAL}" ] || CONNECT_SRC="${CONNECT_SRC} ${WS_URL_VAL}"
CSP="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' '${SCRIPT_HASH}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${CONNECT_SRC}; worker-src 'self' blob:; frame-src 'self' blob: https://www.youtube-nocookie.com"

POLICY_NAME="${DIST_ID}-security-headers"
WORK="$(mktemp -d)"
trap 'rm -rf "${WORK}"' EXIT

# includeSubDomains ปิดไว้โดยตั้งใจ — โดเมนลูกที่ยังเป็น http จะเข้าไม่ได้ทันที
CSP="${CSP}" POLICY_NAME="${POLICY_NAME}" bun -e '
const cfg = {
  Name: process.env.POLICY_NAME,
  Comment: "CARMEN BLUE SPA security headers",
  SecurityHeadersConfig: {
    ContentSecurityPolicy: { ContentSecurityPolicy: process.env.CSP, Override: true },
    ContentTypeOptions: { Override: true },
    FrameOptions: { FrameOption: "DENY", Override: true },
    ReferrerPolicy: { ReferrerPolicy: "strict-origin-when-cross-origin", Override: true },
    StrictTransportSecurity: { AccessControlMaxAgeSec: 31536000, IncludeSubdomains: false, Preload: false, Override: true },
  },
  CustomHeadersConfig: {
    Quantity: 1,
    Items: [{ Header: "Permissions-Policy", Value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()", Override: true }],
  },
};
require("fs").writeFileSync(process.argv[1], JSON.stringify(cfg));
' "${WORK}/policy.json"

POLICY_ID="$(aws cloudfront list-response-headers-policies --type custom \
  --query "ResponseHeadersPolicyList.Items[?ResponseHeadersPolicy.ResponseHeadersPolicyConfig.Name=='${POLICY_NAME}'].ResponseHeadersPolicy.Id | [0]" \
  --output text)"

if [ "${POLICY_ID}" = "None" ] || [ -z "${POLICY_ID}" ]; then
  POLICY_ID="$(aws cloudfront create-response-headers-policy \
    --response-headers-policy-config "file://${WORK}/policy.json" \
    --query "ResponseHeadersPolicy.Id" --output text)"
  log "created policy ${POLICY_NAME} (${POLICY_ID})"
else
  ETAG="$(aws cloudfront get-response-headers-policy --id "${POLICY_ID}" --query ETag --output text)"
  aws cloudfront update-response-headers-policy --id "${POLICY_ID}" --if-match "${ETAG}" \
    --response-headers-policy-config "file://${WORK}/policy.json" >/dev/null
  log "updated policy ${POLICY_NAME} (${POLICY_ID})"
fi

# ---- ผูกเข้ากับ default cache behavior ----
aws cloudfront get-distribution-config --id "${DIST_ID}" > "${WORK}/dist.json"
DIST_ETAG="$(bun -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).ETag)' "${WORK}/dist.json")"

ALREADY="$(POLICY_ID="${POLICY_ID}" bun -e '
const d = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).DistributionConfig;
const current = d.DefaultCacheBehavior.ResponseHeadersPolicyId ?? "";
if (current === process.env.POLICY_ID) { process.stdout.write("yes"); process.exit(0); }
d.DefaultCacheBehavior.ResponseHeadersPolicyId = process.env.POLICY_ID;
require("fs").writeFileSync(process.argv[2], JSON.stringify(d));
process.stdout.write("no");
' "${WORK}/dist.json" "${WORK}/new-dist-config.json")"

if [ "${ALREADY}" = "yes" ]; then
  log "distribution ${DIST_ID} already uses this policy — nothing to do"
else
  aws cloudfront update-distribution --id "${DIST_ID}" --if-match "${DIST_ETAG}" \
    --distribution-config "file://${WORK}/new-dist-config.json" >/dev/null
  log "attached policy to ${DIST_ID} (ใช้เวลา ~5-10 นาทีกว่าจะ deploy ทั่ว edge)"
fi
