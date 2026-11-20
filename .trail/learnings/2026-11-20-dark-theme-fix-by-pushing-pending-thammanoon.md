---
title: Dark theme fix by pushing pending colour to pure black was reverted
author: Thammanoon
date: 2026-11-20
standing: true
id: l-24f91dbe
scope: repo
status: active
src: init-review
---

## Tried and ruled out
- Lowering the done-cell background to pass contrast forced the pending background to be pushed to pure black. It passed the measuring script but read as a hole instead of 'not yet'. The fix went back to the real cause, the text colour of the done cell.
- In the code: Do not tune `--status-pending-soft` toward black in dark mode. Fix the done-cell text colour instead. Check dark-theme colours by eye in a real browser, not only with the contrast script.

_From this repo's docs._
