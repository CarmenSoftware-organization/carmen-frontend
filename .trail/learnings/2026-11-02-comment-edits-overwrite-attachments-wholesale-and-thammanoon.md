---
title: "Comment edits overwrite attachments wholesale, and @repo/file-contract is a published npm package"
author: Thammanoon
date: 2026-11-02
branch: docs/document-trace-cleanup-spec
cost: { minutes: 1, tokens: 1836 }
id: l-46ca5acc
scope: repo
status: active
src: agent
touches:
  - components/ui/comment-sheet.tsx
  - package.json
  - docs/superpowers/plans/2026-11-03-document-trace-and-cleanup.md
---

## Watch out
- 49 micro-business comment services do `updateData.attachments = updateDto.attachments` (e.g. inventory/stock-in-comment/stock-in-comment.service.ts ~244), and FE components/ui/comment-sheet.tsx ~445 resends `c.attachments` on every edit. Any server-side rewrite of an attachment element (tombstone, rename) is undone by the next message edit unless every write path merges server-side.
- `@repo/file-contract` (carmen-turborepo-backend/packages/file-contract) is consumed by micro-file as `npm:@carmensoftware-organization/file-contract@<version>`. Adding a micro-file RPC command means bumping its package.json version, merging to main (publish-packages.yml publishes only unseen versions), then bumping micro-file's dependency. It is not a workspace link.
- micro-business RPC contracts (packages/rpc-contract) are generated: write the handler with a temporary literal pattern, run `bun run gen:rpc-contract`, then swap in the generated reference.
## Decided
- Plan docs/superpowers/plans/2026-11-03-document-trace-and-cleanup.md: preserveTombstones(current, next, added) keeps a resent live element only if it is live in current or newly added, so it needs no micro-file lookup.
