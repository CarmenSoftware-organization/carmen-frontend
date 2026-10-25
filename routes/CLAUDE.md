# routes/

## React Compiler กับตาราง (`DataGrid`) — กับดักที่เจอซ้ำได้

TanStack table instance เป็น **reference คงที่แต่ mutate ข้างในตัวเอง** React
Compiler จึงมองว่าบล็อก JSX ที่ห่อ `<DataGrid table={table} recordCount={n}
isLoading={x}>` มี dependency คงที่ (ตัว table เดิม · จำนวนแถวรวมเท่าเดิม ·
isLoading เท่าเดิม) แล้ว **reuse ผลลัพธ์เดิมทั้งก้อน** — กดเปลี่ยนหน้าแล้ว URL
กับ query เปลี่ยนจริง แต่ตารางค้างอยู่หน้าเดิม ไม่มี request ใหม่ สั่ง re-render
ยังไงก็ไม่ขยับ (เจอจริงที่หน้า transaction: กดหน้า 3 แล้วกลับหน้า 1 ได้
`page=1` บน URL แต่ตารางยังโชว์แถว 21–30)

**แก้:** ใส่ `"use no memo";` บรรทัดแรกของคอมโพเนนต์**หน้านั้น** — directive นี้
เป็นระดับฟังก์ชัน ใส่ที่ layout แม่ไม่ตกทอดถึงลูก และใส่ใน `useXxxTable` ก็ไม่พอ
เพราะสิ่งที่ถูกแช่คือ JSX ของหน้า ไม่ใช่ตัว hook · ตัว `data-grid-table.tsx`,
`data-grid-pagination.tsx` และ `use-config-table.ts` ใส่ไว้แล้วด้วยเหตุผลเดียวกัน

หน้า list ส่วนใหญ่ยัง**ไม่ได้**ใส่และยังทำงานปกติ (ขึ้นกับรูปร่างของ JSX ล้วน ๆ)
จึงไม่ได้ไล่ใส่ยกชุด — เจอตารางค้างตอนเปลี่ยนหน้าเมื่อไร ใส่หน้านั้นทีละหน้า

**เทสต์เปิดคอมไพเลอร์ด้วยแล้ว** (`vitest.config.ts`) ของเดิมเป็น `plugins: [react()]`
เปล่า ๆ ทั้ง suite จึงรันโดยไม่มีคอมไพเลอร์มาตลอด = เทสต์ตรวจไบนารีที่ไม่มีวันได้
deploy ส่วน directive ทั้ง 194 จุดก็ไม่เคยถูกทดสอบสักครั้ง ค่าใช้จ่ายอยู่ที่ขั้น
transform (~10s → 38–54s) ส่วน wall clock ของ full run แกว่งเองอยู่แล้ว 56–80s
ทั้งก่อนและหลังเปิด วัดไม่ออกว่าช้าลงเท่าไร

**อย่าอ่านว่า "ตอนนี้มีตาข่ายแล้ว ไล่ลบ directive ได้"** — bisect จริงเมื่อ 2026-09-08
พบว่าถอดทั้ง 194 จุดแล้ว suite แดงแค่ 2 เทสต์ (`grn-group-price.test.tsx`) และสาวถึง
ต้นตอได้จุดเดียวคือ `DataGridTable` ใน `data-grid-table.tsx` ที่เหลืออีก 193 จุด
**ไม่แดงเพราะไม่มีเทสต์ไหนกดตารางในหน้านั้น** ไม่ใช่เพราะมันไม่จำเป็น เขียวจึงไม่ใช่
ใบอนุญาต — จะถอดจุดไหนต้องมีเหตุผลจากโครงโค้ด (เช่น recipe-form ที่ทั้ง tree ไม่มี
TanStack เลย) แล้วเปิดหน้ากดเองอีกที

## Backend bug: `ValidateSchema.quantity` เป็น `z.number().int()` (ไม่ใช่บั๊กฝั่ง frontend)

DB columns เป็น `Decimal(20,5)` แต่ schema ฝั่ง API เป็น `int` — `requested_qty` /
`approved_qty` / `foc_qty` ที่มีทศนิยมจะ 400 ที่ API gate ทั้งที่เก็บลง DB ได้จริง
จำนวนทศนิยมถูกต้องตามธุรกิจ (2.5 kg) กระทบทุกโมดูลที่มี qty (PR/PO/GRN/SR/CN)
ซึ่งอยู่ทั้งใต้ `procurement/` และ `store-operation/` จึงเก็บโน้ตนี้ไว้ที่ระดับ `routes/`

**วิธีแก้อยู่ฝั่ง backend:** ลบ `.int()` ออกจาก `ValidateSchema` ทั้ง 3 ชุดใน
carmen-turborepo-backend (`backend-gateway`, `micro-business`, `micro-file`)

**Frontend จงใจไม่ปัดเศษชดเชย** — ปัดเมื่อไรข้อมูลเพี้ยนทันที
