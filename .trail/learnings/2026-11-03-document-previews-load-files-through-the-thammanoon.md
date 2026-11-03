---
title: "Document previews load files through the gateway download endpoint as blobs, not presigned URLs"
author: Thammanoon
date: 2026-11-03
branch: feature/document-icon-preview-views
cost: { minutes: 9, tokens: 112218 }
id: l-26cbb2f9
scope: repo
status: active
src: agent
touches:
  - components/share/display-mode-toggle.tsx
  - routes/system-admin/document/use-document-blob.ts
  - routes/system-admin/document/document-reference.tsx
  - routes/system-admin/document/document-thumb.tsx
  - routes/system-admin/document/document-icon-grid.tsx
  - routes/system-admin/document/document-preview-view.tsx
  - vercel.json
---

## Decided
`routes/system-admin/document/use-document-blob.ts` fetches `GET /api/:bu/documents/:token/download` (api_name `documents.download`) and the icon/preview views render it through an object URL. Production CSP is `frame-src 'self' blob:` (vercel.json / nginx / GCS / CloudFront), so an iframe pointed at a presigned storage URL would be blocked for PDFs. A blob from the gateway works for images, PDF and text on every env.

## Tried and ruled out
Presigned URLs (`GET :token/presigned-url`). They point straight at the storage host, which may be an internal host the browser can't reach in local dev, and the CSP blocks them in iframes.

## Watch out
- Envs that are not `allow_all` need `documents.download` in the app allowlist before this FE ships. A missing api_name returns 401, which clears the token and logs the user out.
- Not verified: whether Chrome's PDF viewer works inside a blob iframe under `object-src 'none'` in production (the dev server sends no CSP).
- Some registry rows have no object left in storage (download 404). The views show "Couldn't load this file." for them.
- The typecheck failure on the way here was `DisplayModeToggle`'s generic `M` indexing a const map: assign it to `const key: DisplayMode = mode` first.
