---
title: Ask AI providers come from backend; FE before BE disables the button in every BU
author: Thammanoon
date: 2026-10-27
branch: main
cost: { minutes: 88, tokens: 482071 }
id: l-b6d78c11
scope: repo
status: active
src: agent
touches:
  - routes/procurement/purchase-request/ai/pr-ask-ai-menu.tsx
  - routes/procurement/purchase-request/ai/use-ask-ai-providers.ts
  - routes/system-admin/ask-ai/ask-ai-component.tsx
  - routes/system-admin/ask-ai/ask-ai-provider-card.tsx
  - components/icons/provider-icons.tsx
  - constant/module-list.ts
  - messages/en.json
  - messages/th.json
  - routes/router.tsx
---

## Decided
- Ask AI providers/prompts are data now: `routes/procurement/purchase-request/ai/use-ask-ai-providers.ts` reads `GET /api/:bu_code/ask-ai/providers`; per-BU override page is `routes/system-admin/ask-ai/`. Hard-coded `ai-providers.ts` was deleted on purpose — don't bring constants back as a fallback.
- Menu (`pr-ask-ai-menu.tsx`) is disabled while loading / on error / non-array response, and renders nothing when the list is empty. That is intentional: a silent fallback would hide a broken backend.
- Per-BU settings live in app-config key `ask_ai`, but the generic `/app-config/ask_ai` returns 422 by design (it would bypass `system_admin.business_unit.update`). Always go through `/api/config/:bu_code/ask-ai`.

## Watch out
- Deploy order: platform migration `20261027120000_add_ai_provider` → micro-cluster → gateway → backstage → FE. FE first = Ask AI button disabled in every BU, no error shown.
- Backend micro-cluster `findAll` must return `Result.ok({ data })`; a bare array makes the gateway read `[]` and Ask AI vanishes silently.
- `{query}` in a URL template must come after `?`/`#`; no `{query}` (or URL > 8000 chars) = prompt copied to clipboard instead.
