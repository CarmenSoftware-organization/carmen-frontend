# Running Code: แสดงทุกรายการด้วย lazy load (desktop)

**ขนาดงาน:** งานเล็ก แก้หน้าเดียว

## ทำไม
ผู้ใช้ไม่อยากกดเปลี่ยนหน้าในหน้า `/system-admin/running-code` อยากเห็นทุกรายการในตารางเดียว
ขอบเขตคือ**หน้านี้หน้าเดียว** ไม่ทำเป็นของกลางให้ `DataGrid`

## เป้าหมาย / ไม่ใช่เป้าหมาย
- เป้าหมาย: desktop ไม่มีแถบแบ่งหน้า เลื่อนถึงท้ายตารางแล้วโหลดชุดถัดไปจนครบ
- ไม่ใช่เป้าหมาย: ทำตัวกลางให้หน้า config list อื่น · เปลี่ยน mobile (เป็น lazy load อยู่แล้ว)
- ห้ามเกิด: ตารางค้างตอน sort/search (กับดัก React Compiler ใน `routes/CLAUDE.md`) · แถวซ้ำหรือหาย

## Approaches
- **A. ใช้ `useGridPagination` บน desktop ด้วย + sentinel ท้าย scroll area** ← เลือกทางนี้ ใช้ของที่มีอยู่และเป็น lazy load จริง
- B. ดึงทุกหน้าต่อกันเองตอนเปิดหน้า: ไม่ lazy และยิง request เปล่า ๆ
- C. perpage ใหญ่ + ซ่อนแถบแบ่งหน้า: เกินเพดานแล้วแถวหายเงียบ

## Design
- `running-code-component.tsx`: ใช้ `useGridPagination` ทุกขนาดจอ (`enabled: true`) เลิกเรียก `useRunningCode` ตรง ๆ แถวมาจาก `grid.items` ส่วน count มาจาก `grid.totalRecords`
- เอา `<DataGridPagination />` ออก แล้ววาง `<div ref={grid.sentinelRef}>` ไว้ท้าย `DataGridScrollArea` พร้อม spinner ตอน `isLoadingMore`
- ส่ง `params` ที่ตั้ง `page: 1` ให้ `useRunningCodeTable` เพื่อให้เลขลำดับ (`indexColumn`) นับต่อเนื่อง 1..N
- sort/search ยังเป็นแบบ server-side ผ่าน `tableConfig`/params ส่วน hook รีเซ็ตกลับชุดแรกเองเมื่อ params เปลี่ยน
- ใส่ `"use no memo";` ในคอมโพเนนต์ (แถวมาจาก state ที่สะสม ตามกับดักใน `routes/CLAUDE.md`)
- Error/retry ใช้ `grid.error` / `grid.refetch` ส่วน export ไม่ต้องแก้

## ให้คนทำตัดสินเอง
- ขนาดชุด (ค่าเริ่มต้น 20 จาก hook) · หน้าตา spinner ท้ายตาราง
