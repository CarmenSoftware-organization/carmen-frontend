# Document page: delete any BU file — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **User rule:** skip every "write failing test / run test" step — implement, type-check, lint, run the *existing* suites, commit. Do not create `*.spec.ts` / `*.test.ts`. Commit messages in Thai, PR text in English.

**Goal:** Admins can delete every tenant file from `/system-admin/document`; the owning record gets a "ลบไฟล์" Activity entry; the delete dialog says where the file is used; platform-wide files stay refused with "managed in carmen-backstage".

**Architecture:** micro-business gains a usage lookup (`findUsages`) and its `tombstone` grows from "rewrite `attachments` JSON" to "clean every tenant reference (JSON tombstone, child-row delete, column NULL) + insert `tb_activity` rows, all in one tenant transaction". Gateway forwards owner info into `tombstone`, adds `usages` to list rows, and a `dry_run` mode on bulk-delete for the filter-mode confirm. FE shows usages and stops disabling tenant files.

**Tech Stack:** NestJS microservices, Prisma raw SQL (`Prisma.sql`), Postgres enums, React 19 + TanStack Table, use-intl.

**Spec:** `carmen-frontend/docs/superpowers/specs/2026-11-03-document-delete-any-file-design.md`

## Global Constraints

- New activity action value: `file_delete` (tenant enum only). FE title: en "File deleted", th "ลบไฟล์".
- Platform kinds are never deleted: `tb_user_profile.avatar_file_token|signature_file_token`, `tb_business_unit|tb_cluster.logo_file_token|avatar_file_token`, `tb_news.image_file_token`, `PLATFORM_ATTACHMENT_GUARD_TABLES`. A file with any platform usage is refused as a whole.
- Refusal keeps reason `UNSUPPORTED_REFERENCE_TYPE` / catalog `DOCUMENT_DELETE_UNSUPPORTED`; its message becomes "managed in carmen-backstage".
- Storage is deleted only for tokens whose tenant transaction (cleanup + activity insert) committed.
- One Activity entry per (token, owner); `meta_data.location` is a list.
- No new gateway api_name (reuse `documents.list`, `documents.bulkDelete`, `documents.delete`).
- Filter-mode cap stays 1,000.
- Starting point: uncommitted work on branch `feature/document-delete-blocked` in both repos (`findDeleteBlocked` RPC, `delete_blocked` list field, FE disabling, catalog text). Repurpose it as below; do not keep `findDeleteBlocked` as a separate RPC.

## Review Focus

1. A file referenced by both a product image **and** a comment → product image row removed, comment tombstoned, two Activity entries (product + comment's document), one storage delete. Check in Task 3 by manual run (curl single delete) against such a file.
2. Same token in two rows of one owner (e.g. two comments on one PR) → exactly one Activity entry with `location: ["comment"]`. Task 3: group by `(owner_type, owner_id)` before inserting.
3. Recipe step image → owner is the recipe (`tb_recipe`), not the step. Task 3 owner mapping.
4. Activity insert failure (e.g. enum value missing on a BU that was not migrated) → transaction rolls back, file reported `TOMBSTONE_FAILED`, storage untouched. Task 3: the insert is inside `$transaction`; Task 6 deploy note.
5. Filter mode with platform files in the match → `dry_run` reports `platform_blocked` count; real delete deletes the rest and lists those as failed with the backstage message. Task 4 + Task 5.

---

### Task 1: `file_delete` activity action (tenant)

**Files:**
- Modify: `carmen-turborepo-backend/packages/prisma-shared-schema-tenant/prisma/schema.prisma` (`enum enum_activity_action`, ~line 51)
- Create: `carmen-turborepo-backend/packages/prisma-shared-schema-tenant/prisma/migrations/20261103140000_add_activity_action_file_delete/migration.sql`
- Modify: `carmen-turborepo-backend/packages/log-events-library/src/schemas/log-event.schema.ts` (`AuditActionSchema`, ~line 9)

**Interfaces:** Produces enum value `file_delete` usable in `tb_activity.action` (tenant) and `AuditAction` type.

- [ ] **Step 1:** add `file_delete` to the tenant enum and to `AuditActionSchema`. Migration body, idempotent like its siblings: `ALTER TYPE "enum_activity_action" ADD VALUE IF NOT EXISTS 'file_delete';` with a Thai header comment. Check how the per-BU tenant migration runner applies migrations; `ADD VALUE` cannot run inside a transaction block on PG < 12 — if the runner wraps each file in a transaction and the target PG is older, note it in the PR (do not build a new runner unless it actually fails).
- [ ] **Step 2:** regenerate the tenant Prisma client the way the package does (`bun run` script in that package's `package.json`), then `npx tsc --noEmit` in `packages/log-events-library`. Expected: no errors.
- [ ] **Step 3:** commit `feat(activity): เพิ่ม action file_delete (tenant)`.

### Task 2: usage lookup in micro-business

**Files:**
- Modify: `apps/micro-business/src/common/attachments/attachment-table-map.ts` (guard arrays → described usages)
- Modify: `apps/micro-business/src/common/attachments/document-attachments.service.ts` (replace `findDeleteBlocked`)
- Modify: `apps/micro-business/src/common/attachments/document-attachments.controller.ts`
- Modify: `packages/rpc-contract/src/contracts/document-attachments.ts` (rename entry `findDeleteBlocked` → `findUsages`, cmd `document-attachments.find-usages`), then `bun run build:package` in `packages/rpc-contract`

**Interfaces:**
- Produces (export from `attachment-sql.ts` or a new `file-usage.ts` beside it):
  ```ts
  export type FileUsageKind =
    | 'attachment' | 'product_image' | 'recipe_image' | 'recipe_step_image'
    | 'recipe_category_image' | 'recipe_cuisine_image' | 'recipe_equipment_image'
    | 'recipe_equipment_category_image' | 'grn_signature'
    | 'user_avatar' | 'user_signature' | 'bu_logo' | 'bu_avatar'
    | 'cluster_logo' | 'cluster_avatar' | 'news_image' | 'platform_note';
  export interface FileUsage {
    kind: FileUsageKind;
    owner_type: string;      // owner table, e.g. 'tb_product'
    owner_id: string | null; // null only for platform kinds where the owner is not resolved
    label: string | null;    // display value of the owner (product code, recipe name, user name…)
    platform: boolean;
  }
  export interface UsageItem { fileToken: string; reference_type: string | null; reference_id: string | null }
  ```
- `DocumentAttachmentsService.findUsages(items: UsageItem[]): Promise<Result<{ fileToken: string; usages: FileUsage[] }[]>>` — one row per input token, input order.
- RPC `DocumentAttachments.findUsages`, payload `{ items: UsageItem[] }`.

- [ ] **Step 1:** in `attachment-table-map.ts`, give each `FILE_TOKEN_COLUMN_GUARDS` entry its cleanup + owner description (keep the array name; extend the element type):
  ```ts
  { model, column, kind: FileUsageKind,
    mode: 'delete_row' | 'null_column',
    owner: { model: string; idSql: 'id' | '<fk column>' ; via?: { model: string; column: string } },
    labelColumn: string }
  ```
  Values: `tb_product_image` → delete_row, owner `tb_product` via `product_id`, label `code`; `tb_recipe_image` → delete_row, owner `tb_recipe` via `recipe_id`, label `name`; `tb_recipe_preparation_step_image` → delete_row, owner `tb_recipe` via `preparation_step_id` → `tb_recipe_preparation_step.recipe_id`, label `name`; the four recipe master `image_file_token` columns → null_column, owner = the row itself (`id`), label `name`; `tb_good_received_note.signature_file_token` → null_column, owner itself, label = its document-number column (check schema, e.g. `grn_no`). Platform guards get `kind` + `platform: true` (+ label column: user name / BU name / cluster name / news title).
- [ ] **Step 2:** implement `findUsages`: attachment usages via `findAttachmentFileTokens` over `ALL_ATTACHMENT_TABLES` (owner = the file's registry reference resolved with `resolveReferenceDocuments`, i.e. `parent.model` + header id); column usages via one `SELECT <token col>, <owner id>, <label>` per guard with `= ANY(tokens)` (tenant client for tenant guards, `prismaSystem` for platform). Read-only, no transaction.
- [ ] **Step 3:** controller handler `findUsages` with `@MessagePattern(DocumentAttachments.findUsages.pattern)`; delete `findDeleteBlocked` (service + handler + contract entry). Run `bun run gen:rpc-contract` at repo root and confirm it leaves `document-attachments.ts` as you wrote it; revert any other contract file it touches (pre-existing drift on main).
- [ ] **Step 4:** `npx tsc --noEmit -p apps/micro-business/tsconfig.json` → no errors; eslint on touched files → clean.
- [ ] **Step 5:** commit `feat(attachments): ค้นว่าไฟล์ถูกใช้อยู่ที่ไหน (findUsages)`.

### Task 3: tombstone deletes every tenant reference + writes "ลบไฟล์"

**Files:**
- Modify: `apps/micro-business/src/common/attachments/document-attachments.service.ts` (`tombstone`, `TombstoneItem`)
- Modify: `apps/micro-business/src/common/attachments/attachment-sql.ts` (add the row/column cleanup helpers)

**Interfaces:**
- Consumes: Task 1 enum value; Task 2 `FileUsage` + guard descriptions + `findUsages` internals.
- Produces: `TombstoneItem` becomes `{ fileToken: string; reference_type: string | null; reference_id: string | null; file_name: string | null; size: number | null; content_type: string | null }`. Return shape `{ tombstoned: string[]; failed: { fileToken; reason }[] }` unchanged.
- New helpers in `attachment-sql.ts`: `deleteRowsByFileToken(tx, table, column, tokens): Promise<Array<{ token: string; ownerId: string }>>` and `nullColumnByFileToken(tx, table, column, tokens): Promise<Array<{ token: string; ownerId: string }>>` (return the affected owner per token; for soft-deletable child tables follow how that module's own image-remove API deletes — read its service; set `deleted_at`/`deleted_by_id` if that is what it does, else hard delete).

- [ ] **Step 1:** drop the `FILE_TOKEN_COLUMN_GUARDS` refusal and the `tables: []` refusal for tenant types; keep the platform check (`findPlatformReferencedTokens`) as the only refusal → reason `UNSUPPORTED_REFERENCE_TYPE`. `news` stays refused because it is platform.
- [ ] **Step 2:** inside the existing `$transaction` (keep timeout 25s): for the work set, (a) collect attachment owners before tombstoning (rows that contain the token in each `ALL_ATTACHMENT_TABLES` table → owner from the item's registry reference), (b) `tombstoneTokensInTable` as today, (c) for each tenant guard run `deleteRowsByFileToken` / `nullColumnByFileToken` per `mode` and map owner via `owner.via` when set, (d) group by `(token, owner_type, owner_id)` merging `location` kinds, (e) insert into tenant `tb_activity` through `tx` (raw insert, same `tenantTableRef`): `action 'file_delete'`, `entity_type owner_type`, `entity_id owner_id`, `actor_id this.userId`, `meta_data { file_token, file_name, size, content_type, location: FileUsageKind[] }`, `description` = `ลบไฟล์ "<file_name>" จากหน้า Document`, `created_by_id this.userId`. Tokens with no owner (direct upload) get no row.
- [ ] **Step 3:** any throw in the transaction → every token of the chunk `failed` with the error message (existing catch) → gateway maps to `TOMBSTONE_FAILED` and skips storage delete (already the gateway behaviour — verify in `bulkDelete`).
- [ ] **Step 4:** tsc + eslint (as Task 2 Step 4).
- [ ] **Step 5:** commit `feat(attachments): ลบได้ทุกการอ้างอิงฝั่ง tenant พร้อมบันทึก activity ลบไฟล์`.

### Task 4: gateway — owner info into tombstone, `usages` on list rows, `dry_run`

**Files:**
- Modify: `apps/backend-gateway/src/application/document-management/document-management.service.ts` (`listDocuments`, the uncommitted `findDeleteBlocked`, `bulkDelete`, `deleteDocument`)
- Modify: the bulk-delete Zod/DTO + swagger in `apps/backend-gateway/src/application/document-management/` (body gains optional `dry_run: boolean`)
- Modify: `packages/error-catalog/src/catalog.ts` (`DOCUMENT_DELETE_UNSUPPORTED` text) then `bun run gen:reference` + `bun run build:package` in that package

**Interfaces:**
- Consumes: Task 2 RPC `findUsages`; Task 3 `TombstoneItem`.
- Produces for FE:
  - list row fields `usages: FileUsage[] | null` (null = lookup failed) and `delete_blocked: boolean | null` = `usages?.some(u => u.platform) ?? null`.
  - `POST /documents/bulk-delete` with `dry_run: true` → `200 { matched: number; in_use: number; platform_blocked: number; freed_size: number }`, nothing deleted; same validation/cap/`expected_count` as a real call.

- [ ] **Step 1:** replace the uncommitted `findDeleteBlocked` helper with `findUsages(bu_code, user_id, documents)` (same best-effort pattern) and set both row fields.
- [ ] **Step 2:** `bulkDelete` sends `reference_id`, `file_name` (registry `originalName`), `size`, `content_type` in each tombstone item; with `dry_run` it resolves the tokens as today, calls `findUsages`, returns the counts, and stops before tombstone.
- [ ] **Step 3:** catalog text: en `This file is shared across business units (user avatar or signature, business unit or cluster logo, news image, or note attachment) and is managed in carmen-backstage`, th `ไฟล์นี้ใช้ร่วมกันหลาย BU (รูปหรือลายเซ็นผู้ใช้ โลโก้ BU/cluster รูปข่าว หรือไฟล์แนบ note) จัดการได้ที่ carmen-backstage`.
- [ ] **Step 4:** `npx jest src/application/document-management` in `apps/backend-gateway` → all existing pass (17); tsc shows only the pre-existing `verify-swagger.spec.ts` TS6059.
- [ ] **Step 5:** manual (shared dev DB — ask the user before any real delete): `curl` list with a BU token and check `usages` on a product-image file; `dry_run` with a filter.
- [ ] **Step 6:** commit `feat(document): ส่ง usages ใน list, dry_run ของ bulk-delete และส่งเจ้าของไฟล์ให้ tombstone`.

### Task 5: FE — show where used, enable tenant deletes, dry-run confirm

**Files:**
- Modify: `types/document.ts` (`usages`, `delete_blocked` doc comment → platform only; `BulkDeleteDryRunResult`)
- Create: `routes/system-admin/document/document-usage-list.tsx` (renders `FileUsage[]` as "Product image · 801010001" lines, max 5 + "and N more")
- Modify: `routes/system-admin/document/use-document-table.tsx`, `document-icon-grid.tsx`, `document-preview-view.tsx` (uncommitted disabling stays but the reason text becomes the backstage message; add "Used in" row in preview metadata)
- Modify: `routes/system-admin/document/document-component.tsx` (single `DeleteDialog` description renders `DocumentUsageList`; bulk dialog: token mode summarises usages of the selected loaded rows; filter mode calls dry-run before opening)
- Modify: `routes/system-admin/document/document-bulk-delete-dialog.tsx`, `use-document.ts` (`useBulkDeleteDryRun` mutation, same endpoint + `dry_run: true`)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: Task 4 list fields and dry-run response.
- Produces: `DocumentUsageList({ usages }: { usages: FileUsage[] | null | undefined })`; `useBulkDeleteDryRun()`.

- [ ] **Step 1:** i18n keys under `systemAdmin.document`: `usedIn` ("Used in" / "ใช้อยู่ที่"), `usage.<kind>` for every `FileUsageKind` (e.g. `product_image` "Product image" / "รูปสินค้า", `user_signature` "User signature" / "ลายเซ็นผู้ใช้"), `deleteInUseWarning` ("It will be removed from these places." / "ไฟล์จะหายไปจากที่เหล่านี้"), `bulkInUse` ("{count} of these files are in use" / "{count} ไฟล์ในนี้ยังถูกใช้อยู่"), `bulkPlatformBlocked` ("{count} shared files will be skipped (managed in carmen-backstage)" / "ข้ามไฟล์ที่ใช้ร่วมหลาย BU {count} ไฟล์ (จัดการที่ carmen-backstage)"); change `deleteBlocked`, `errors.DOCUMENT_DELETE_UNSUPPORTED`, `bulkReason.UNSUPPORTED_REFERENCE_TYPE` to the Task 4 Step 3 meaning. No `{}`/`<>` inside values except ICU args (see memory: ICU messages).
- [ ] **Step 2:** implement the components/hook above; `"use no memo"` stays on components that read the table.
- [ ] **Step 3:** `bun run typecheck` and `bunx eslint routes/system-admin/document` → no errors.
- [ ] **Step 4:** browser check on :3000 (local stack): preview of `cat_pic.jpeg` (Product 801010001) shows "Used in: Product image · 801010001", Delete enabled; a user-signature file stays disabled with the backstage reason. No real delete without asking the user.
- [ ] **Step 5:** commit `feat(document): แสดงที่ใช้งานไฟล์ก่อนลบ และเปิดให้ลบไฟล์ของ BU ทุกชนิด`.

### Task 6: FE Activity sheet — "ลบไฟล์"

**Files:**
- Modify: `components/share/activity-sheet.tsx` (`ACTION_TITLE_KEY`, destructive marker set, entry body shows `meta_data.file_name`)
- Modify: `messages/en.json`, `messages/th.json` (`actionFileDeleted`: "File deleted" / "ลบไฟล์")
- Read first: `.claude/skills/activity-sheet/SKILL.md` (ACTION_TITLE_KEY ↔ DB enum contract)

- [ ] **Step 1:** add `file_delete: "actionFileDeleted"`, add `file_delete` to the alert-marker set, render the file name from `meta_data.file_name` under the title when present.
- [ ] **Step 2:** typecheck + lint; `bun test:run components/share` → existing pass.
- [ ] **Step 3:** commit `feat(activity): แสดงรายการลบไฟล์ใน activity sheet`.

### Task 7: PRs and deploy order

- [ ] PR backend (micro-business + gateway + packages), PR frontend; trail learning file `2026-11-03-document-previews-load-files-through-the-thammanoon.md` goes in the FE PR (user said yes).
- [ ] PR body deploy order: tenant migration on **every** BU schema → micro-business → gateway → FE. A BU without the migration fails every delete of a referenced file with `TOMBSTONE_FAILED` (safe: nothing deleted).
- [ ] Merge only on the user's go.
