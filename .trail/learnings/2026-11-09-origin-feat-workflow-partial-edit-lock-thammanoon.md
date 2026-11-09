---
title: Origin/feat/workflow-partial-edit-lock holds a 637-line handover-dialog feature that…
author: Thammanoon
date: 2026-11-09
id: l-f3f178bb
scope: repo
status: active
touches:
  - vitest.setup.ts
---

## Decided
`origin/feat/workflow-partial-edit-lock` commit `82004132` (2026-09-02, Khafang) was pushed ~23 min after PR #121 merged, so it never landed on main: handover dialog before a workflow stage drops to 0 approvers (System Admin > User delete + Workflow Stages tab), `use-workflow-assignee-impact.ts`, plus a `hasPointerCapture` polyfill in `vitest.setup.ts`. Needs backend `workflows/assignees/:user_id` + handover endpoints.

**Why:** On 2026-10-21 the user chose to KEEP it during a stale-branch cleanup (the other 4 stale branches were deleted / recovered via PR #400). Deleting loses the work permanently.

## Watch out
Never delete this branch in a cleanup sweep; ask the owner (Khafang) or rebase + PR it. See stale-branch-audit-before-merge.

_From Claude Code's memory of this repo, last updated Oct 20._
