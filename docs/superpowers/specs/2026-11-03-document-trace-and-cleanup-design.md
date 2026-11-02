# Document page: trace attachments to their source + bulk cleanup

Date: 2026-11-03 · Repos: `micro-file`, `carmen-turborepo-backend`, `carmen-frontend`
Page: `/system-admin/document` (`routes/system-admin/document/`)

## Intent and why

The Document page lists every file stored for a BU, but only shows name / type / size /
modified date. An admin looking at it cannot tell **which document a file was attached to**,
so they cannot open that document, and they cannot **free storage** by removing old files of a
given kind without deleting them one at a time — and deleting today leaves a broken
"File Not Found" attachment behind in the comment that referenced it.

Two jobs, in the user's words:

1. "อยากรู้ว่าไฟล์นี้แนบมาจากเอกสารไหน จะได้เปิดไปดู" — trace a file to its source document and open it.
2. "ลบข้อมูลที่เก่ากว่า เกี่ยวกับบางประเภทของไฟล์ได้ เพื่อลดขนาด space" — delete old files
   filtered by **both** module (reference_type) **and** file kind (image/PDF/…), to reduce storage.

## Goals

- Each row shows where the file came from (module + document number) and the number links to that document.
- Each row shows who uploaded it and when (`created_at` / `created_by_id`).
- Search covers file name, document number and description.
- Filters: module (multi), file kind (multi), "uploaded before" date. Filters live in the URL like other list pages.
- Bulk delete: tick rows, or "select all matching filter" across all pages; confirm dialog shows file count + total size + "permanent, cannot be undone".
- Deleting a file (single or bulk) **removes its entry name from every comment/attachment list that
  referenced it and replaces it with a placeholder** "ไฟล์ถูกลบแล้ว · <date> โดย <user>" — not a clickable file.
- One-off cleanup converts attachments already broken by past deletes into the same placeholder.
- Summary bar (total size, per-module breakdown) refreshes after deletion.

## Non-goals

- No protected/locked files. User: "ไม่มี ลบได้ทุกไฟล์ถ้าเลือกเอง" — no retention rules, no blocking files of open documents.
- No undo / recycle bin — the point is to free real storage; MinIO objects are removed.
- No separate "cleanup wizard" (option B in the mockup was rejected; user chose in-table filter + select, option A).
- No scheduled/automatic cleanup.
- No editing of tags/metadata from this page.

## Anti-goals (would be a failure even if it "works")

- A comment still shows a file name that opens "File Not Found" after we deleted it.
- "Select all matching" silently deletes only the visible page — or more than the filter matched.
- Bulk delete leaves a half-state with no way to finish it (files gone but comments still pointing to them, with no retry).

## What exists today (verified in code)

- **micro-file** `tb_file_tag` (schema `prisma/schema.prisma`) already stores per file:
  `reference_type`, `reference_id`, `reference_no`, `description`, `tags` (jsonb), `created_at`,
  `created_by_id`, `deleted_at`. `searchFiles` (`src/files/files.service.ts` ~705) returns these
  and filters by `reference_type` / `reference_id` / `reference_no` / `tag_filters`; `search` matches
  `original_name` + `description` only. No date filter, no content-type filter, no multi-value filter, no bulk delete.
- `deleteFile` (~450) removes the MinIO object and soft-deletes the `tb_file_tag` row. It does **not**
  touch any `attachments` JSON in the tenant DB.
- **Gateway** `application/document-management/document-management.service.ts` proxies list/summary/delete;
  `listDocuments` passes reference filters through.
- **Tagging:** comment services call `tagAttachmentsByReference` (`backend-gateway/src/common/helpers/tag-attachments-by-reference.ts`)
  with `reference_type` + `reference_id` = the **parent entity id** (e.g. `purchase_request_id`), not the comment id.
  **`reference_no` is never populated by comment flows** — so document numbers are not in `tb_file_tag`.
- **Attachment copies:** ~60 tenant tables hold an `attachments Json` array whose elements carry
  `fileName`, `fileToken`, `contentType`, `size`, … — almost all `tb_*_comment` / `tb_*_detail_comment`,
  plus entity-owned ones: `tb_eco_label`, `tb_product_eco_label`, `tb_certificate`, `tb_vendor_certificate`,
  `tb_recipe_equipment`, `tb_ap_invoice`, `tb_ap_payment`, `tb_ar_invoice`, `tb_ar_receipt`.
- **FE:** `types/document.ts` `DocumentFile` declares only name/type/size/lastModified;
  `document-reference-labels.ts` maps 39 `reference_type` values → i18n module label;
  `lib/notification-helpers.tsx` already maps entity type → route path and id param (reusable for the link).
  Comment UI: `components/ui/comment-sheet.tsx` renders `CommentAttachment[]`.

## Design (decided)

### Placeholder (tombstone) shape
Instead of removing the element from `attachments`, rewrite it in place so ordering/history stays:
`{ deleted: true, deleted_at: ISO, deleted_by_id: uuid, contentType? }` — **`fileName` and `fileToken` removed**.
FE comment sheet (and every other renderer of attachment arrays) shows a non-clickable chip
"🗑 ไฟล์ถูกลบแล้ว · <date> โดย <name>" for elements with `deleted: true`.

### Delete flow (single and bulk share one path)
1. Gateway receives either a list of `fileToken`s or a **filter** (same filter params as the list; bulk "select all matching" sends the filter, never thousands of tokens).
2. Resolve the filter to tokens in micro-file (server-side, same WHERE as the list → count shown in confirm equals what gets deleted).
3. **Tombstone first:** micro-business rewrites matching elements in the tenant tables (pick tables by `reference_type`; within a table match by `attachments @> '[{"fileToken": "<t>"}]'`). Files with null/unknown `reference_type` → scan all attachment tables. (Amended: every token is scanned in all tables; see Amendments K.)
4. **Then delete storage:** micro-file removes MinIO objects + soft-deletes `tb_file_tag` rows.
5. Response reports `{ deleted, failed: [{fileToken, reason}] }`.

Ordering is our call (see below): tombstone-then-delete means a failure leaves a file that still uses space
but is marked deleted — retry finishes it; never a visible broken link.

### Document number + link
Rows show `<module label> · <doc no>` with the number linking to the document. Since `reference_no` is not stored,
the gateway list endpoint **resolves numbers by `(reference_type, reference_id)` in batch** for the page being returned
(one query per distinct type). Link path from the entity→route map (extend `notification-helpers` mapping or extract it to a shared place).

### Search by document number
`search` must also match document number. Because numbers aren't in `tb_file_tag`, backfill
`reference_no` (one-off script from tenant tables) **and** populate it going forward in `tagAttachmentsByReference`.
Then micro-file `search` adds `reference_no ILIKE`.

### New list filters (micro-file `searchFiles` + gateway passthrough)
- `reference_type` → accept multiple values (`IN`)
- `content_kind` → multiple of `image|pdf|spreadsheet|doc|archive|text|code|other`, mapped to `content_type` patterns
  server-side using the same buckets as FE `getFileTypeInfo` (`use-document-table.tsx`)
- `created_before` (date)
- `reference_type IS NULL` must be selectable ("อัปโหลดโดยตรง")

### FE
- `DocumentFile` gains `referenceType`, `referenceId`, `referenceNo`, `description`, `createdAt`, `createdBy` (name) — match whatever casing the API returns.
- Columns: add **แนบจาก**, **ผู้อัปโหลด**; date column uses `created_at`.
- Filter bar: module multi-select, file-kind multi-select, uploaded-before date; URL-backed.
- Selection bar: "เลือกแล้ว N ไฟล์ · X MB" + "เลือกทั้งหมดที่ตรงตัวกรอง (N · X)" link + delete button.
- Confirm dialog: count, total size, permanent warning. After success invalidate `QUERY_KEYS.DOCUMENTS` (summary shares the prefix already).
- Comment sheet renders tombstones.
- Mockup: `.superpowers/brainstorm/22934-1793640269/content/document-layout.html` (option A + placeholder).

### One-off cleanup of existing broken links
Script (backend, per BU): for every `attachments` element whose `fileToken` has `deleted_at` set in `tb_file_tag`
(or no MinIO object), rewrite it to the tombstone shape. Same script can backfill `reference_no`.

## Decided by me (check these)

- **Tombstone kept in place** rather than splicing the element out — so the comment visibly says a file was there.
- **Tombstone-then-delete ordering** across the two DBs (micro-file DB and tenant DB are separate; no real transaction possible).
- **Unknown-origin files** ("ไม่ทราบที่มา"): shown and deletable; tombstoning scans all attachment tables.
- **Permission:** same gate as today's single delete on this page (`useDeleteGate`); no new permission key.
- Bulk delete by filter is resolved server-side so the confirm count = deleted count.
- Placeholder shows deleted date + deleter name.

## Settled after builder review (my calls)

- **Tombstone must survive every save path.** Comment update/edit DTOs and any entity save that
  round-trips `attachments` must accept `{deleted:true,…}` elements and must **preserve tombstones
  server-side** (server merges; never lets a client resend the old `fileName`/`fileToken` element or
  drop the tombstone). Builder audits all writers of `attachments` (gateway comment services, micro-business
  update logic, mobile) before implementing; this is a required task, not optional.
- **reference_type → table map:** hand-built map in backend (reference_type → list of `{table, parentIdColumn}`
  incl. detail-comment and entity-owned tables) + a test that asserts every tenant model with an `attachments`
  column appears in the map. Tombstoning uses the map; only null/unknown types fall back to scanning all tables. (Amended: see Amendments K, H+P.)
- **Scale:** process bulk deletes in chunks (e.g. 100 tokens) server-side; full-scan fallback is chunked too.
  Adding GIN indexes on `attachments` is not required up front — builder measures on dev data first.
- **Entities without a document number** (vendor, recipe, certificate, eco label, unit, …): show the entity's
  code or name instead; per-type "display column" lives in the same map. Parent record deleted →
  show "เอกสารถูกลบแล้ว" with no link.
- **Partial failure / retry:** both steps are idempotent. A file whose storage delete failed keeps its
  `tb_file_tag` row (not soft-deleted), so it stays in the list and the admin just deletes it again;
  the failure toast lists the failed file names. No new "pending" state.
- **One-off cleanup "broken" definition:** `fileToken` whose `tb_file_tag` row has `deleted_at` set, **or**
  has no `tb_file_tag` row and no MinIO object. Runs as a backend script per BU (follow the existing
  `db:seed.*` / script pattern), re-runnable, dry-run flag that prints counts first.

## Left to the builder

- Detail-level comments (`*_detail_comment`): confirm what `reference_id` they're tagged with. If it's the
  detail line id, the link must resolve to the header document id.
- Exact RPC contract names, batch size / chunking for very large bulk deletes (likely chunk + loop server-side).
- Whether the doc-number resolve lives in gateway or micro-business.
- Which other FE renderers of attachment arrays (certificate, eco label, recipe equipment, AP/AR) need the tombstone UI.
- i18n keys for new labels (follow `systemAdmin.document` namespace).

## Deploy notes

- New gateway endpoints (bulk delete, any new list params) need the **app allowlist** before FE ships — a missing api_name logs users out (401).
- Order: micro-file → backend (micro-business + gateway) → allowlist → run cleanup/backfill script per env → FE.

## Amendments during implementation (2026-11-03)

- **J:** the tombstone stores `token_hash` (sha256 of the token), DB-only. The gateway strips it from responses. A resend whose hash matches is dropped.
- **K:** tombstone scans all attachment tables for every token, regardless of `reference_type`.
- **M:** the per-request cap is 1,000 tokens.
- **H+P:** files referenced by news, `recipe_preparation_step`, or any plain `*file_token` column (product/recipe images, recipe category/cuisine/equipment images, GRN signature) are never deleted from the Document page; they come back as `UNSUPPORTED_REFERENCE_TYPE`.
- **G:** `files.delete-many` requires `bu_code`.
- The single DELETE and the bulk delete both require `system_admin.document:delete`.
- The Document list has no column sort.
