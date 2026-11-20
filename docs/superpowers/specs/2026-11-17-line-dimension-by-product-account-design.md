# (Backlog) Dimension ในเอกสารซื้อ/คลังตามกฎผังบัญชีของบรรทัด

สถานะ: **PR/PO/GRN ออกแบบแล้วใน `2026-11-20-line-dimension-by-account-mapping-design.md`** (SR/IA ยังเป็น backlog) · บันทึกไว้เมื่อ 2026-11-17 ตอนซ่อน dimension รายบรรทัด
(`2026-11-17-hide-line-dimensions-design.md`)

## ความต้องการ

ในเอกสาร PR · PO · GRN · SR · IA (stock-in/out) ให้ช่อง dimension ของบรรทัดแสดงเฉพาะ dimension ที่บัญชีของบรรทัดนั้น
ผูกไว้ในกฎผังบัญชี (`coa-dimension-rules`: mandatory/optional, ไม่แสดง prohibited) แบบเดียวกับที่ AR Invoice, JV
และ AP Invoice ทำอยู่ (`visibleLineDimensions()` ใน `routes/accounting/documents/journal-line-dimensions.ts`)

## ทำไมยังทำไม่ได้ทันที

บรรทัดของเอกสารกลุ่มนี้ไม่มีช่องผังบัญชี มีแค่สินค้ากับคลัง จึงไม่มีบัญชีให้เอากฎมาเทียบ ต้องหาบัญชีของบรรทัดจากสินค้าก่อน

## คำถามที่ยังเปิดอยู่

- บัญชีของบรรทัดได้มาจากไหน: mapping สินค้า/หมวด/item group → บัญชี (ดูงาน GL/AP account mapping) หรือ mapping ตามคลัง/cost center
- เอกสารแต่ละชนิดใช้บัญชีตัวไหน: PR/PO = บัญชีค่าใช้จ่ายหรือบัญชี inventory? GRN = inventory? SR/IA = บัญชีปลายทางของการเบิก/ปรับ?
- FE คำนวณเอง หรือให้ backend คืน `chart_of_accounts_id` / dimension ที่อนุญาตมากับบรรทัด (มี endpoint ใหม่หรือไม่)
- ถ้าเปลี่ยนสินค้าแล้วบัญชีเปลี่ยน ค่า dimension ที่เลือกไว้ซึ่งไม่ได้รับอนุญาตแล้วจะทำอย่างไร (ล้าง / เตือน / คงไว้ตามที่ helper ทำกับค่าที่บันทึกแล้ว)
- backend ควรบังคับ mandatory/prohibited ตอน save ด้วยหรือไม่ (ตอนนี้ตรวจแค่ว่าค่า valid)
- ความสัมพันธ์กับสวิตช์ `LINE_DIMENSIONS_ENABLED` ตอนเปิดให้ลูกค้าใช้
