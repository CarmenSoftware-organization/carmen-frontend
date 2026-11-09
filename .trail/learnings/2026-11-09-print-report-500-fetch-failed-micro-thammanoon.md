---
title: "Print report 500 \"fetch failed\" = micro-report HTTP port drift (must be 6015)"
author: Thammanoon
date: 2026-11-09
id: l-c948899c
scope: repo
status: active
touches:
  - lib/print-document.ts
---

## Decided
Local-dev gotcha: printing any document (PR/PO/GRN/...) returns
`500 {"message":"fetch failed"}` from the gateway `:4000` print-viewer endpoint
when **micro-report's HTTP server is not on port 6015**.

Chain: frontend `lib/print-document.ts` (correct) → gateway `:4000` → micro-business
`:6020` → `print-report.helper.ts` `fetch("http://localhost:${REPORT_SERVICE_HTTP_PORT}/api/{bu}/report/viewer-with-data")`.
Every consumer expects `REPORT_SERVICE_HTTP_PORT=6015`; if micro-report (Go, repo
`carmensoftware-organize/micro-report`) serves HTTP elsewhere, undici → ECONNREFUSED →
`"fetch failed"`.

Root cause seen 2026-07-24: `micro-report/.env` had `HTTP_PORT=5015` (should be 6015 —
matches `config.go` default, README, docker-compose `6015:6015`, and all backend
`.env` `REPORT_SERVICE_HTTP_PORT=6015`). Fix = set `micro-report/.env` `HTTP_PORT=6015`
+ `make run` (restart). `.env` is gitignored → local drift recurs silently.

Diagnostic: `lsof -iTCP:6015 -sTCP:LISTEN` (should show the Go `server`); confirm with
`curl -X POST http://localhost:6015/api/T02/report/viewer-with-data -d '{}'` →
`400 template_name is required` means healthy. Not a frontend bug. See app-config-list-envelope.

_From Claude Code's memory of this repo, last updated Jul 24._
