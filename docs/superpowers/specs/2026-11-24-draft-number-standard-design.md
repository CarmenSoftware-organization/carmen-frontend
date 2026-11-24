# Draft Number Standard (PR · SR · GRN · PO) — Design

**Date:** 2026-11-24 · **Repos:** `carmen-turborepo-backend` (micro-business + tenant Prisma
migration), `carmen-frontend-e2e` · **Status:** approved 2026-11-24
**Followed by:** `2026-11-24-ap-invoice-workflow-design.md` (project 2 reuses this helper)

## Intent

Every document that is still a draft carries a placeholder number in **one** format,
`DRAFT-` + 8-digit zero-padded running number (`DRAFT-00000001`), so drafts sort correctly as
text and are recognisable everywhere. Real running numbers are consumed only when a document
leaves draft, so the real series never has holes. (User decisions: "DRAFT- +1 เสมอ จะได้เรียงได้",
"ใช้ DRAFT +1 8 หลัก" for PR/PO/GRN, SR included.)

## Goals

1. `nextDraftNo` returns `DRAFT-%08d`; `DRAFT_NO_PREFIX = 'DRAFT-'`.
2. PR, SR, GRN keep using `nextDraftNo` (they already do) and get the new format.
3. PO drafts created by hand get a `DRAFT-…` placeholder; the real PO number is reserved at
   submit.
4. Existing `draft-N` rows in every tenant schema are rewritten to `DRAFT-%08d`.
5. Every check of "is this still a draft number" uses the one shared constant.

## Non-goals

- AP Invoice / AP Payment / other doc types (project 2 and later).
- Changing the real numbering series or running-code config.
- Renumbering existing PO drafts that already hold a real number.
- FE changes (no FE code checks the prefix — verified by grep).

## Anti-goals

- A PO or any doc ending up with two real numbers, or a real number reserved and then lost
  (the bug the comment at `purchase-order.service.ts:3343` describes).
- Period-end close treating a draft as numbered (or a numbered doc as draft) because one check
  still looks for `draft-`.
- Counter reset or reuse: the counter (`tb_application_config.value.last_no`) continues from its
  current value.

## Current state (verified 2026-11-24)

- `micro-business/src/common/helpers/draft-running-no.helper.ts`: `nextDraftNo(tx, key, user_id)`
  — advisory lock on `key`, per-tenant counter in `tb_application_config`, returns
  `draft-${n}`. `DRAFT_NO_PREFIX = 'draft-'`.
- Callers: PR (`purchase-request.service.ts:2490`, key `pr_running_no`), SR
  (`store-requisition.service.ts:853`, `sr_running_no`), GRN (`good-received-note.service.ts:2770`,
  `grn_running_no`).
- Prefix checks: GRN `good-received-note.service.ts:2795` (`GRN_DRAFT_NO_PREFIX`), period-end
  `period-end.validate.ts:192` declares its **own** `DRAFT_NO_PREFIX = 'draft-'` and
  `NUMBERED_DOC = { not: { startsWith } }` used for `pr_no`/`sr_no` and in `period-end.service.ts:918`.
- PO: `create` reserves the real number at creation (`reservePONos`, L2164); `confirmPrToPo`
  (L4764) creates POs directly as `in_progress` with real numbers; `submit` (L3312) reuses
  `po_no` and must never regenerate it. Unique index `@@unique([po_no, deleted_at])`.
- e2e (`carmen-frontend-e2e/tests`): `/draft-\d+/i` in 302:403, 701:114; literal `"draft-4"` in
  501 (several lines); comment in 720:16; `/^draft/` in 312:253, 404:289, 502:339, 702:266.

## Approaches

Only one sensible way: change the shared helper. Per-document formatters would reintroduce the
mixed formats this work removes; making checks case-insensitive instead of migrating would
leave `draft-12` and `DRAFT-00000013` side by side and break text sort.

## Design

### Helper
- `DRAFT_NO_PREFIX = 'DRAFT-'`; return `` `${DRAFT_NO_PREFIX}${String(n).padStart(8, '0')}` ``.
- Export `isDraftNo(no: string | null | undefined): boolean` (= `startsWith(DRAFT_NO_PREFIX)`)
  for code checks; Prisma filters use `{ startsWith: DRAFT_NO_PREFIX }`.
- Beyond 99,999,999 the number simply grows wider (no truncation) — acceptable.

### Prefix checks
- GRN L2795 → `isDraftNo`. Period-end: delete the local constant, import from the helper.
- Grep the backend (incl. gateway, `packages/`, and `carmen-mobile`) for `'draft-'`, `"draft-"`,
  `draft-%` once more during implementation; anything found switches to the shared constant.

### Data migration (tenant schema, Prisma migration with raw SQL)
For `tb_purchase_request.pr_no`, `tb_store_requisition.sr_no`, `tb_good_received_note.grn_no`:
```sql
UPDATE <table> SET <col> = 'DRAFT-' || lpad(substring(<col> from 7), 8, '0')
WHERE <col> LIKE 'draft-%' AND substring(<col> from 7) ~ '^[0-9]+$';
```
- Include soft-deleted rows (keeps the unique index consistent and history readable).
- Rows matching `draft-%` but not numeric: leave and report (log a count in the migration
  notes) — should be zero.
- Check other tables that copy these numbers (e.g. activity log, comments, notification
  payloads, JV descriptions); denormalised historical text is **left as-is** (my call: history
  shows what the number was at the time).

### PO
- `create` (manual, L2164): `po_no = await nextDraftNo(tx, 'po_running_no', userId)` instead of
  `reservePONos`.
- `submit`: if `isDraftNo(po.po_no)`, reserve the real number with `reservePONos(order_date, tx)`
  inside the submit transaction and write it with the status change; otherwise keep `po_no`.
  Update the L3343 comment to describe the new rule.
- `confirmPrToPo` unchanged (real numbers, `in_progress`).
- Anything that prints/emails/exports a PO (`po_no` in PDF/Excel, L5350/5558/5747/5923) works on
  any string; a draft prints `DRAFT-…` — acceptable.
- Existing PO drafts keep their real numbers.

### e2e
Update the regexes/literals listed above to the new format (`/DRAFT-\d{8}/`, `"DRAFT-00000004"`,
`/^draft/i`), and re-check any data-reset fixtures that seed `draft-N` numbers.

### Deploy order
1. Tenant migration on every env (all BU schemas) — must precede the new backend, or
   period-end would see old `draft-N` drafts as numbered.
2. Backend micro-business (gateway unchanged unless the grep finds something).
3. e2e repo merge.

No FE deploy. No allowlist change.

## Left to the builder

Migration file name and how it iterates schemas (follow the repo's existing tenant migration
pattern), test placement, exact e2e edits.
