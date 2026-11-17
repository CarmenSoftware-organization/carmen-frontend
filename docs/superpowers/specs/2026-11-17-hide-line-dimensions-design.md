# ซ่อน dimension รายบรรทัดในเอกสาร (สวิตช์ runtime) + AP ตามกฎผังบัญชี

## เหตุผล

ฟีเจอร์ dimension รายบรรทัดยังไม่พร้อมให้ลูกค้าใช้ จึงต้องซ่อนจากทุกเอกสาร แต่ทีมยังต้องทดสอบบน local/dev ได้
(งาน inventory line dimension ตามสเปก `2026-11-17-inventory-line-dimension-frontend-design.md` ใช้ gate ตัวเดียวกัน)

## เป้าหมาย / ไม่ใช่เป้าหมาย

- **เป้าหมาย**
  - PR · PO · GRN · SR · IA (stock-in/out) ไม่แสดงช่อง dimension และไม่ส่ง `dimensions` ใน payload เมื่อสวิตช์ปิด
  - AP Invoice แสดง dimension ตามกฎของผังบัญชีของบรรทัด เหมือน AR Invoice และ JV
- **ไม่ใช่เป้าหมาย**
  - ไม่แตะหน้า `/config/dimension` และการ์ด Dimension ในหน้า CoA
  - ไม่แตะ AR/JV เพราะทำตามกฎผังบัญชีอยู่แล้ว
  - การหาบัญชีจากสินค้าในเอกสารซื้อ/คลัง (ก2) บันทึกไว้ใน `2026-11-17-line-dimension-by-product-account-design.md` (backlog)
- **ห้ามเกิด**
  - ค่า dimension ที่บันทึกไว้แล้วถูกลบเพราะสวิตช์ปิด ซึ่งจะไม่เกิด เพราะการไม่ส่งค่าคือการไม่แตะค่าเดิม
  - สวิตช์ที่ไม่ได้ตั้งค่าแล้วฟีเจอร์โผล่ขึ้นมา (ค่าเริ่มต้นต้องเป็นซ่อน)

## Approaches

1. **ค่าคงที่ในโค้ด**: ง่ายที่สุด แต่ปิดทุก env รวม local/dev ทีมจึงทดสอบงาน inventory dimension ไม่ได้ — ไม่เลือก
2. **สวิตช์ runtime config `LINE_DIMENSIONS_ENABLED`**: **user เลือก** ค่าเริ่มต้นคือ `false` เปิดได้ราย env โดยไม่ต้อง build ใหม่
3. ถอด license `configuration.dimension` ทุก BU: ได้ผลกับหน้า config ด้วย และต้องทำมือทุก BU — ไม่เลือก

## Design

1. **สวิตช์**: `lib/runtime-config.ts` เพิ่ม `LINE_DIMENSIONS_ENABLED?: boolean` (อ่านเฉพาะค่า boolean แบบเดียวกับ `LICENSE_ENFORCEMENT`)
   ถ้าไม่มี = `false` ส่วน `hooks/use-line-dimensions-enabled.ts` ให้ตอบ `false` ทันทีเมื่อสวิตช์ปิด
   (ส่ง `false` เข้า `useGlDimensions` ด้วย จะได้ไม่ยิง query) และเมื่อเปิดสวิตช์ให้เงื่อนไขเดิม (license + มี dimension active) ทำงานตามเดิม
   - ตั้ง `true` ใน `public/config.local.json` และ `public/config.dev.json` (ไฟล์ถูก gitignore ต้องแก้มือ)
     ส่วน `config.sample.json` เพิ่มคีย์เป็น `false` และ `config.uat.json`/`config.prod.json` ไม่ตั้ง หรือตั้งเป็น `false`
   - Vercel ใช้ `config.prod.json` ลูกค้าจึงไม่เห็น
2. **AP Invoice** (`routes/accounting/accounts-payable/invoice/ap-invoice-lines.tsx`): `InvoiceDimensions` ใช้
   `readCoaRules()` (queryKey `coaRulesKey`) + `visibleLineDimensions()` กับบัญชีจาก `line.dr_chart_of_accounts_id`
   ตามแบบ `ArLineDimensions` ใน `ar-invoice-line-dialog.tsx:227`
   (map `gl_dimension_id/gl_dimension_value_id` → `dimension_id/dimension_value_id` ก่อนส่งเข้า helper)
   ปุ่ม "Dimensions · N" แสดงเฉพาะเมื่อมี dimension ที่มองเห็นได้อย่างน้อย 1 ตัว (รวมถึงค่าที่บันทึกไว้แล้ว)
   ถ้ายังไม่เลือกบัญชี = ไม่มีปุ่ม ส่วนนี้ไม่ผูกกับสวิตช์

## ปล่อยให้ผู้ลงมือตัดสินเอง

- วิธีได้ object `ChartOfAccount` ของบรรทัด AP (lookup ที่มีอยู่แล้ว หรือ hook `use-chart-of-account`)
- เทสต์เดิมที่ mock `useLineDimensionsEnabled` / runtime config อาจต้องปรับให้ตั้งสวิตช์เปิด
- บรรทัดในหมายเหตุ deploy (`docs/deploy.md`) ว่าต้องเติมคีย์นี้ใน config ของแต่ละ env ด้วยมือ
