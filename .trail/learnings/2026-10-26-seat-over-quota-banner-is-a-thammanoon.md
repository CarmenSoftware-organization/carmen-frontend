---
title: "Seat over-quota banner is a solid red bar on purpose — an intended exception to DESIGN.md 'avoid neon'"
author: Thammanoon
date: 2026-10-26
branch: feature/dashboard-empty-state-and-dept-notice
cost: { minutes: 1, tokens: 11024 }
id: l-9fdef048
scope: repo
status: active
src: agent
touches:
  - components/seat-quota-banner.tsx
---

## Decided
- components/seat-quota-banner.tsx: the over-quota state is `bg-destructive text-destructive-foreground` across the whole bar, bold "saving is disabled" headline plus a line telling the user to ask their BU admin or cluster admin to buy seats or deactivate users (license.seatOverQuota / seatOverQuotaAction).
- Owner decision 2026-10-26: the old neutral bg-muted bar with a red icon was easy to ignore, yet saving is blocked cluster-wide and only an admin can fix it — the bar must be loud enough for users to push their admin.
- The red is still one signal (the fill); the expiring-soon (yellow) state keeps the neutral "avoid neon" style.

## Watch out
- Do not "fix" it back to bg-muted citing DESIGN.md's single-accent rule.
