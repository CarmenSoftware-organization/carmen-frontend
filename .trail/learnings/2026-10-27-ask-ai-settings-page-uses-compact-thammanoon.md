---
title: "Ask AI settings page uses compact one-row-per-provider list showing the effective prompt, not textareas"
author: Thammanoon
date: 2026-10-27
branch: feature/ask-ai-settings-compact-rows
cost: { minutes: 6, tokens: 230298 }
id: l-f4ef0513
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/ask-ai/ask-ai-provider-card.tsx
  - routes/system-admin/ask-ai/ask-ai-component.tsx
---

## Decided
- `/system-admin/ask-ai` (routes/system-admin/ask-ai/ask-ai-provider-card.tsx): one collapsible row per provider — icon · name · Default/Customized badge · On/Off (Switch in edit mode) + 1-line preview of the *effective* prompt (bu_prompt or default_prompt). Only one row open at a time (`openCode` in ask-ai-component.tsx). User chose this so all providers fit one viewport.
- View mode shows the effective prompt read-only; edit mode shows textarea + `{items}` hint + "Start from default" / "Reset to default", and the default prompt below when customized.

## Tried and ruled out
- Keeping the original stacked cards (trimmed): still ~1 viewport per 3 providers and an empty readonly textarea in view mode hid what prompt is actually used. User rejected.

## Watch out
- Empty draft prompt still means "use default" (saved as null by buildSaveBody) — "Start from default" copies the default into the draft, which then saves as a BU override.
- The row preview is `aria-hidden`; don't move the prompt text into the trigger's accessible name.
