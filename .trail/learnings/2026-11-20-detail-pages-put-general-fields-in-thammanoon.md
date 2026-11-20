---
title: "Detail pages put General fields in the header card, not a separate card"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-531a9a62
scope: repo
status: active
src: init-review
---

## Decided
- The team standardized detail headers on the PR-style document card. This replaced an earlier learning that paired General with another section, so the older rule no longer holds.
- In the code: Use `DOC_HEADER_CARD` with `inlineBack` and put General fields in the ribbon (dense text in view, `FieldGrid` inputs in edit). If `trail check` flags the old pairing learning, add a replacing learning with `--replaces`. Keep Description to one column from `@md`.

_From PRs #696, #693 here, Nov 19._
