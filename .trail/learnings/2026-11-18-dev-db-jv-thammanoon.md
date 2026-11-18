---
title: "แท็บสมุดรายวันของใบรับของ: dev DB ไม่มีใบไหนผูก JV ต้องจำลองในโค้ดเพื่อตรวจหน้าตา และคอลัมน์ยอดเงินกว้างเท่าเนื้อหา"
author: Thammanoon
date: 2026-11-18
branch: fix/grn-detail-mobile-tablet
cost: { minutes: 6, tokens: 42609 }
id: l-bc976a52
scope: repo
status: active
src: agent
touches:
  - routes/procurement/goods-receive-note/grn-stock-table.tsx
  - routes/procurement/goods-receive-note/grn-journal-tab.tsx
---

## Decided
- 2026-11-18 การ์ด JV ในแท็บ Journal Voucher ของ GRN: ทรงการ์ดเดียวกับการ์ดอื่นของหน้า (p-3, 12px) แทน Card ของ shadcn · รหัสบัญชีบรรทัดบน ชื่อจางบรรทัดล่าง · คอลัมน์คำอธิบายมีเฉพาะเมื่อมีบรรทัดที่มีคำอธิบาย จอแคบย้ายไปใต้ชื่อบัญชี · เดบิต/เครดิตกว้างเท่าเนื้อหา (w-px min-w-24) บัญชีรับที่เหลือ

## Tried and ruled out
- ตาราง w-full ปล่อยให้เบราว์เซอร์แบ่งเอง: 1920 เดบิตลอยกลางจอห่างจากเครดิตหลายร้อย px · มือถือคอลัมน์คำอธิบายว่างกินที่จนเครดิตล้นการ์ด

## Watch out
- dev DB (BU T02) ณ 18 พ.ย. ไม่มี GRN ไหนมี ap_invoices (AP invoice ทั้ง BU มี 2 ใบ เป็น manual) — จะดูแท็บนี้ต้องจำลอง: ใส่ ap_invoices/ap_invoices_voided ปลอมก่อนเรียก useGrnJournalVouchers ใน GrnJournalTab ชี้ไป gl_jv_id ของ AP invoice ที่ posted แล้ว ติดป้าย __TEMP_VERIFY__ แล้วลบ+grep ก่อน commit
- ยังไม่ได้เห็น JV ที่บรรทัดมีคำอธิบาย (JV ทดสอบไม่มีเลย) และภาษาไทย

In the code:
- routes/procurement/goods-receive-note/grn-journal-tab.tsx — JvCard, amountCell
- JV ที่ใช้จำลอง: AP invoice APIV26110001 (a9bf25e9-…) gl_jv_id 998150ee-55e6-4f3a-b1be-3881b04ef4c3
