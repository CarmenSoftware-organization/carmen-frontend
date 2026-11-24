---
title: "Draft documents use DRAFT- plus an 8-digit counter, and the real number is issued only when the document leaves draft"
author: Thammanoon
date: 2026-11-24
branch: docs/draft-number-and-ap-invoice-workflow
cost: { minutes: 23, tokens: 116630 }
id: l-80885bc5
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-24-draft-number-standard.md
  - docs/superpowers/specs/2026-11-24-ap-invoice-workflow-design.md
  - docs/superpowers/specs/2026-11-24-draft-number-standard-design.md
---

## Decided
- 2026-11-24 the user set one draft-number format for PR, SR, GRN and PO, and later for AP Invoice: `DRAFT-` + 8-digit zero-padded counter (`DRAFT-00000013`). Drafts then sort correctly as text, and the real series never has holes.
- PO used to take its real number at create. The new plan gives a manual PO a draft placeholder and issues the real number at its first submit. A sent-back PO keeps the number it has. PR→PO conversion is unchanged.
- AP Invoice (next project): a document that already has a real number can never be soft-deleted, only voided. Reject from review voids the whole invoice. Send back goes to a chosen stage. By default the creator cannot approve their own invoice; a BU-level Default Setting key per module can allow it.

## Tried and ruled out
- Random hex placeholders: the user wants drafts in creation order, so the placeholder is sequential.
- Case-insensitive prefix checks instead of migrating old `draft-N` rows: that leaves two formats mixed and breaks sorting.

## Watch out
- Run the migration that rewrites old `draft-N` rows before the new backend. If it isn't applied first, period-end treats old drafts as numbered documents.
- The PO submit comment records an earlier bug: regenerating the number at submit left holes in the series. The new rule issues a real number only when `isDraftNo(po_no)` is true.

In the code:
- backend `apps/micro-business/src/common/helpers/draft-running-no.helper.ts` (`nextDraftNo`, `DRAFT_NO_PREFIX`); period-end `NUMBERED_DOC` in `period-end.validate.ts`; GRN prefix check `good-received-note.service.ts:2795`
- specs: `docs/superpowers/specs/2026-11-24-draft-number-standard-design.md`, `2026-11-24-ap-invoice-workflow-design.md`; plan `docs/superpowers/plans/2026-11-24-draft-number-standard.md`
