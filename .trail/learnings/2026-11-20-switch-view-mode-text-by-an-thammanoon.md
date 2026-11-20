---
title: "Switch view-mode text by an explicit view flag, never by disabled"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-4535df23
scope: repo
status: active
src: init-review
---

## Watch out
- The disabled flag includes the pending state, so fields flashed between input and text while saving. Separately, view sections that read `form.getValues()` showed stale values after Save because the page stays open.
- In the code: Use an `isView` or `readOnly` prop to choose text versus input. Do not use `isDisabled` or `disabled`. In view-mode sections, read values with `useWatch`, not `form.getValues()`.

_From PRs #704, #684 here, Nov 19._
