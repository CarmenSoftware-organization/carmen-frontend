#!/usr/bin/env bash
# One-shot setup: GCS bucket + Cloud CDN + HTTPS LB + Google-managed cert สำหรับ SPA นี้
# Usage:
#   scripts/setup-gcs-cdn.sh <bucket> <config-file> [domain]   provision + first deploy
#   scripts/setup-gcs-cdn.sh <bucket> --teardown               ลบ LB/CDN (เก็บ bucket ไว้)
# ไม่ให้ [domain] มา = ใช้ <LB-IP>.sslip.io อัตโนมัติ (managed cert ออกได้โดยไม่ต้องมี DNS)
# ENV: GCS_LOCATION (default asia-southeast1) — ใช้ตอนสร้าง bucket ครั้งแรกเท่านั้น
# Spec: docs/superpowers/specs/2026-07-15-gcp-cdn-setup-script-design.md
set -euo pipefail

usage() {
  cat >&2 <<'EOF'
Usage:
  setup-gcs-cdn.sh <bucket> <config-file> [domain]   provision + first deploy
  setup-gcs-cdn.sh <bucket> --teardown               delete LB/CDN resources (keeps bucket)
EOF
  exit 1
}

log() { echo "[setup-gcs-cdn] $*"; }

BUCKET="${1:-}"; [ -n "${BUCKET}" ] || usage
MODE=setup
CONFIG_FILE=""
DOMAIN=""
case "${2:-}" in
  --teardown) MODE=teardown ;;
  "") usage ;;
  *) CONFIG_FILE="$2"; DOMAIN="${3:-}" ;;
esac
CUSTOM_DOMAIN=false; [ -z "${DOMAIN}" ] || CUSTOM_DOMAIN=true

LOCATION="${GCS_LOCATION:-asia-southeast1}"
IP_NAME="${BUCKET}-ip"
CERT_NAME="${BUCKET}-cert"
BACKEND_NAME="${BUCKET}-backend"
URL_MAP="${BUCKET}-url-map"
HTTPS_PROXY="${BUCKET}-https-proxy"
HTTPS_RULE="${BUCKET}-https-rule"
REDIRECT_MAP="${BUCKET}-http-redirect-map"
HTTP_PROXY="${BUCKET}-http-proxy"
HTTP_RULE="${BUCKET}-http-rule"

# ---- preflight ----
command -v gcloud >/dev/null 2>&1 \
  || { log "gcloud not found — install: brew install --cask google-cloud-sdk"; exit 1; }
ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null || true)"
[ -n "${ACTIVE_ACCOUNT}" ] || { log "no active gcloud account — run: gcloud auth login"; exit 1; }
PROJECT="$(gcloud config get-value project 2>/dev/null || true)"
{ [ -n "${PROJECT}" ] && [ "${PROJECT}" != "(unset)" ]; } \
  || { log "no project set — run: gcloud config set project <project-id>"; exit 1; }
log "project: ${PROJECT} (account: ${ACTIVE_ACCOUNT})"

if [ "${MODE}" = "setup" ]; then
  [ -f "${CONFIG_FILE}" ] || { log "config file not found: ${CONFIG_FILE}"; exit 1; }
  BACKEND_URL_VAL="$(bun -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(c.BACKEND_URL??""))' "${CONFIG_FILE}")"
  [ -n "${BACKEND_URL_VAL}" ] || { log "BACKEND_URL missing/empty in ${CONFIG_FILE}"; exit 1; }
  WS_URL_VAL="$(bun -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));process.stdout.write(String(c.WS_URL??""))' "${CONFIG_FILE}")"

  # ---- security headers ของ CDN ----
  # hash คือ inline script ใน index.html (font-scale ก่อน paint แรก) —
  # lib/__tests__/security-headers.test.ts ฟ้องเมื่อสคริปต์นั้นเปลี่ยนแล้วลืมแก้ที่นี่
  SCRIPT_HASH="sha256-0k0itUkfTj7bMCkHluURmLkIOOj6e8nXNyXCiHJ+vS8="
  CONNECT_SRC="'self' ${BACKEND_URL_VAL}"
  [ -z "${WS_URL_VAL}" ] || CONNECT_SRC="${CONNECT_SRC} ${WS_URL_VAL}"
  CSP="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' '${SCRIPT_HASH}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${CONNECT_SRC}; worker-src 'self' blob:; frame-src 'self' blob: https://www.youtube-nocookie.com"
  SEC_HEADERS=(
    --custom-response-header="Content-Security-Policy: ${CSP}"
    --custom-response-header="X-Content-Type-Options: nosniff"
    --custom-response-header="X-Frame-Options: DENY"
    --custom-response-header="Referrer-Policy: strict-origin-when-cross-origin"
    --custom-response-header="Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()"
    # includeSubDomains ไม่ใส่โดยตั้งใจ — โดเมนลูกที่ยังเป็น http จะเข้าไม่ได้ทันที
    --custom-response-header="Strict-Transport-Security: max-age=31536000"
  )
fi

# ---- teardown: ลบย้อนลำดับ ไม่แตะ GCS bucket ----
if [ "${MODE}" = "teardown" ]; then
  echo "Will delete (project ${PROJECT}):"
  echo "  ${HTTP_RULE} ${HTTPS_RULE} ${HTTP_PROXY} ${HTTPS_PROXY}"
  echo "  ${REDIRECT_MAP} ${URL_MAP} ${CERT_NAME} ${BACKEND_NAME} ${IP_NAME}"
  echo "GCS bucket gs://${BUCKET} will be KEPT."
  read -r -p "Proceed? [y/N] " ANSWER
  [ "${ANSWER}" = "y" ] || { log "aborted"; exit 0; }
  del() { # del <kind> <name> [flags...]
    local kind="$1" name="$2"; shift 2
    if gcloud compute "${kind}" describe "${name}" "$@" >/dev/null 2>&1; then
      gcloud compute "${kind}" delete "${name}" "$@" --quiet
      log "deleted ${kind} ${name}"
    else
      log "${kind} ${name} absent, skip"
    fi
  }
  del forwarding-rules "${HTTP_RULE}" --global
  del forwarding-rules "${HTTPS_RULE}" --global
  del target-http-proxies "${HTTP_PROXY}"
  del target-https-proxies "${HTTPS_PROXY}"
  del url-maps "${REDIRECT_MAP}"
  del url-maps "${URL_MAP}"
  del ssl-certificates "${CERT_NAME}"
  del backend-buckets "${BACKEND_NAME}"
  del addresses "${IP_NAME}" --global
  log "done. bucket kept — delete manually: gcloud storage rm -r gs://${BUCKET}"
  exit 0
fi

# ---- 1. GCS bucket ----
if gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  log "bucket gs://${BUCKET} exists, skip create"
else
  gcloud storage buckets create "gs://${BUCKET}" \
    --location="${LOCATION}" --uniform-bucket-level-access
  log "created bucket gs://${BUCKET} (${LOCATION})"
fi
# SPA fallback: unknown path เสิร์ฟ index.html (status 404 แต่ SPA boot ได้ — ดู docs/deploy.md)
gcloud storage buckets update "gs://${BUCKET}" \
  --web-main-page-suffix=index.html --web-error-page=index.html
# backend bucket เสิร์ฟ object private ไม่ได้ — ต้อง public read (แอป auth-gated อยู่แล้ว)
gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member=allUsers --role=roles/storage.objectViewer >/dev/null
log "bucket SPA fallback + public read ready"

# ---- 2. global static IP (จองก่อน เพื่อ derive sslip.io domain) ----
if gcloud compute addresses describe "${IP_NAME}" --global >/dev/null 2>&1; then
  log "address ${IP_NAME} exists, skip"
else
  gcloud compute addresses create "${IP_NAME}" --global --ip-version=IPV4
fi
LB_IP="$(gcloud compute addresses describe "${IP_NAME}" --global --format='value(address)')"
log "LB IP: ${LB_IP}"

# ---- 3. domain ----
[ -n "${DOMAIN}" ] || DOMAIN="${LB_IP//./-}.sslip.io"
log "domain: ${DOMAIN}"

# ---- 4. managed SSL cert ----
if gcloud compute ssl-certificates describe "${CERT_NAME}" >/dev/null 2>&1; then
  CERT_DOMAINS="$(gcloud compute ssl-certificates describe "${CERT_NAME}" --format='value(managed.domains)')"
  CERT_COVERS=false
  IFS=';,' read -ra CERT_DOMAIN_LIST <<<"${CERT_DOMAINS}"
  for d in "${CERT_DOMAIN_LIST[@]}"; do
    [[ "${d}" == "${DOMAIN}" ]] && CERT_COVERS=true
  done
  if [ "${CERT_COVERS}" = true ]; then
    log "cert ${CERT_NAME} exists for ${DOMAIN}, skip"
  else
    log "WARNING: cert ${CERT_NAME} covers '${CERT_DOMAINS}', not '${DOMAIN}'"
    log "  to switch domain: --teardown then re-run setup"
    exit 1
  fi
else
  gcloud compute ssl-certificates create "${CERT_NAME}" --domains="${DOMAIN}"
  log "created managed cert for ${DOMAIN}"
fi

# ---- 5. backend bucket + Cloud CDN ----
# USE_ORIGIN_HEADERS: CDN เคารพ cache-control ที่ deploy-gcs.sh ตั้ง (index.html no-cache ต้องรอด)
# security headers ตั้งที่ backend bucket — CDN ใส่ให้ทุก response (update ทุกครั้งที่
# รันซ้ำ เพื่อให้ distribution เก่าที่สร้างก่อนมี header ชุดนี้ได้ของใหม่ด้วย)
if gcloud compute backend-buckets describe "${BACKEND_NAME}" >/dev/null 2>&1; then
  gcloud compute backend-buckets update "${BACKEND_NAME}" "${SEC_HEADERS[@]}"
  log "backend bucket ${BACKEND_NAME} exists — security headers refreshed"
else
  gcloud compute backend-buckets create "${BACKEND_NAME}" \
    --gcs-bucket-name="${BUCKET}" --enable-cdn --cache-mode=USE_ORIGIN_HEADERS \
    "${SEC_HEADERS[@]}"
fi

# ---- 6. URL map ----
if gcloud compute url-maps describe "${URL_MAP}" >/dev/null 2>&1; then
  log "url map ${URL_MAP} exists, skip"
else
  gcloud compute url-maps create "${URL_MAP}" --default-backend-bucket="${BACKEND_NAME}"
fi

# ---- 7. HTTPS proxy + forwarding rule ----
if gcloud compute target-https-proxies describe "${HTTPS_PROXY}" >/dev/null 2>&1; then
  log "https proxy ${HTTPS_PROXY} exists, skip"
else
  gcloud compute target-https-proxies create "${HTTPS_PROXY}" \
    --url-map="${URL_MAP}" --ssl-certificates="${CERT_NAME}"
fi
if gcloud compute forwarding-rules describe "${HTTPS_RULE}" --global >/dev/null 2>&1; then
  log "forwarding rule ${HTTPS_RULE} exists, skip"
else
  gcloud compute forwarding-rules create "${HTTPS_RULE}" --global \
    --address="${IP_NAME}" --target-https-proxy="${HTTPS_PROXY}" --ports=443
fi

# ---- 8. HTTP→HTTPS redirect ----
if gcloud compute url-maps describe "${REDIRECT_MAP}" >/dev/null 2>&1; then
  log "redirect map ${REDIRECT_MAP} exists, skip"
else
  gcloud compute url-maps import "${REDIRECT_MAP}" --global --quiet <<EOF
name: ${REDIRECT_MAP}
defaultUrlRedirect:
  httpsRedirect: true
  redirectResponseCode: MOVED_PERMANENTLY_DEFAULT
EOF
fi
if gcloud compute target-http-proxies describe "${HTTP_PROXY}" >/dev/null 2>&1; then
  log "http proxy ${HTTP_PROXY} exists, skip"
else
  gcloud compute target-http-proxies create "${HTTP_PROXY}" --url-map="${REDIRECT_MAP}"
fi
if gcloud compute forwarding-rules describe "${HTTP_RULE}" --global >/dev/null 2>&1; then
  log "forwarding rule ${HTTP_RULE} exists, skip"
else
  gcloud compute forwarding-rules create "${HTTP_RULE}" --global \
    --address="${IP_NAME}" --target-http-proxy="${HTTP_PROXY}" --ports=80
fi

# ---- config.json — อัปโหลดครั้งแรกเท่านั้น ห้ามทับของ environment (ดู docs/deploy.md) ----
if gcloud storage objects describe "gs://${BUCKET}/config.json" >/dev/null 2>&1; then
  log "config.json already on bucket — kept as-is"
else
  gcloud storage cp "${CONFIG_FILE}" "gs://${BUCKET}/config.json" --cache-control="no-cache"
  log "uploaded ${CONFIG_FILE} as gs://${BUCKET}/config.json"
fi

# ---- first deploy (build + rsync + cache headers + CDN invalidation) ----
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
"${SCRIPT_DIR}/deploy-gcs.sh" "${BUCKET}" "${URL_MAP}"

# ---- รอ cert ACTIVE (sslip.io resolve ทันที — รอบแรก ~15-40 นาที) ----
log "waiting for managed cert to go ACTIVE..."
DEADLINE=$((SECONDS + 2400))
CERT_STATUS=""
while :; do
  CERT_STATUS="$(gcloud compute ssl-certificates describe "${CERT_NAME}" --format='value(managed.status)' 2>/dev/null || true)"
  [ "${CERT_STATUS}" = "ACTIVE" ] && break
  if [ "${SECONDS}" -ge "${DEADLINE}" ]; then
    log "cert still ${CERT_STATUS:-unknown} after 40 min — not fatal; site serves once ACTIVE."
    log "check: gcloud compute ssl-certificates describe ${CERT_NAME} --format='value(managed.status)'"
    break
  fi
  log "cert status: ${CERT_STATUS:-PROVISIONING} — recheck in 30s"
  sleep 30
done

# ---- summary ----
echo
log "=================================================="
log "site:         https://${DOMAIN}"
log "LB IP:        ${LB_IP}"
log "cert status:  ${CERT_STATUS:-unknown}"
log "next deploys: scripts/deploy-gcs.sh ${BUCKET} ${URL_MAP}"
if [ "${CUSTOM_DOMAIN}" = true ]; then
  log "DNS: point an A record for ${DOMAIN} to ${LB_IP} — cert activates after DNS resolves"
fi
log "REQUIRED (backend team): enable CORS for origin https://${DOMAIN}"
log "  methods GET/POST/PUT/PATCH/DELETE; headers Authorization, Content-Type, x-app-id"
log "=================================================="
