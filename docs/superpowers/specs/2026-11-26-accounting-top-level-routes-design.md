# แยก Accounting เป็นสี่โมดูลบนสุด (GL / AP / AR / Asset)

วันที่ 2026-11-26 · ขนาด: งานเล็ก (เปลี่ยน path แบบกลไก + ลบ special case ของ wrapper)

## เจตนา

ผู้ใช้มอง General Ledger, Accounts Payable, Accounts Receivable และ Asset เป็น **คนละโมดูลกันจริง ๆ**
ตอนนี้ launcher กับ sidebar แสดงแยกแล้ว แต่ URL ยังอยู่ใต้ `/accounting` และในโค้ดยังมี wrapper
`accounting` ห่อทั้งสี่ไว้ งานนี้ทำให้ URL และโครง `moduleList` ตรงกับสิ่งที่ผู้ใช้เห็น

## การเปลี่ยน path

| เดิม | ใหม่ |
|---|---|
| `/accounting` (GL dashboard) | `/general-ledger` |
| `/accounting/{journal-voucher,template-voucher,recurring-voucher,allocation-voucher,settings}[/:id]` | `/general-ledger/...` |
| `/accounting/financial-reports[/:id]` | `/general-ledger/financial-reports[/:id]` *(ผมตัดสินใจเอง)* |
| `/accounting/accounts-payable/*` | `/accounts-payable/*` |
| `/accounting/accounts-receivable/*` | `/accounts-receivable/*` |
| `/accounting/asset/*` | `/asset/*` |
| `/accounting/{cheque-reconciliation,output-tax}` (redirect เดิม) | ชี้ตรงไป `/accounts-receivable/...` |

## เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

- **เป้าหมาย:** สี่โมดูลเป็นรายการระดับบนสุดของ `moduleList` เหมือน procurement หรือ config และไม่มีโค้ดตัวไหนรู้จักคำว่า "accounting" ในฐานะโมดูลอีก
- **ไม่ใช่เป้าหมาย:** ย้ายโฟลเดอร์โค้ด (`routes/accounting/` อยู่ที่เดิม เพราะ `dashboard/` กับ `documents/` ใช้ร่วมกันสี่หมวด) · เปลี่ยน permission หรือ license key (`accounting.gl`, `accounting.ap` … คงเดิม) · เปลี่ยน endpoint ของ backend
- **ห้ามเกิด:** ลิงก์หรือบุ๊กมาร์กเก่า `/accounting/...` กลายเป็น 404 · หน้าใดหน้าหนึ่งหลุด license gating หรือ permission · sidebar หรือ breadcrumb เลือกโมดูลผิด

## แนวทางที่พิจารณา

- **A. เปลี่ยน URL + ยกเป็นโมดูลบนสุดจริง โฟลเดอร์โค้ดคงเดิม** ← **user เลือก** ผู้ใช้ได้โมดูลแยกครบ diff เป็นการเปลี่ยน path แบบกลไก
- B. แบบ A + แยกโฟลเดอร์เป็น `routes/<module>/`: ต้องย้าย dashboard, documents, `use-journal-voucher` และ `send-back-fields` ไปชั้น shared เพราะ ESLint ห้าม import ข้ามโมดูล diff ใหญ่และชนงาน AP/AR ที่กำลังทำ ผู้ใช้ไม่เห็นความต่าง
- C. เปลี่ยนแค่ URL คง wrapper: ขัดกับเจตนา และยังต้องแก้ `findAccountingSection` ให้รู้จัก prefix ใหม่

## Design

1. **`routes/router.tsx`:** แยก block `path: "accounting"` ออกเป็นสี่ block (`general-ledger`, `accounts-payable`, `accounts-receivable`, `asset`) โดยใช้ไฟล์ `lazy` ชุดเดิม และ redirect ภายใน (`preview/*`, `contract`) ชี้ไปปลายทางใหม่
2. **Redirect ของเก่า:** route `accounting/*` ตัวเดียว (loader `redirect`) แปลง path ตามลำดับต่อไปนี้ และเก็บ `search` ไว้ *(ผมตัดสินใจเอง)*
   - `accounts-payable/…` → `/accounts-payable/…`
   - `accounts-receivable/…` → `/accounts-receivable/…`
   - `asset/…` → `/asset/…`
   - path อื่นทั้งหมดรวม root → `/general-ledger/…`
3. **`constant/module-list.ts`:**
   - วางสี่ section ลงใน `moduleList` แทน wrapper `accounting`
   - ลบ `findAccountingSection` และเลิก export `accountingModuleSections` (หรือคงไว้เป็นอาร์เรย์ภายใน ถ้าเทสต์ license ยังใช้)
   - แก้ comment เรื่อง license ให้ตรงกับโครงใหม่
4. **ลบ special case `=== "accounting"`:**
   - `components/sidebar/side-main.tsx` (ทั้ง sidebarModule และ AppTile)
   - `components/navbar/module-app.tsx` (flatMap) — tile ยังใช้ภาพของ accounting ต่อได้ผ่าน `tileParentName` ถ้า AppTile ไม่มีภาพของแต่ละชื่อ *(builder ตรวจ `AppTile` แล้วเลือกทาง)*
   - `components/navbar/path-breadcrumb.tsx`
   - `routes/accounting/dashboard/accounting-dashboard.tsx` (หา section จาก pathname ด้วย `findActiveModule` แทน)
5. **ลิงก์ในโค้ดราว 114 ไฟล์:** แทน prefix ตามตารางข้างบน ครอบคลุมหน้า config ที่ลิงก์มาหน้าบัญชี, mock data, `accounting-document-model.ts` และเทสต์ ห้ามแตะ `interface/accounting/*` และ API path ที่มีคำว่า accounting
6. **เทสต์ที่มีอยู่:**
   - `constant/accounting-navigation.test.ts`, `side-main.test.tsx` และ `module-app.test.tsx` ต้องแก้ตามโครงใหม่ (เป็นการแก้เทสต์เดิม ไม่ได้เขียนเทสต์ใหม่)
   - `module-list.license-feature.test.ts` ต้องยังผ่าน
7. **รีโป `carmen-frontend-e2e`:** แก้ path ใน `tests/820-accounting-settings.spec.ts` ส่ง PR แยก
8. **ตรวจ:**
   - `bun run typecheck`, lint และ `bun test:run` ต้องผ่าน
   - `grep '/accounting'` ต้องเหลือแค่ route redirect, `interface/accounting` และ API path
   - ตรวจมือในเบราว์เซอร์: launcher สี่ tile, sidebar ของแต่ละโมดูล, breadcrumb และ URL เก่าเด้งไปที่ใหม่

## ปล่อยให้ builder ตัดสินใจ

- จะเขียน redirect เป็น loader หรือ component `Navigate`
- การเรียงลำดับสี่โมดูลใน `moduleList` (คงลำดับเดิมตรงตำแหน่งที่ wrapper เคยอยู่)
- deploy: เป็นงาน FE ล้วน ไม่ต้องรอ backend
