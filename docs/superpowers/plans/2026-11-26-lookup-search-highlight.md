# Lookup Search Highlight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ไฮไลต์คำค้นในทุกแถวของ `LookupCombobox` — ทั้งป้าย default และแถวที่ caller วาดเองผ่าน `renderItem`

**Architecture:** `LookupCombobox` ส่ง `{ query: debouncedSearch }` เป็น arg ที่สองของ `renderItem` และห่อป้าย default ด้วย `HighlightText` เดิม; caller 16 ตัวห่อรหัส + ชื่อด้วย `HighlightText` เอง

**Tech Stack:** React 19, TypeScript, Tailwind v4, Vitest

**Spec:** `docs/superpowers/specs/2026-11-26-lookup-search-highlight-design.md`

## Global Constraints

- **ไม่เขียนเทสใหม่** (user preference — ข้าม step "write failing test"); ยังต้องรัน `bun run typecheck`, `bunx eslint <files>` และเทสเดิม `bun test:run components/lookup` ให้ผ่าน
- ใช้ `HighlightText` จาก `@/components/ui/highlight-text` เท่านั้น — ห้ามตั้งสี/คลาส mark ใหม่ที่ call site
- query ที่ใช้ไฮไลต์ = `debouncedSearch` (ตัวเดียวกับที่ใช้กรอง) ไม่ใช่ `search`
- ไม่ไฮไลต์: `LocationTypeLabel`, category `Badge` ของ chart of account, `renderSelected`, `title` attribute
- **อย่า `git add package.json`** — มีการแก้ค้างของ user ไม่เกี่ยวกับงานนี้; `git add` ระบุไฟล์ทีละตัว
- commit message ภาษาไทย

## Review Focus

1. คำค้นมีอักขระ regex (`(`, `[`, `+`) — ต้องไม่ throw (`HighlightText` escape ให้แล้ว; อย่าแทนด้วย split เอง)
2. ฟิลด์เป็น `null`/`undefined` (เช่น `invoice_no`, `description_1`, `code`) — `HighlightText` รับ `string`; ส่ง `?? ""` เมื่อ type เป็น optional ห้าม cast
3. dark mode — `<mark>` ใน `Badge` secondary ต้องยังอ่านออก (ตัวดำบนเหลือง ตรึงไว้แล้วใน component)
4. ความสูงแถว virtual list คงที่ — `<mark>` ตัวหนาต้องไม่ทำให้ข้อความขึ้นบรรทัดใหม่ (ยังอยู่ใน span `truncate` เดิม)
5. server-side search ที่ match ฟิลด์ที่ไม่แสดง — แถวขึ้นโดยไม่มีไฮไลต์ (ยอมรับ ไม่ต้องแก้)

ทั้ง 5 ข้อตรวจด้วยมือใน Task 3

---

### Task 1: `LookupCombobox` ส่ง query + ไฮไลต์ป้าย default

**Files:**
- Modify: `components/lookup/lookup-combobox.tsx:73` (type), `:457-462` (render)

**Interfaces:**
- Produces: `renderItem?: (item: T, ctx: { readonly query: string }) => ReactNode` — `query` คือ `debouncedSearch` ดิบ (ยังไม่ lowercase)

- [ ] **Step 1:** เปลี่ยน type ของ prop `renderItem` ตาม Interfaces; ที่ line 458 เรียก `renderItem(item, { query: debouncedSearch })`
- [ ] **Step 2:** ป้าย default: ใน `<span className="min-w-0 truncate" title={getLabel(item)}>` แทน `{getLabel(item)}` ด้วย `<HighlightText text={getLabel(item)} query={debouncedSearch} />` (`title` คงข้อความดิบ)
- [ ] **Step 3:** Run `bun run typecheck` → ผ่าน (caller เดิมที่รับ arg เดียวยัง compatible); `bun test:run components/lookup` → ผ่าน
  - ถ้าเทสเดิมหา label ด้วย `getByText` แล้วพังเพราะข้อความถูกแยกเป็นหลาย node ตอนมีคำค้น — แก้ assertion ในเทสนั้นให้หาจาก `title`/role แทน ไม่ใช่ถอยการไฮไลต์
- [ ] **Step 4:** Commit
```bash
git add components/lookup/lookup-combobox.tsx
git commit -m "feat(lookup): ไฮไลต์คำค้นในป้ายรายการของ LookupCombobox"
```

### Task 2: caller 16 ตัวไฮไลต์รหัส + ชื่อ

**Files (Modify — เฉพาะบล็อก `renderItem={...}`):**
- `components/lookup/`: `lookup-product.tsx`, `lookup-product-in-location.tsx`, `lookup-product-location.tsx`, `lookup-location-pair-product.tsx`, `lookup-location.tsx`, `lookup-user-location.tsx`, `lookup-vendor.tsx`, `lookup-currency.tsx`, `lookup-chart-of-account.tsx`, `lookup-noti-tmpl.tsx`, `lookup-sub-category.tsx`, `lookup-item-group.tsx`, `lookup-category.tsx`, `lookup-grn-by-vendor-for-cn.tsx`
- `routes/product-management/category/category-report-dialog.tsx`, `routes/report/list/report-param-dialog.tsx`

**Interfaces:**
- Consumes: `renderItem(item, { query })` จาก Task 1; `HighlightText({ text: string, query: string })`

- [ ] **Step 1:** ทุกไฟล์: เปลี่ยน `(x) =>` เป็น `(x, { query }) =>` แล้วแทน text node ของฟิลด์ตามตารางด้วย `<HighlightText text={…} query={query} />` — wrapper/className เดิมไม่แตะ

| ไฟล์ | ฟิลด์ที่ห่อ |
|---|---|
| product, product-in-location, product-location, location, user-location, vendor, sub-category, item-group, category | `code`, `name` |
| location-pair-product | `product_code`, `product_name` |
| currency | `code`, `name` |
| chart-of-account | `code`, `description_1` (ไม่แตะ category Badge) |
| noti-tmpl | `lookupLabel(tpl)` |
| grn-by-vendor-for-cn | `grn_no`, `invoice_no` |
| category-report-dialog, report-param-dialog | `o.label` |

  ฟิลด์ที่ type เป็น optional/nullable ส่ง `?? ""`
- [ ] **Step 2:** Run `bun run typecheck` → ผ่าน; `bunx eslint components/lookup routes/product-management/category/category-report-dialog.tsx routes/report/list/report-param-dialog.tsx` → ไม่มี error; `bun test:run components/lookup` → ผ่าน
- [ ] **Step 3:** `grep -rn "renderItem={(" components routes --include='*.tsx'` แล้วยืนยันว่าทุกตัวที่ส่งให้ `LookupCombobox` รับ `{ query }` แล้ว (`paged-checklist` / pc / sc / user-assigned-roles ไม่ใช่ `LookupCombobox` — ข้าม)
- [ ] **Step 4:** Commit
```bash
git add components/lookup/lookup-*.tsx routes/product-management/category/category-report-dialog.tsx routes/report/list/report-param-dialog.tsx
git commit -m "feat(lookup): ไฮไลต์รหัสและชื่อในแถว renderItem ทั้ง 16 จุด"
```

### Task 3: ตรวจด้วยมือในเบราว์เซอร์

- [ ] **Step 1:** `bun dev` แล้วเปิดเอกสาร PR (product lookup), ฟอร์มที่มี currency และ chart of account
- [ ] **Step 2:** พิมพ์คำค้นที่ตรงทั้งรหัสและชื่อ → ส่วนที่ตรงเป็นพื้นเหลืองตัวหนาทั้งใน Badge รหัสและชื่อ; badge ประเภท location / category ไม่ถูกไฮไลต์
- [ ] **Step 3:** พิมพ์ `(` และ `[` → ไม่ crash ไม่มี error ใน console
- [ ] **Step 4:** สลับ dark mode → ไฮไลต์อ่านออก; เลื่อน list ยาว → ความสูงแถวไม่เปลี่ยน ไม่มีแถวทับกัน
- [ ] **Step 5:** เลือกรายการแล้ว → ป้ายบนปุ่มไม่มี `<mark>`
