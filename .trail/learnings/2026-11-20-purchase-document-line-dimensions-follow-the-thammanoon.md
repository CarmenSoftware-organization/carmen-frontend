---
title: "Purchase document line dimensions follow the account GRN would post to, checked only when leaving draft"
author: Thammanoon
date: 2026-11-20
branch: docs/line-dimension-by-account-mapping
cost: { minutes: 8, tokens: 30575 }
id: l-f1ca476e
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-20-line-dimension-by-account-mapping-design.md
---

## Decided
2026-11-20 the user chose: PR, PO and GRN lines take their account from the GL account mapping for the grn movement (location × item group), so dimensions entered on a PR match what GRN posts. Draft save never checks. FE and BE both check at PR submit, PO submit and GRN draft→saved, using one shared backend function, which also backs a new endpoint the FE uses to filter fields.
The user confirmed that a PO is split by vendor → currency → delivery date → product → location → dimension, so one PO line has one location and one dimension set.
2026-11-20 while designing line-dimension checks: any check meant for "when a document leaves draft" has to sit on every path out of draft, not just submit. A PO converted from a PR is created already in progress and never goes through PO submit, so a check placed only on submit misses every PR-sourced PO. A GRN goes draft to saved on save (it gets its real number), then saved to committed on commit or approve, which is where stock, JV and the auto AP invoice happen. A saved GRN can still be edited.

## Tried and ruled out
- The FE computing the account itself: that would mean two resolvers that drift apart.
- Rules attached to the detail response: new or changed lines would still need a lookup.
- Assuming that PR-to-PO conversion creates drafts. It does not: the manual PO create does, the conversion does not.
- Assuming that a GRN posts stock when it moves to saved. Posting happens at commit/approve.

## Watch out
- BE enforcement must be switchable per environment, separate from the FE display switch, because customers who cannot see the dimension fields would otherwise be blocked on submit by a mandatory rule.
- Lines with no resolvable account, and consignment locations, are skipped rather than blocked: incomplete mapping is the setup team's problem, not the requester's.

In the code: spec docs/superpowers/specs/2026-11-20-line-dimension-by-account-mapping-design.md · BE resolveAccountMapping (master/account-mapping/account-mapping.resolver.ts), validateLineDimensions / applyMandatoryDimensionDefaults (gl/gl-dimension/) · PO keys buildPoGroupKey / buildPoLineMergeKey in purchase-order.service.ts
Manual PO and manual GRN take the same paths minus the source document, so they are covered by submit and save. Their lines get dimensions entered for the first time there.

In the code: BE micro-business PurchaseOrderService.create (draft) vs confirmPrToPo (in_progress) in procurement/purchase-order/purchase-order.service.ts · GoodReceivedNoteLogic.save / commit / approve / postReceipt in inventory/good-received-note/good-received-note.logic.ts
