#!/bin/sh
# สร้าง /etc/nginx/security-headers.conf ตอน container start
# (รันอัตโนมัติโดย /docker-entrypoint.d/ ของ nginx image — ก่อน nginx start)
#
# ทำไมต้อง render ด้วยสคริปต์แทนที่จะเป็นไฟล์นิ่ง ๆ: `connect-src` ต้องมี WS_URL
# ซึ่งเป็น origin ข้ามโดเมนและ **optional** — envsubst ของ nginx image แทนค่าให้เฉพาะ
# ตัวแปรที่ถูก define ไว้จริง ถ้า WS_URL ไม่ได้ตั้ง `${WS_URL}` จะค้างเป็นข้อความดิบ
# อยู่ใน CSP แล้วพังทั้ง policy โดยไม่มีใครเห็น
#
# BACKEND_URL ไม่อยู่ใน connect-src เพราะ browser ยิง same-origin เสมอในโหมด Docker
# (config.json ตั้ง BACKEND_URL:"" แล้ว nginx proxy /api/* ให้เอง — ดู 40-render-config-json.sh)
set -eu

OUT="${OUT:-/etc/nginx/security-headers.conf}"

# hash ของ inline script ใน index.html (font-scale ก่อน paint แรก)
# ถ้าแก้สคริปต์นั้นต้องคำนวณใหม่ — lib/__tests__/security-headers.test.ts ฟ้องให้
SCRIPT_HASH="sha256-0k0itUkfTj7bMCkHluURmLkIOOj6e8nXNyXCiHJ+vS8="

CONNECT_SRC="'self'"
[ -z "${WS_URL:-}" ] || CONNECT_SRC="${CONNECT_SRC} ${WS_URL}"

CSP="default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' '${SCRIPT_HASH}'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${CONNECT_SRC}; worker-src 'self' blob:; frame-src 'self' blob: https://www.youtube-nocookie.com"

cat > "$OUT" <<HEADERS
# GENERATED โดย /docker-entrypoint.d/30-render-security-headers.sh — อย่าแก้ในไฟล์นี้
add_header Content-Security-Policy "${CSP}" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "DENY" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), payment=(), usb=()" always;
# includeSubDomains ไม่ใส่โดยตั้งใจ — โดเมนลูกที่ยังเป็น http อยู่จะเข้าไม่ได้ทันที
# เปิดเพิ่มเองเมื่อยืนยันแล้วว่าทุก subdomain เป็น https
add_header Strict-Transport-Security "max-age=31536000" always;
HEADERS

echo "[security-headers] rendered $OUT (connect-src ${CONNECT_SRC})"
