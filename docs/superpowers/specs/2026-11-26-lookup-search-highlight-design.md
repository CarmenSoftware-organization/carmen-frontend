# ไฮไลต์คำค้นใน dropdown แบบค้นได้ (LookupCombobox) — design (short)

## Intent
ตอนพิมพ์ค้นใน dropdown ให้ส่วนของข้อความในแต่ละรายการที่ตรงกับคำค้นถูกเน้นสี
คนเห็นทันทีว่ารายการนี้ติดมาเพราะคำไหน ไม่ต้องอ่านเทียบเอง — หน้าตาเดียวกับไฮไลต์
ที่ตารางสินค้า/ผู้ใช้ใช้อยู่แล้ว (`components/ui/highlight-text.tsx`)

## Scope (user ตัดสิน)
**ทุกตัว** — ตัวที่ใช้ป้าย default และตัวที่มี `renderItem` เองด้วย

## Approaches
- **A. ส่งคำค้นเป็น arg ที่สองของ `renderItem(item, { query })`** ← **เลือก** (user เลือก)
  ชัด มี type ตรวจ caller ที่ยังไม่แก้ไม่พัง; แลกกับแก้ทีละไฟล์
- B. React context + `<LookupHighlight>` อ่านคำค้นเอง — แก้ไฟล์เท่ากัน แต่ซ่อนที่มา
  ใช้นอก combobox แล้วเงียบ
- C. ไฮไลต์ระดับ DOM (CSS Custom Highlight API) — ไม่ต้องแก้ caller แต่ทำตัวหนาไม่ได้
  ต้องคำนวณใหม่ทุกครั้งที่ virtual list เลื่อน และจะติดป้ายที่ไม่ควรไฮไลต์

## Design
1. `components/lookup/lookup-combobox.tsx`
   - type: `renderItem?: (item: T, ctx: { query: string }) => ReactNode`
   - ส่ง `{ query: debouncedSearch }` ตอนเรียก `renderItem`
   - ป้าย default (`getLabel`) ห่อด้วย `<HighlightText text={getLabel(item)} query={debouncedSearch} />`
     (`title` ยังเป็นข้อความดิบ)
2. caller ที่มี `renderItem` ทั้ง **16 ตัว** — ห่อ **รหัส + ชื่อ** ด้วย `HighlightText`
   - `components/lookup/`: product, product-in-location, product-location,
     location-pair-product, location, user-location, vendor, currency, chart-of-account
     (code + description_1), noti-tmpl, sub-category, item-group, category,
     grn-by-vendor-for-cn (grn_no + invoice_no)
   - `routes/`: `product-management/category/category-report-dialog.tsx`,
     `report/list/report-param-dialog.tsx` (`o.label`)

## Decisions (my calls — ค้านได้)
- ใช้คำค้น **หลัง debounce** (ตัวเดียวกับที่ใช้กรอง) ไฮไลต์จึงตรงกับรายการที่เห็นเสมอ
- **ไม่ไฮไลต์** ป้ายประกอบ: `LocationTypeLabel`, category badge ของ chart of account
- **ไม่ไฮไลต์** ป้ายค่าที่เลือกแล้วบนปุ่ม trigger (`renderSelected`)
- server-side search ที่ match ฟิลด์ที่ไม่แสดง → รายการขึ้นโดยไม่มีไฮไลต์ ยอมรับได้
- ใช้ `HighlightText` เดิมไม่แก้สี (เหลือง + ตัวดำ อ่านออกทั้งสองธีม)

## Non-goals
- `components/ui/combobox.tsx` / `select.tsx` (ไม่ใช่ dropdown ค้นได้ตัวนี้)
- ไฮไลต์แบบไม่สนวรรณยุกต์/สระ หรือ fuzzy match — ตรงตัวอักษร ไม่สนตัวพิมพ์เล็กใหญ่ เท่านั้น

## Left to builder
- ตรวจว่า `<mark>` ใน `Badge` / แถว virtual list ที่ `truncate` ไม่ทำความสูงแถวเปลี่ยน
- type-check + lint; ตรวจมือในเบราว์เซอร์ (product lookup ใน PR, currency, chart of account) ทั้งสองธีม
