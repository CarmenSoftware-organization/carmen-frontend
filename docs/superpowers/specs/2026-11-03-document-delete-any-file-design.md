# Document page: delete any file, with "where used" warning and a "File deleted" activity entry

Date: 2026-11-03 · Repos: carmen-turborepo-backend (micro-business, backend-gateway, prisma schemas,
log-events-library, error-catalog, rpc-contract) · carmen-frontend. micro-file and micro-report are
not changed.

## Intent

`/system-admin/document` lists every stored file of a BU and only admins reach it
(`system_admin.document:delete`). Because only admins are there, **every file of the BU's own data
must be deletable** (tenant data). Platform-wide files are the one exception — see below.
In exchange, nothing may disappear silently: the admin is told where the file is used before
confirming, and the record that owned the file gets an Activity entry saying **who deleted which
file, and when**.

This reverses, for tenant data, an earlier rule from the same day (spec `2026-11-03-document-trace-and-cleanup-design.md`,
"Ruling P"): files referenced by plain `*file_token` columns, platform-held files and reference
types without an `attachments` table were reported `UNSUPPORTED_REFERENCE_TYPE` and never deleted.
That refusal goes away.

## Goals

1. Deleting from the Document page (single delete and bulk delete, both token mode and filter mode)
   succeeds for every **tenant** file kind listed under "What happens at each destination".
2. Before confirming, the delete dialog shows where each file is in use ("Product image ·
   801010001", "Signature · <user name>", "BU logo · <BU name>").
3. Each delete writes one Activity entry on the owning record with the new action **`file_delete`**,
   title **"ลบไฟล์" / "File deleted"**, carrying file name, file token, who and when.
4. Where a placeholder exists today it keeps working (comment / document `attachments` JSON →
   "ไฟล์ถูกลบแล้ว" tombstone, already shipped in FE #472 / BE #987).

## Non-goals

- No placeholder on printed documents. A deleted signature or logo prints **blank**, exactly as
  today when a signature is missing (`loadSignatureBlock` → `''`, micro-report strips the slot).
  The user chose this explicitly.
- No placeholder for product / recipe images: the image just disappears from the gallery.
- No undo / trash bin. Deletes stay permanent.
- No change to who can reach the page or to the 1,000-file cap of filter-mode bulk delete.
- **Platform-wide files are not deleted from this page** (user decision): user avatar / signature,
  BU / cluster logo and avatar, news image, BU / cluster note attachments. They are shared across
  BUs (one user's signature prints on every BU they work in; news is global), so a BU admin must not
  remove them. They are managed in **carmen-backstage** (formerly carmen-platform). No change to
  carmen-backstage and no backstage Activity work in this project.

## Anti-goals (a failure even if it "works")

- A file disappears from a record and that record's Activity shows nothing.
- The UI keeps showing a broken image where a deleted product/recipe image used to be (the row or
  column must be cleared in the same operation, not left pointing at a missing file).
- The storage object is deleted while the DB reference cleanup failed (the existing "tombstone
  first, delete storage only on success" ordering must hold for the new kinds too).
- A file is deleted without the admin having seen where it was used.

## What happens at each destination

| Where the file is referenced | Cleanup in the same operation | Activity entry owner |
|---|---|---|
| `attachments` JSON in any of the ~61 attachment tables (comments, document attachments) | Replace element with tombstone (existing `tombstone`) | The source document of the row (resolve via `reference_type`/`reference_id`) |
| `tb_product_image.file_token` (child row) | Delete the row | `tb_product` |
| `tb_recipe_image.file_token` (child row) | Delete the row | `tb_recipe` |
| `tb_recipe_preparation_step_image.file_token` (child row) | Delete the row | `tb_recipe` (the step's recipe) |
| `tb_recipe_category` / `tb_recipe_cuisines` / `tb_recipe_equipment` / `tb_recipe_equipment_category` `.image_file_token` | Set column NULL | that row |
| `tb_good_received_note.signature_file_token` | Set column NULL | `tb_good_received_note` |
| Backstage `tb_user_profile.avatar_file_token` / `signature_file_token` | **Not deleted** — refused, delete stays disabled with "Managed in carmen-backstage" | — |
| Backstage `tb_business_unit` / `tb_cluster` `.logo_file_token` / `avatar_file_token` | **Not deleted** — refused, delete stays disabled with "Managed in carmen-backstage" | — |
| Backstage `tb_news.image_file_token` | **Not deleted** — refused, delete stays disabled with "Managed in carmen-backstage" | — |
| Backstage note attachment tables (`PLATFORM_ATTACHMENT_GUARD_TABLES`) | **Not deleted** — refused, delete stays disabled with "Managed in carmen-backstage" | — |
| No reference at all (direct upload from the Document page) | none | no entry (there is no owner) |

All kinds listed above come from `attachment-table-map.ts`
(`FILE_TOKEN_COLUMN_GUARDS`, `PLATFORM_FILE_TOKEN_COLUMN_GUARDS`, `PLATFORM_ATTACHMENT_GUARD_TABLES`,
`ATTACHMENT_TABLES_BY_REFERENCE_TYPE`). The reference types mapped to `tables: []`
(`recipe_preparation_step`, `news`) become deletable through the column/row rows above.

Platform rows keep today's refusal (`UNSUPPORTED_REFERENCE_TYPE` → `DOCUMENT_DELETE_UNSUPPORTED`).
If a file is referenced by both a tenant place and a platform place, the whole file is refused
(storage is shared; deleting it would break the platform reference).

A file can be referenced in more than one place (copies across comment tables, a product image that
was also attached to a comment). Every reference is cleaned up and every distinct owner gets one entry.

## Activity entry

- New value `file_delete` in `enum_activity_action` of the **tenant** Prisma schema, a tenant
  migration (`ALTER TYPE … ADD VALUE IF NOT EXISTS 'file_delete'`, runs per BU schema), and the Zod
  `AuditActionSchema` in log-events-library. *(Builder's call: also add it to the backstage enum if
  the shared Zod enum must match both DB enums — check how `AuditActionSchema` is validated.)*
- Written directly with `logTenantEvent` (not through the `ActivityInterceptor` registry),
  `entity_type` = owner table, `entity_id` = owner id.
- Payload: `meta_data` / `old_data` hold `{ file_token, file_name, size, content_type, location }`
  where `location` says which reference was removed (e.g. `product_image`, `signature`, `comment`);
  `description` is a readable sentence; actor = the deleting admin.
- FE `components/share/activity-sheet.tsx`: add `file_delete: "actionFileDeleted"` to
  `ACTION_TITLE_KEY` (messages en "File deleted", th "ลบไฟล์") and include it in the alert/destructive
  marker set. Show the file name in the entry body.

## "Where used" in the UI

- Backend returns, per file, a list of usages `{ kind, owner_type, owner_id, label }` (label already
  resolved: document number, product code, user name, BU name). The list endpoint carries it on each
  row (same best-effort pattern as `reference_exists`: lookup failure → `null`, never blocks).
- Single delete dialog: lists the usages under the file name, plus a line that the image/signature
  will disappear from those places. Bulk delete dialog: shows how many of the selected files are in
  use, with the first few usages; filter mode cannot preview every file, so it states the count only
  if the backend can return it cheaply, otherwise a generic warning.
- Preview pane: shows "Used in" in the metadata block.
- Delete buttons and checkboxes are **enabled** for every tenant file. Files held by a platform
  place keep the disabled state from the existing `delete_blocked` work, with the tooltip / reason
  changed to "Managed in carmen-backstage" (the label lists the platform usage).

## Decided by the user

- Every tenant file deletable on this page (admins only).
- Platform-wide files (avatar, user signature, BU/cluster logo, news image, note attachments): **not
  deletable here**; show where they are used and that they are managed in carmen-backstage.
- Product image: just disappears + Activity entry.
- Signature on printed documents: **left blank** (no placeholder). With platform files excluded this
  now only matters for the GRN `signature_file_token`, which has no print use today.
- Delete confirmation must say where the file is used.
- New Activity action titled "ลบไฟล์" (accepting a migration on every BU).

## Builder's calls (made by the assistant, change if wrong)

- Direct uploads with no reference write no Activity entry.
- `DOCUMENT_DELETE_UNSUPPORTED` and reason `UNSUPPORTED_REFERENCE_TYPE` stay in the catalog for
  compatibility but should no longer be produced for the kinds above.
- Order of operations per chunk: inside one tenant transaction delete child rows / null columns /
  tombstone attachments and write tenant Activity; backstage cleanup + backstage Activity in a
  backstage transaction; only then delete storage. If either DB step fails, that token's storage is
  kept and it is reported failed (`TOMBSTONE_FAILED`).
- Builder decides exact label wording and how usages are resolved (one RPC per page, batched).
- **Activity write vs. storage delete:** cleanup (row delete / column NULL / tombstone) commits in a
  tenant transaction, then the Activity entries are written with an awaited, non-buffered insert.
  If the Activity write fails, that token's storage delete is **skipped** and it is reported
  `TOMBSTONE_FAILED`: the reference is already gone, the file stays as an unreferenced row in the
  list and can be deleted again (the retry then writes no owner entry — acceptable, the first
  attempt's cleanup is already the visible change). If `logTenantEvent` cannot be awaited per call,
  insert into tenant `tb_activity` directly inside the cleanup transaction instead.
- **One entry per distinct owner**; `location` is a list of every removed reference for that owner
  (e.g. `["comment", "attachment"]`).
- **Owner not resolvable** (source row already deleted, unknown type): cleanup and delete still run,
  no Activity entry.
- **Filter-mode bulk delete:** the backend resolves the matching tokens (≤1,000) anyway, so the
  confirm dialog asks for the in-use **count** (and refused platform count) for the filter before
  confirming — no generic-only warning.
- **Tenant migration runner:** use the existing per-BU migration path; if it cannot run a
  non-transactional `ALTER TYPE … ADD VALUE`, building that is part of the plan.

## Existing work to build on

- Uncommitted branches `feature/document-delete-blocked` (backend + FE): RPC
  `DocumentAttachments.findDeleteBlocked`, list field `delete_blocked`, FE disabling. Repurpose the
  lookup into the "usages" RPC and drop the disabling; the catalog message change in that branch can
  be dropped.
- Delete pipeline: `backend-gateway/.../document-management.service.ts` (`bulkDelete`,
  `deleteDocument`) → `micro-business/src/common/attachments/document-attachments.service.ts`
  (`tombstone`) → micro-file `files.delete-many`.
- Recon notes: activity writer `packages/log-events-library/src/services/log-events.service.ts`;
  print signature `micro-business/src/common/print-report.helper.ts` (`loadSignatureBlock`) already
  degrades to blank.

## Deploy

Tenant migration on every BU schema → micro-business → gateway → FE. Allowlist: no new
api_name on the gateway (list and delete endpoints are unchanged).
