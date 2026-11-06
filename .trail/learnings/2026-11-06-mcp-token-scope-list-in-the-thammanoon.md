---
title: MCP token scope list in the web app is a hand-copied mirror of the backend list
author: Thammanoon
date: 2026-11-06
branch: feature/mcp-token-scope-picker
cost: { minutes: 1, tokens: 28152 }
id: l-54213698
scope: repo
status: active
src: agent
touches:
  - types/mcp-token.ts
  - routes/profile/mcp-token-scopes.ts
  - routes/profile/mcp-token-create-dialog.tsx
---

## Decided
The token-create form lists MCP scopes from a hard-coded copy in the frontend; there is no shared package between carmen-frontend and the backend. Read scopes are pre-checked (same as the backend default when no scopes are sent); write and API-bridge scopes start unchecked because the backend never grants them by default.

## Watch out
Adding a scope on the backend does not make it appear in the form. Add it to the type, the group list, and en/th messages in the frontend too, or users can only get it by calling the API directly. The backend rejects `scopes: []` with 400, so the form requires at least one.

In the code:
- frontend: types/mcp-token.ts (McpTokenScope), routes/profile/mcp-token-scopes.ts (MCP_SCOPE_GROUPS), messages/{en,th}.json keys scope_<group>_<name> (":" replaced by "_")
- backend source of truth: packages/prisma-shared-schema-backstage/src/mcp-token.ts (MCP_READ_SCOPES / MCP_WRITE_SCOPES / MCP_EXPLICIT_SCOPES)
