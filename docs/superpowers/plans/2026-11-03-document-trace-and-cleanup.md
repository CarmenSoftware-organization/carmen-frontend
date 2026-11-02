# Document trace + bulk cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On `/system-admin/document`, show which document each file came from (with a link), who uploaded it, filter by module / file kind / age, and bulk-delete files — replacing every attachment copy that referenced a deleted file with a "ไฟล์ถูกลบแล้ว" tombstone.

**Architecture:** micro-file gains richer list filters plus two commands, `files.find-tokens` and `files.delete-many`. micro-business gains a `reference_type → tables` map and two commands: `document-attachments.tombstone` rewrites attachment JSON in place, and `document-attachments.resolve-references` returns doc number + parent id. The gateway runs the pipeline resolve → tombstone (chunks of 100) → delete storage. The FE adds columns, filters, a selection bar, a confirm dialog and tombstone rendering.

**Tech Stack:** NestJS TCP microservices + Prisma (tenant DB and the separate `CARMEN_FILE` schema), `@repo/file-contract` (published npm package), `@repo/rpc-contract` (generated), React 19 + TanStack Query/Table, use-intl.

**Spec:** `docs/superpowers/specs/2026-11-03-document-trace-and-cleanup-design.md` (read it first, including "Settled after builder review").

**Repos (siblings under `~/GitHub/carmensoftware-organize/`):** `carmen-turborepo-backend` (BE), `micro-file` (MF), `carmen-frontend` (FE). One feature branch per repo: `feature/document-trace-cleanup`.

## Global Constraints

- **No new `*.spec.ts` / `*.test.ts` files** (user's standing preference). Each task's gate is `typecheck` + `lint` + the manual check written in it. Existing suites in touched packages must still pass.
- Tombstone element shape, verbatim: `{ deleted: true, deleted_at: <ISO string>, deleted_by_id: <uuid|null>, contentType?: string }`. **It has no `fileName` and no `fileToken`.**
- Tombstone is written **before** the storage delete. If tombstoning a token fails, that token's storage is not deleted.
- A storage delete that fails leaves the `tb_file_tag` row alive (not soft-deleted), so the file stays listed and can be deleted again.
- Bulk delete by filter is resolved **server-side**, and `bu_code` is always forced from the path, never taken from the body.
- Chunk size is 100 tokens per tombstone/delete round. `files.find-tokens` refuses more than **10,000** tokens (422, so the user narrows the filter).
- Permission: the existing FE `useDeleteGate` gate; no new permission key. New gateway guard `api_name`: **`documents.bulkDelete`**. The existing `documents.delete` route goes through the same pipeline.
- Commit messages in Thai; PR titles/bodies in English. Never squash-merge (changelog generator).
- Content-kind buckets must match FE `getFileTypeInfo` in `routes/system-admin/document/use-document-table.tsx` exactly, evaluated in this order: `spreadsheet`(spreadsheet|excel|csv) → `pdf` → `image` → `archive`(zip|rar|compressed) → `txt`(text/plain) → `doc`(word|document) → `code`(json|xml|html) → `file`(other).

## Review Focus

1. **Client resends the old attachment on comment edit.** `components/ui/comment-sheet.tsx:445` sends `c.attachments` back, and 49 micro-business services do `updateData.attachments = updateDto.attachments`. A tombstone must survive that edit, and a resent `{fileToken}` that is now deleted must stay a tombstone. → Task 4 manual check.
2. **One file referenced by two rows** (e.g. a header comment and a detail comment, or the same token copied twice). Every copy becomes a tombstone. → Task 5 manual check.
3. **Filter changes between confirm and execute** (another admin uploads meanwhile). The confirm dialog sends `expected_count`. The server returns 409 `DOCUMENT_BULK_DELETE_COUNT_CHANGED` if the resolved count differs, and the FE refetches the count. → Task 6 + Task 10.
4. **Search text with `%` / `_`.** It matches literally (use the existing `escapeLike`). → Task 2 manual check.
5. **Files with `reference_type = null` or an unmapped type.** They are listed as "อัปโหลดโดยตรง" / the raw type, and tombstoning falls back to scanning all mapped tables. Deleting them succeeds. → Task 5 manual check.

---

### Task 1: file-contract — add `findTokens` and `deleteMany` (BE repo)

**Files:**
- Modify: `carmen-turborepo-backend/packages/file-contract/src/rpc.ts`
- Modify: `carmen-turborepo-backend/packages/file-contract/package.json` (version `1.0.0` → `1.1.0`)

**Interfaces — Produces:**
- `Files.findTokens = rpc('files.find-tokens', 'micro-file').restTodo()`
- `Files.deleteMany = rpc('files.delete-many', 'micro-file').restTodo()`
- Update the header comment count to "11 commands". Keep each entry on one line starting `key: rpc(` (scan.ts parses it).

- [ ] **Step 1:** Add the two entries alphabetically and bump the version.
- [ ] **Step 2:** Run `bun run --cwd packages/file-contract check-types && bun run --cwd packages/file-contract lint`. Expected: clean.
- [ ] **Step 3:** Commit `feat(file-contract): เพิ่มคำสั่ง find-tokens และ delete-many`. It publishes on merge to `main` (`publish-packages.yml`). Task 2 depends on the published `1.1.0`, so this PR merges first.

### Task 2: micro-file — filters, doc-number search, find-tokens, delete-many (MF repo)

**Files:**
- Create: `micro-file/src/files/file-search-where.ts`
- Modify: `micro-file/src/files/files.service.ts` (`searchFiles` ~705, add `findTokens`, `deleteMany`)
- Modify: `micro-file/src/files/files.controller.ts` (`ListFilesPayload` ~62, `listFiles` ~593, two new handlers)
- Modify: `micro-file/package.json` (`@repo/file-contract` → `npm:@carmensoftware-organization/file-contract@1.1.0`)

**Interfaces:**
- Consumes: `Files.findTokens`, `Files.deleteMany` (Task 1).
- Produces:
  - `type FileSearchFilter = { bu_code: string; search?: string; reference_types?: string[]; include_unreferenced?: boolean; content_kinds?: ContentKind[]; created_before?: string /* ISO date, exclusive */; reference_id?: string; reference_no?: string; tag_filters?: TagFilter[] }`
  - `type ContentKind = 'spreadsheet'|'pdf'|'image'|'archive'|'txt'|'doc'|'code'|'file'`
  - `buildFileSearchWhere(f: FileSearchFilter): Prisma.Sql`, always includes `deleted_at IS NULL AND bu_code = ...`
  - `listFiles` payload accepts the new fields as comma-separated strings: `reference_types`, `content_kinds`, `include_unreferenced` (`'true'`), `created_before`. Each returned row adds `created_at`, `created_by_id`, `reference_type`, `reference_id`, `reference_no`, `description`.
  - `files.find-tokens` payload `FileSearchFilter & AuditPayload` → `{ tokens: Array<{ fileToken: string; reference_type: string|null; size: number }>; total_size: number }`. Returns 422 when count > 10,000.
  - `files.delete-many` payload `{ file_tokens: string[] } & AuditPayload` → `{ deleted: string[]; failed: Array<{ fileToken: string; reason: string }> }`

- [ ] **Step 1:** Extract the WHERE building from `searchFiles` into `buildFileSearchWhere`. `search` matches `original_name`, `description` **and `reference_no`** with `ILIKE` on an `escapeLike`d value. `reference_types` + `include_unreferenced` become `(reference_type IN (...) OR reference_type IS NULL)`, or just one side when only one is given. `content_kinds` becomes a `CASE` on `lower(content_type)` that follows the bucket order in Global Constraints. `created_before` becomes `created_at < $1`.
- [ ] **Step 2:** Make `searchFiles` use it and select the extra columns.
- [ ] **Step 3:** Implement `findTokens(f)` with the same WHERE, run the count first, and throw the 422 error when the count is over 10,000.
- [ ] **Step 4:** Implement `deleteMany(tokens)`. Loop over the existing `deleteFile` one token at a time and collect `failed` instead of throwing.
- [ ] **Step 5:** Wire both `@MessagePattern(Files.findTokens.pattern)` / `(Files.deleteMany.pattern)` handlers using the existing `createAuditContext` + `runWithAuditContext` pattern.
- [ ] **Step 6:** Run `bun run typecheck && bun run lint` (MF). Expected: clean. Existing `files.service.spec.ts` must still pass: `bun test`.
- [ ] **Step 7 (manual):** Start micro-file locally and send a `files.find-all` TCP payload (or call through the gateway after Task 6) with `search: "50%"`. Expected: no `ILIKE` wildcard behaviour.
- [ ] **Step 8:** Commit `feat(files): กรองตามโมดูล/ชนิดไฟล์/วันที่ ค้นเลขเอกสาร และลบหลายไฟล์`.

### Task 3: micro-business — reference_type → attachment table map (BE repo)

**Files:**
- Create: `apps/micro-business/src/common/attachments/attachment-table-map.ts`
- Create: `scripts/check-attachment-table-map.ts` (BE root) and add `"check:attachment-map": "bun run scripts/check-attachment-table-map.ts"` to the root `package.json`

**Interfaces — Produces:**
```ts
export interface AttachmentTableEntry {
  model: string;              // Prisma delegate name, e.g. 'tb_purchase_request_comment'
  parentIdColumn: string;     // column holding the parent entity id, e.g. 'purchase_request_id'
}
export interface ReferenceTypeEntry {
  tables: AttachmentTableEntry[];                 // every table whose `attachments` may hold this type's files
  parent: { model: string; displayColumn: string; headerIdVia?: { model: string; column: string } };
}
export const ATTACHMENT_TABLES_BY_REFERENCE_TYPE: Record<string, ReferenceTypeEntry>;
export const ALL_ATTACHMENT_TABLES: AttachmentTableEntry[]; // deduped, used for null/unknown types
```
- `displayColumn` is the doc number column for transactional docs (e.g. `pr_no`, `po_no`, `grn_no`). For master data with no number it is the code or name column (e.g. vendor `code`, recipe `name`).
- `headerIdVia` is filled only for detail-level reference ids. **First** check which id the `*_detail_comment` gateway services pass to `tagAttachmentsByReference` (spec, "Left to the builder").

- [ ] **Step 1:** Build the map for all 39 keys in FE `routes/system-admin/document/document-reference-labels.ts` (`DOCUMENT_REFERENCE_MODULE_KEY`). Take the tables from the ~60 models with an `attachments Json` column in `packages/prisma-shared-schema-tenant/prisma/schema.prisma`.
- [ ] **Step 2:** Write the check script. It parses the tenant `schema.prisma` and fails, listing the missing models, if any model with an `attachments` field is absent from `ALL_ATTACHMENT_TABLES`.
- [ ] **Step 3:** Run `bun run check:attachment-map`. Expected: `OK — N tables mapped`.
- [ ] **Step 4:** Run `bun run --cwd apps/micro-business check-types`. Expected: clean.
- [ ] **Step 5:** Commit `feat(attachments): แผนที่ reference_type → ตารางที่เก็บไฟล์แนบ`.

### Task 4: micro-business — tombstone-aware AttachmentSchema + preserve on every write (BE repo)

**Files:**
- Modify: `apps/micro-business/src/common/dto/attachment.schema.ts`
- Create: `apps/micro-business/src/common/attachments/preserve-tombstones.ts`
- Modify: every micro-business service that writes `attachments` (find them with `grep -rln "attachments" apps/micro-business/src --include='*.service.ts'`; 49 use `updateData.attachments = updateDto.attachments`, others use the `{add, remove}` form or `addAttachment`/`removeAttachment`)
- Modify: `apps/backend-gateway/src/common/helpers/document-download-url.ts` (`fillAttachmentUrls` ~121, `fillCommentAttachmentUrls` ~173)

**Interfaces — Produces:**
- `TombstoneSchema = z.object({ deleted: z.literal(true), deleted_at: z.string(), deleted_by_id: z.string().nullable(), contentType: z.string().optional() })`
- `StoredAttachmentSchema = z.union([AttachmentSchema, TombstoneSchema])`, `type StoredAttachment`, `isTombstone(a): a is Tombstone`
- `preserveTombstones(current: StoredAttachment[], next: StoredAttachment[], added: ReadonlySet<string>): StoredAttachment[]`. No micro-file call. Every tombstone in `current` survives (kept in its original position, or appended if `next` dropped it). A live element in `next` is kept only if its `fileToken` is live in `current` or is in `added` (newly uploaded in this request). Any other live element is dropped, because it is a resend of a file that has since been tombstoned.

- [ ] **Step 1:** Add the schemas and helper.
- [ ] **Step 2:** Apply `preserveTombstones` in every write path found by the grep, including the `{add, remove}` merge and `removeAttachment`. `remove` must never match a tombstone, because a tombstone has no token.
- [ ] **Step 3:** In the gateway URL fillers, skip elements where `deleted === true`. No presign call; return them unchanged.
- [ ] **Step 4:** Run `bun run --cwd apps/micro-business check-types && bun run --cwd apps/backend-gateway check-types && bun run lint`. Expected: clean. Existing comment service specs still pass.
- [ ] **Step 5 (manual, Review Focus 1):** On dev, put a tombstone by hand into one `tb_stock_in_comment.attachments`. Edit that comment's message in the FE and save. Expected: the tombstone is still in the DB row.
- [ ] **Step 6:** Commit `feat(attachments): รองรับ tombstone และกันไม่ให้การแก้ comment เขียนทับ`.

### Task 5: micro-business — tombstone + resolve-references commands (BE repo)

**Files:**
- Create: `apps/micro-business/src/common/attachments/document-attachments.module.ts`, `.controller.ts`, `.service.ts` (service extends `TenantScopedService`)
- Modify: `apps/micro-business/src/app.module.ts` (import module)
- Regenerate: `packages/rpc-contract` via `bun run gen:rpc-contract` (3-step process in the generated file header)

**Interfaces:**
- Consumes: `ATTACHMENT_TABLES_BY_REFERENCE_TYPE`, `ALL_ATTACHMENT_TABLES` (Task 3), `TombstoneSchema` (Task 4).
- Produces (contract `DocumentAttachments`):
  - `document-attachments.tombstone`: `{ items: Array<{ fileToken: string; reference_type: string|null }> }` → `{ tombstoned: string[]; failed: Array<{ fileToken: string; reason: string }> }`. It uses `deleted_by_id` = context user and `deleted_at` = now.
  - `document-attachments.resolve-references`: `{ items: Array<{ reference_type: string; reference_id: string }> }` → `Array<{ reference_type; reference_id; display_no: string|null; parent_id: string|null; exists: boolean }>`

- [ ] **Step 1:** For `tombstone`, group the items by `reference_type`. For each candidate table, run `UPDATE <table> SET attachments = (SELECT jsonb_agg(CASE WHEN e->>'fileToken' = ANY($tokens) THEN jsonb_build_object('deleted', true, 'deleted_at', $now, 'deleted_by_id', $user, 'contentType', e->'contentType') ELSE e END) FROM jsonb_array_elements(attachments) e) WHERE attachments @> ANY(...)`. Use a `jsonb_path_exists` or `@>` per token. Do it in one tenant transaction per chunk. Null or unmapped types use `ALL_ATTACHMENT_TABLES`. Raw SQL must schema-qualify the table, the same way as `searchFiles` in micro-file.
- [ ] **Step 2:** For `resolve-references`, run one query per distinct `reference_type`: select `id, <displayColumn>` from `parent.model` where id is in the ids, following `headerIdVia` when it is set. Ids not found → `exists: false`.
- [ ] **Step 3:** Run `gen:rpc-contract`, then swap the temporary literals for the generated references.
- [ ] **Step 4:** `check-types` + `lint` for micro-business and rpc-contract. Expected: clean.
- [ ] **Step 5 (manual, Review Focus 2 + 5):** On dev BU T02, attach one file in a PR comment and copy the same element into a PR detail comment. Call `tombstone` with `reference_type: null`. Expected: both rows become tombstones, and `tombstoned` contains the token.
- [ ] **Step 6:** Commit `feat(attachments): คำสั่ง tombstone และ resolve-references`.

### Task 6: gateway — list enrichment, bulk-delete endpoint, single delete through the pipeline (BE repo)

**Files:**
- Modify: `apps/backend-gateway/src/application/document-management/document-management.controller.ts` (`@Get()` ~187, `@Delete(':filetoken')` ~529, new `@Post('bulk-delete')` declared **before** the `:filetoken` routes)
- Modify: `apps/backend-gateway/src/application/document-management/document-management.service.ts` (`listDocuments`, `deleteDocument`, new `bulkDelete`)
- Modify: `apps/backend-gateway/src/application/document-management/swagger/request.ts`, `response.ts`
- Modify: `apps/backend-gateway/src/common/helpers/tag-attachments-by-reference.ts`
- Modify: `packages/error-catalog` (add `DOCUMENT_BULK_DELETE_COUNT_CHANGED` 409, `DOCUMENT_BULK_DELETE_TOO_MANY` 422)

**Interfaces:**
- Consumes: `Files.findTokens`, `Files.deleteMany` (Tasks 1–2); `DocumentAttachments.*` (Task 5).
- Produces (REST, the FE relies on it):
  - `GET /api/:bu_code/documents` adds query params `reference_types`, `content_kinds` (comma lists), `include_unreferenced` (`true`), `created_before` (YYYY-MM-DD). Each item adds `reference_type`, `reference_id`, `reference_no` (= resolved `display_no` ?? stored), `reference_parent_id`, `reference_exists`, `description`, `created_at`, and `audit.created.by` (via `@EnrichAuditUsers`, same shape as other lists). `paginate` adds `total_size` (bytes of all rows matching the filter; micro-file `searchFiles` returns it from the count query as `sum(size)`).
  - `POST /api/:bu_code/documents/bulk-delete`, guard `new AppIdGuard('documents.bulkDelete')`, body `{ file_tokens?: string[]; filter?: Omit<FileSearchFilter,'bu_code'>; expected_count?: number }` (exactly one of `file_tokens` / `filter`) → `{ deleted: number; failed: Array<{ fileToken; fileName; reason }>; freed_size: number }`

- [ ] **Step 1:** In `listDocuments`, pass the new filters through, then call `resolve-references` once with the distinct `(reference_type, reference_id)` pairs of the page and merge the result.
- [ ] **Step 2:** Implement `bulkDelete`. Get tokens from `file_tokens` (look up their `reference_type` through `findTokens` with an exact token list, or extend the filter with `file_tokens`) or from `filter`. Check `expected_count` → 409. Then for each chunk of 100: `tombstone` → `deleteMany` only for tokens in `tombstoned` → accumulate the results.
- [ ] **Step 3:** Rewrite `deleteDocument` as `bulkDelete({ file_tokens: [token] })`, keeping its current response shape.
- [ ] **Step 4:** In `tagAttachmentsByReference`, after tagging, call `resolve-references` for that one reference and send the `display_no` as `reference_no` in the same `Files.updateTags` call. This is best-effort and errors are logged only.
- [ ] **Step 5:** `check-types` + `lint` + `bun run audit:rest-contract`. Expected: clean.
- [ ] **Step 6 (manual, Review Focus 3):** Run `curl` POST bulk-delete with a filter and a wrong `expected_count`. Expected: 409 `DOCUMENT_BULK_DELETE_COUNT_CHANGED`. Run it again with the right count on a test file. Expected: `deleted: 1`, the comment shows a tombstone, and the file is gone from the list.
- [ ] **Step 7:** Commit `feat(documents): endpoint ลบหลายไฟล์ + ตามรอยเอกสารต้นทางในรายการ`.

### Task 7: one-off cleanup + reference_no backfill script (BE repo)

**Files:**
- Create: `apps/micro-business/scripts/document-attachments-cleanup.ts`
- Modify: `apps/micro-business/package.json` (`"script:document-attachments-cleanup": "bun scripts/document-attachments-cleanup.ts"`)

**Interfaces:** CLI `--bu <code>` (required, repeatable), `--dry-run` (default **on**; `--apply` to write). It reads `FILE_DATABASE_URL`, the tenant connection the way existing tenant seed scripts do (`packages/prisma-shared-schema-tenant/prisma/seed.*.ts`), and the MinIO env vars with the same names micro-file uses.

- [ ] **Step 1:** For every table in `ALL_ATTACHMENT_TABLES`, collect the live `fileToken`s. A token is "broken" if its `tb_file_tag` row has `deleted_at` set, or if there is no row **and** MinIO `statObject` fails. Rewrite broken elements to tombstones with `deleted_by_id: null`.
- [ ] **Step 2:** Backfill `tb_file_tag.reference_no` where it is null and `reference_id` is set, using the Task 5 resolve logic (import the service function, not RPC).
- [ ] **Step 3:** Print per-BU counts: tables scanned, broken found / tombstoned, reference_no filled. It is safe to re-run.
- [ ] **Step 4:** `check-types`. Then run `--dry-run --bu T02` against dev. Expected: counts printed, nothing written.
- [ ] **Step 5:** Commit `feat(scripts): เก็บกวาดไฟล์แนบที่ลิงก์เสีย + เติมเลขเอกสาร`.

### Task 8: FE — types, list hook, filters, new columns (FE repo)

**Files:**
- Modify: `types/document.ts` (`DocumentFile`)
- Modify: `routes/system-admin/document/use-document.ts` (`useDocument` params, new `useBulkDeleteDocuments`)
- Modify: `routes/system-admin/document/use-document-table.tsx` (columns)
- Modify: `routes/system-admin/document/document-component.tsx` (filter bar)
- Create: `routes/system-admin/document/document-filter-fields.ts` (follow `routes/config/chart-of-account-mapping/coam-filter-fields.ts` + `hooks/use-list-filters.ts`)
- Create: `routes/system-admin/document/document-reference-link.ts`, which maps `reference_type` → route path, reusing the path map in `lib/notification-helpers.tsx` (move that map to `lib/entity-routes.ts` if it is not exported; `lib/` must not import from `routes/`)
- Modify: i18n message files for `systemAdmin.document` (all locales)

**Interfaces:**
- Consumes: the REST shape from Task 6.
- Produces: `DocumentFile` gains `referenceType`/`referenceId`/`referenceNo`/`referenceParentId`/`referenceExists`/`description`/`createdAt`/`audit` (or snake_case; match what the API returns and keep it consistent). `documentReferenceHref(type: string|null, parentId: string|null): string|undefined`.

- [ ] **Step 1:** Filters (URL-backed): module multi-select (options = `DOCUMENT_REFERENCE_MODULE_KEY` labels + "อัปโหลดโดยตรง" → `include_unreferenced`), file kind multi-select (the 8 buckets), uploaded-before date.
- [ ] **Step 2:** Columns. **แนบจาก** = `documentReferenceLabel(...)` + ` · ` + `referenceNo` as a `<Link>` when the href resolves; "เอกสารถูกลบแล้ว" when `referenceExists === false`; "ไม่ทราบที่มา" when the type is unmapped and `referenceId` is null. **ผู้อัปโหลด** = `audit.created.by` name. The date column switches to `createdAt`. Keep `"use no memo"` (routes/CLAUDE.md DataGrid trap).
- [ ] **Step 3:** Run `bun run typecheck && bun run lint`. Expected: clean.
- [ ] **Step 4 (manual):** `bun dev` → `/system-admin/document` on T02. Filter Module=ใบขอซื้อ + Kind=image. Expected: only PR images, and the URL holds the filters. Click a PR number. Expected: the PR opens.
- [ ] **Step 5:** Commit `feat(document): แสดงที่มาของไฟล์ ผู้อัปโหลด และตัวกรองโมดูล/ชนิด/วันที่`.

### Task 9: FE — selection bar, select-all-matching, bulk delete dialog (FE repo)

**Files:**
- Create: `routes/system-admin/document/document-selection-bar.tsx`
- Create: `routes/system-admin/document/document-bulk-delete-dialog.tsx`
- Modify: `routes/system-admin/document/document-component.tsx`, `use-document.ts`
- Modify: `constant/api-endpoints.ts` (`DOCUMENTS_BULK_DELETE: (bu) => \`/api/proxy/api/${bu}/documents/bulk-delete\``)

**Interfaces:**
- Consumes: Task 6 POST; Task 8 filter state.
- Produces: `useBulkDeleteDocuments(): UseMutationResult<BulkDeleteResult, Error, { file_tokens: string[] } | { filter: DocumentFilterParams; expected_count: number }>`. It invalidates `QUERY_KEYS.DOCUMENTS`, which also refreshes the summary through the shared prefix.

- [ ] **Step 1:** Selection bar shows "เลือกแล้ว N ไฟล์ · X MB" for the ticked rows. The link "เลือกทั้งหมดที่ตรงตัวกรอง (N · X)" uses `paginate.total` and `paginate.total_size`. The delete button is gated by `useDeleteGate`.
- [ ] **Step 2:** The dialog shows the count, the total size and the copy "ลบถาวร กู้คืนไม่ได้", and the primary action is destructive. On 409 `DOCUMENT_BULK_DELETE_COUNT_CHANGED`, refetch and show the new count without closing. On a partial failure, the toast lists the failed file names.
- [ ] **Step 3:** `typecheck` + `lint`. Expected: clean.
- [ ] **Step 4 (manual):** Tick 2 test files and delete them. Expected: the rows disappear, the summary bar shrinks, and the source comment shows the tombstone. Select all matching a filter that matches 3 test files, then delete. Expected: all 3 are gone, page 2 included.
- [ ] **Step 5:** Commit `feat(document): ลบหลายไฟล์ด้วยการเลือกหรือตามตัวกรอง`.

### Task 10: FE — render tombstones everywhere attachments are shown (FE repo)

**Files:**
- Modify: `components/ui/comment-sheet.tsx` (`CommentAttachment` type ~43, render ~575–630, edit payload ~445)
- Modify: the other attachment renderers. Find them with `grep -rln "attachments" components/share routes --include='*.tsx'` (certificate, eco label, recipe equipment, AP/AR, if they render attachment arrays).
- Create: `components/ui/deleted-attachment-chip.tsx`

**Interfaces — Produces:** `type CommentAttachment = LiveAttachment | DeletedAttachment` with `isDeletedAttachment(a)`. `<DeletedAttachmentChip deletedAt={string} deletedBy?={string} />` renders "🗑 ไฟล์ถูกลบแล้ว · <date> โดย <name>": not clickable, muted dashed border, readable in light and dark mode, design-system tokens only.

- [ ] **Step 1:** Narrow every `.fileToken` / `.fileName` access with the type guard. Image galleries filter tombstones out of the gallery and render chips in their place in the list.
- [ ] **Step 2:** The edit payload (~445) keeps sending tombstones untouched (the server also preserves them, Task 4).
- [ ] **Step 3:** `typecheck` + `lint`. Expected: clean.
- [ ] **Step 4 (manual):** Open the comment from Task 9 Step 4. Expected: a chip, no broken image, and editing the message keeps the chip. Check both themes.
- [ ] **Step 5:** Commit `feat(comment): แสดงไฟล์ที่ถูกลบเป็น placeholder`.

### Task 11: release order + docs

- [ ] **Step 1:** Open the PRs (English) in merge order: BE Task 1 alone → MF (Tasks 2) → BE Tasks 3–7 → FE Tasks 8–10. Use stacked PRs without `--delete-branch` until the whole stack is merged.
- [ ] **Step 2:** Deploy dev: micro-file → micro-business + gateway → add `documents.bulkDelete` to the app allowlist on every env that is not `allow_all` → `script:document-attachments-cleanup --bu <each> --dry-run`, review the counts, then `--apply` → FE `vercel --prod`.
- [ ] **Step 3:** Run `trail check` before each push. Save a learning if the detail-comment `reference_id` answer (Task 3) turned out non-obvious.
