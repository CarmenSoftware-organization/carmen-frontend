---
title: "Vercel prod deploys all of main, so FE work that needs an undeployed backend blocks every later FE fix"
author: Thammanoon
date: 2026-11-25
branch: main
cost: { minutes: 2, tokens: 14706 }
id: l-d25b89f9
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/workflow/wf-new-form.tsx
---

## Decided
`vercel --prod` uploads the whole local checkout, so it ships every merge since the last deploy. If main holds FE work whose backend is not up yet, any FE-only fix merged after it waits for that backend, or goes up with pages that break.

## Tried and ruled out
- Reverting the backend-dependent merges in a temp worktree: the revert of the AR Receipt merge conflicted with merges that came after it.
- Starting from the last merge before that work and cherry-picking only the FE-only fixes: the workflow new-form layout fix was written on top of the AP/AR workflow types. Taking its file whole failed typecheck in 15 places. Making it fit means writing a version of the file that no one has reviewed.

## Watch out
- Before merging FE-only polish onto a main that already has backend-dependent work, check whether the polish edits the same files. If it does, it can only ship after the backend.
- To deploy only part of main, branch FE-only fixes off the last deployed commit rather than off main.

In the code: case from 2026-11-25. #729 (routes/system-admin/workflow/wf-new-form.tsx) depends on WORKFLOW_TYPE.AP_INVOICE/AP_PAYMENT/AR_INVOICE/AR_RECEIPT from #723–#727. The recipe merges #720/#722/#728 cherry-pick cleanly onto ea33717e.
