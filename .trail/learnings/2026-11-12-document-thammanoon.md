---
title: "ตารางหน้า Document: คอลัมน์สั้นกว้างคงที่ ชื่อไฟล์ยืด และซ่อนคอลัมน์รองตามความกว้างของกล่องตาราง"
author: Thammanoon
date: 2026-11-12
branch: feature/document-list-columns
cost: { minutes: 11, tokens: 88230 }
id: l-8eb72736
scope: repo
status: active
src: agent
touches:
  - routes/system-admin/document/use-document-table.tsx
  - routes/system-admin/document/document-component.tsx
  - routes/system-admin/document/document-summary-bar.tsx
  - components/ui/data-grid/data-grid-table.tsx
---

## Decided
หน้า Document (2026-11-13) ตารางมีข้อมูล 6 คอลัมน์ ซึ่งใส่ไม่พอในกล่อง 662px ที่จอ tablet ไม่ว่าจะตั้งขนาดอย่างไร จึงให้ตารางเลือกชุดคอลัมน์จากความกว้างของกล่องตัวเอง: กล่องแคบลงซ่อนผู้อัปโหลดก่อน แล้วชนิดไฟล์ แล้วเลขลำดับ คอลัมน์สั้นกว้างคงที่ ชื่อไฟล์เป็นตัวเดียวที่ยืด ของที่ซ่อนยังดูได้ทางอื่น: ชนิดไฟล์กลายเป็นไอคอนหน้าชื่อ ผู้อัปโหลดอยู่ในมุมมอง preview แถบสรุปเหนือตารางเอายอดรวมกับรายการแจกแจงมาอยู่ติดกันชิดซ้าย

## Tried and ruled out
- ซ่อนคอลัมน์ด้วย CSS (container query บนหัวและเซลล์): ใช้ไม่ได้กับตารางที่มีคอลัมน์ยืด เพราะความกว้างขั้นต่ำของตารางคิดจากผลรวมขนาดของทุกคอลัมน์ที่ตารางถือว่าเปิดอยู่ คอลัมน์ที่ซ่อนด้วย CSS ยังถูกนับ ตารางจึงล้นเหมือนเดิม ต้องปิดคอลัมน์ผ่านสถานะการมองเห็นของตารางเอง
- ตั้งจุดเปลี่ยนขั้นเท่ากับผลรวมขนาดพอดี: พอกล่องกว้างเลยจุดนั้นนิดเดียว คอลัมน์รองกลับมาแล้วชื่อไฟล์หดเหลือขั้นต่ำ (ที่จอ 1280 ชื่อเหลือ 188px แคบกว่าที่จอ 1180) จึงตั้งจุดเปลี่ยนให้สูงกว่าผลรวม จนชื่อไฟล์ได้ราว 230–250px ก่อนคอลัมน์รองจะกลับมา

## Watch out
- บนจอกว้าง ชื่อไฟล์เป็นคอลัมน์ที่ยืด จึงมีที่ว่างระหว่างชื่อกับคอลัมน์ถัดไป (ราว 570px ที่ 1920, ราว 2,500px ที่ 4K) ทางเลือกที่เสนอผู้ใช้ไว้แต่ยังไม่ได้ตอบ: ชื่อไฟล์กว้างคงที่ราว 320px แล้วให้คอลัมน์วันที่รับที่เหลือ
- ก่อนวัดความกว้างครั้งแรก ตารางโชว์ครบทุกคอลัมน์ชั่วครู่ ยังไม่ได้ตรวจ skeleton บนกล่องแคบ
- เพิ่มหรือเปลี่ยนขนาดคอลัมน์ต้องคิดผลรวมของแต่ละขั้นใหม่ และวัดที่ 768, 1024, 1180, 1280, 1366 ไม่ใช่แค่ 5 ขนาดมาตรฐาน เพราะขั้นเปลี่ยนในช่วงนั้น

In the code:
- `routes/system-admin/document/use-document-table.tsx` — `columnTier()`: ผู้อัปโหลด ≥1060, ชนิด ≥890, เลขลำดับ ≥800 · ผลรวม size ต่อขั้น 980 / 840 / 740 / 640 · `columnVisibility` ใน state ของ `useReactTable`
- `routes/system-admin/document/use-element-width.ts` — ResizeObserver คืน `[setElement, width]`
- `routes/system-admin/document/document-component.tsx` — `<div ref={setGridBox}>` ครอบ DataGrid ของมุมมอง list ส่ง `gridBoxWidth - 2` (ขอบของ DataGridContainer)
- `routes/system-admin/document/document-summary-bar.tsx` — `@container` + `@xl:flex-row` ไม่มี justify-between
- `components/ui/data-grid/data-grid-table.tsx` — `growMinWidth = table.getTotalSize()`
