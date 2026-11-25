---
title: JV workflows use narrowest-scope-wins tiers and the same approve/reject/send-back rules as AP/AR
author: Thammanoon
date: 2026-11-25
branch: feature/jv-workflow-rethink
id: l-ebd870dc
scope: repo
status: active
replaces: l-88cd0563
src: agent
touches:
  - docs/superpowers/specs/2026-11-25-jv-workflow-rethink-design.md
  - docs/superpowers/plans/2026-11-25-jv-workflow-rethink.md
---

## Decided
- 2026-11-25 the user replaced the "no two JV workflow scopes may overlap" rule. An empty prefix set used to mean "every voucher", so it clashed with every other workflow and a BU could never add a second one.
- New rule, 4 tiers: (1) prefix + source, (2) prefix only, (3) source only, (4) catch-all. At submit the matching workflow with the lowest tier wins. Overlap is forbidden only inside one tier, and a BU has at most one catch-all. Tier 2 beats tier 3. That order is the author's call and lives only in the resolver, so it can be swapped later without a migration.
- JV now uses the AP/AR rules. Reject voids the whole voucher, with a reason required and no ledger effect. Send back goes to a chosen earlier stage. The creator cannot approve their own voucher unless BU key `gl.jv.allow-creator-approve` is on. Drafts are numbered `DRAFT-%08d`, and the real number is issued when the voucher first leaves draft (enters review or posts).
- Rejecting a template-generated draft deletes its template run row, so that period can be generated again. The user chose this.
- Still true from 2026-11-04: only the sources manual, recurring, allocation, amortize, reversal and closing can enter a JV workflow. A reversal is scoped by the original voucher's prefix. Scheduled auto-reverse skips the workflow.

## Tried and ruled out
- One workflow per BU, like AP: the user still needs different approvers per voucher type.
- Scoping by prefix only: the user needs different approvers per source within one prefix.
- Separate reject and send-back code inside JV: the two rule sets would drift apart, which is how this problem started.

## Watch out
- `GlPostingService.voidJv` only works on posted vouchers and backs amounts out of `tb_gl_balance`. Do not use it for reject; an unposted voucher needs its own void path.
- Subledger JVs also go through `createInternal`, so they get a DRAFT number first. `postInTx` must issue the real number, or a posted voucher keeps `DRAFT-`.
- `jv_no` is stored without the prefix. The display must not glue the prefix in front of `DRAFT-`.

In the code:
- spec `docs/superpowers/specs/2026-11-25-jv-workflow-rethink-design.md`, plan `docs/superpowers/plans/2026-11-25-jv-workflow-rethink.md`
- backend `gl/gl-jv/workflow/gl-jv-workflow-scope.ts`, `common/workflow/accounting-doc-workflow.ts`, `gl/gl-jv/gl-jv.running-code.ts`
