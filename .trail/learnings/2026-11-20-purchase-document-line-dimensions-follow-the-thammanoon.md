---
title: "Purchase document line dimensions follow the account GRN would post to, checked only when leaving draft"
author: Thammanoon
date: 2026-11-20
branch: docs/line-dimension-by-account-mapping
cost: { minutes: 1, tokens: 1792 }
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

## Tried and ruled out
- The FE computing the account itself: that would mean two resolvers that drift apart.
- Rules attached to the detail response: new or changed lines would still need a lookup.

## Watch out
- BE enforcement must be switchable per environment, separate from the FE display switch, because customers who cannot see the dimension fields would otherwise be blocked on submit by a mandatory rule.
- Lines with no resolvable account, and consignment locations, are skipped rather than blocked: incomplete mapping is the setup team's problem, not the requester's.

In the code: spec docs/superpowers/specs/2026-11-20-line-dimension-by-account-mapping-design.md · BE resolveAccountMapping (master/account-mapping/account-mapping.resolver.ts), validateLineDimensions / applyMandatoryDimensionDefaults (gl/gl-dimension/) · PO keys buildPoGroupKey / buildPoLineMergeKey in purchase-order.service.ts
