---
title: "Header fields must read errors through form state subscription, or they never turn red"
author: Thammanoon
date: 2026-11-20
standing: true
id: l-56378c22
scope: repo
status: active
src: init-review
---

## Watch out
- When fields moved into the document header ribbon, reading form errors from props did not re-render because the React Compiler memoizes the ribbon element. Save with an empty required field submitted without any red field. It bit PR Template, IA, PO, Recipe Category and Cuisine in turn.
- In the code: In any field placed in the `DOC_HEADER_CARD` ribbon, read errors with `useFormState({control})`. Do not use `form.formState.errors` passed via props. Check by saving with an empty required field and confirming it turns red.

_From PRs #702, #683 here, Nov 19._
