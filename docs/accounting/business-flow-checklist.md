# Accounting Business Flow Checklist (Drive FRD vs Implementation)

เอกสารนี้เปรียบเทียบ Business Flow ตามเอกสารสเปกใน [Google Drive Folder](https://drive.google.com/drive/folders/1nSKSvjF37mh8EPJTOA3AionmgnsyuczU) กับสถานะการพัฒนาปัจจุบันในระบบ Carmen Blue Frontend และ Backend APIs  
สถานะข้อมูล: **2026-09-30** (ตรวจสถานะ API เพิ่มเติมใน [API integration checklist](api-integration-checklist.md))

---

## 1. สรุปภาพรวมความพร้อมตามโมดูลหลัก (Executive Summary)

| โมดูล (Module) | เอกสารอ้างอิงหลัก (Drive FRD) | Frontend UI / Logic | Backend API (`4001`) | สรุปสถานะ |
| :--- | :--- | :---: | :---: | :--- |
| **GL — Journal Voucher** | GL JV FRD V2.14 & Fast-entry HTML | **พร้อม 90%** | **พร้อม 75%** | ทำ Fast Entry, Period Lock Guard, และต่อ API จริงเรียบร้อยแล้ว ขาด Template UI |
| **AP — Invoices** | AP Invoice FRD v4.5.06 | **พร้อม 85%** | **มี CRUD/workflow API; UI ยัง mock** | 3-Way Matching Modal & Logic เสร็จแล้ว ขาดตัวเลือกเอกสาร APDN/APCN/APDP แยกประเภท และยังไม่ต่อ `/ap-invoice` |
| **AP — Payments** | AP Payment FRD v2.16 | **พร้อม 80%** | **มี CRUD/workflow API; UI ยัง mock** | Advance Deposit Offset เสร็จแล้ว ขาด Multi-Bank Allocation และ WHT สูงสุด 3 รายการ; ยังไม่ต่อ `/ap-payment` |
| **AR — Invoices & Receipts** | AR Invoice FRD v1.07 | **พร้อม 85%** | **รอพัฒนา (0%)** | รองรับ 5 Doc Types, Reference Link, Tax Sequence แล้ว ขาด Settlement Matching UI |
| **Master Data & Config** | Master Data Specs (10 รายการ) | **พร้อม 40%** | **API ผูกกับหน้าหลักแล้ว; ยังไม่ smoke test CRUD** | COA, Bank, GL Period, JV Prefix, Dimension และ Account Groups ต่อ API แล้ว; Title/WHT ยัง mock เพราะไม่พบ master API ที่ตรง |
| **Reports & Dashboards** | Dashboard & Trial Balance Specs | **พร้อม 60%** | **พร้อม 25%** | มี Trial Balance API และ Cash Forecast Mock รอผูก API ก้อนสรุป KPI |

---

## 2. Checklist รายละเอียดแยกตามโมดูล Business Flow

### 2.1 General Ledger (GL) & Journal Voucher
*อ้างอิง: GL JV FRD V2.14*

- [x] **JV Document Lifecycle & Status**: Draft $\rightarrow$ Submitted $\rightarrow$ Approved $\rightarrow$ Posted $\rightarrow$ Void / Reversed
- [x] **Fast Entry (ตารางคีย์บอร์ดความเร็วสูง)**: ตาราง JV เป็น Fast Entry อยู่แล้ว; ปุ่ม Auto Balance (`Alt+B`) แสดงเมื่อมีรายการ transaction และใช้คีย์ลัดเพิ่มแถว (`Alt+A`)
- [x] **Period Lock Guard**: ฟอร์ม JV อ่าน `GET /api/config/{bu_code}/gl-periods` และบล็อกงวด `closed`/`locked`; API error จะไม่ให้ Save และไม่มีงวด seed แล้ว
- [x] **Real API Integration**: เชื่อมต่อ `httpJournalVoucherRepository` กับ backend endpoint `/api/{bu_code}/gl-jv` และ `/api/{bu_code}/gl-posting/` สำหรับ JV จริง; ไม่ fallback เป็นข้อมูลจำลองเมื่อ API error
- [x] **Auto-Reverse Entry**: รองรับการระบุ `reverse_date` ในงวดถัดไป และปุ่ม Reverse Document
- [ ] **JV Templates & Recurring (สิ่งที่ยังขาด)**:
  - Backend มี endpoint `/api/{bu_code}/gl-jv-templates` และ `POST .../generate-all-due` แล้ว
  - Frontend มีหน้า Template/Recurring แบบ mock; ยังไม่เชื่อม CRUD และการ generate จริง
  - UI detail ของ Template, Recurring และ Allocation ใช้ตาราง Account Code → Cost Center, All Dimensions dialog, Auto Balance และ rows/balance footer แบบ JV แล้ว (2026-10-02); Edit → Cancel คืนข้อมูลก่อนแก้ไข
- [ ] **Account-to-Dimension Mapping Validation (สิ่งที่ยังขาด)**:
  - การล็อกหรือบังคับกรอก Cost Center และ Dimension Sub-codes ตามนโยบายของผังบัญชีแต่ละตัว (COA Control)
- [ ] **Financial Reports Integration (สิ่งที่ยังขาด)**:
  - Backend มี `/api/{bu_code}/gl-reports/trial-balance` แล้ว ยังต้องเชื่อมต่อกับหน้า Report ใน Frontend

---

### 2.2 Accounts Payable (AP)
*อ้างอิง: AP Invoice FRD v4.5.06 & AP Payment FRD v2.16*

- [x] **3-Way Matching Tolerance Engine**:
  - Modal แสดงตารางเปรียบเทียบ PO ↔ GRN ↔ Billed Qty/Price
  - คำนวณผลต่าง Variance % และแสดงสถานะ `Matched`, `Tolerance Exceeded`
  - ปุ่ม Acknowledge Variance Override พร้อมบันทึกเหตุผล
- [x] **Advance Deposit Offset (หักเงินมัดจำล่วงหน้า)**:
  - Modal ให้เลือกดึงใบมัดจำ APDP มาหักลบออกจากยอดจ่าย
  - คำนวณหักลดยอดจ่ายสุทธิ (Net Outflow) อัตโนมัติ
  - ลงรายการบัญชีเครดิต Cr 1150 (เงินจ่ายล่วงหน้า) ใน Journal Preview
- [x] **Bank Account Lookup**: ช่องเลือกธนาคารใน AP Payment เรียก `/api/config/{bu_code}/bank-accounts` โดยไม่เติม seed เมื่อ API error/ว่าง
- [ ] **AP Document Types แยกประเภท (สิ่งที่ยังขาด/ต้องเพิ่ม)**:
  - ปัจจุบันหน้า AP Invoice รองรับ APIV (ใบกำกับสินค้ามาตรฐาน) เป็นหลัก
  - ต้องเพิ่มตัวเลือกสำหรับ **APDN** (ใบลดหนี้/เดบิตโน้ต), **APCN** (ใบเพิ่มหนี้/เครดิตโน้ต), และ **APDP** (ใบสำคัญจ่ายเงินมัดจำ) พร้อมช่องอ้างอิง Original Invoice
- [ ] **Multi-Bank Payment Allocation (สิ่งที่ยังขาด/ต้องเพิ่ม)**:
  - ตาม FRD v2.16 สามารถแบ่งจ่ายยอดเดียวออกจากหลายบัญชีธนาคารพร้อมกันได้ (Split Payment)
  - ปัจจุบันใน UI ยังเป็น Dropdown เลือกธนาคารเดียว ต้องขยายเป็นตารางกำหนดสัดส่วน/จำนวนเงินแต่ละธนาคาร
- [ ] **WHT Multi-Service Items (สิ่งที่ยังขาด/ต้องเพิ่ม)**:
  - FRD ระบุให้รองรับการหักภาษี ณ ที่จ่าย ได้สูงสุด 3 รายการต่อ voucher (เช่น ค่าบริการ 3% ร่วมกับค่าขนส่ง 1%)
  - ปัจจุบันมีให้กรอกได้ 1 รายการ WHT
- [ ] **Real-time Duplicate Vendor Invoice Warning (สิ่งที่ต้องเพิ่ม)**:
  - แจ้งเตือนทันทีบนฟอร์มขณะพิมพ์ เมื่อพบ Vendor Code + Invoice No. ซ้ำในระบบ
- [ ] **Frontend AP API Integration**:
  - Swagger มี `/api/{bu_code}/ap-invoice` และ `/api/{bu_code}/ap-payment` รวม CRUD/workflow แต่ GET detail ยังไม่มี invoice lines / payment allocations จึงคงฟอร์ม AP แบบ mock ตามที่โอมเลือก

---

### 2.3 Accounts Receivable (AR)
*อ้างอิง: AR Invoice FRD v1.07*

- [x] **5 Document Types Lifecycle**:
  - รองรับ `ARIV` (Invoice), `ARCN` (Credit Note), `ARDN` (Debit Note), `ARDP` (Advance Deposit), `ARRC` (Receipt)
  - คอลัมน์ Doc Type Badge, แท็บฟิลเตอร์, และ Dropdown สร้างเอกสารแยกประเภท
- [x] **Original Invoice Reference**:
  - ช่องเลือกรหัสเอกสารเดิมสำหรับใบลดหนี้ (ARCN) เพื่อปรับปรุงยอดลูกหนี้ได้อย่างถูกต้อง
- [x] **Automated Tax Invoice Sequence**:
  - สร้างเลขที่ใบกำกับภาษีอัตโนมัติตามประเภท (`TXIV`, `TXCN`, `TXDN`, `TXDP`, `TXRC`) แยกจากเลขที่เอกสารภายใน
- [ ] **Settlement Matching Matrix (สิ่งที่ยังขาด/ต้องเพิ่ม)**:
  - หน้าต่าง/แท็บจับคู่ตัดหนี้: การนำใบเสร็จรับเงิน (ARRC) หรือเงินมัดจำ (ARDP) มาคลิกเลือกจับคู่ตัดยอดกับ Invoice (ARIV) ทั้งแบบจ่ายเต็มจำนวนและ Partial Settlement
- [ ] **PMS Folio Integration (สิ่งที่ต้องเพิ่ม)**:
  - ขยายการดึงข้อมูล Guest Folio / City Ledger จากระบบ PMS หลังการทำ Night Audit ป้องกันการบันทึกซ้ำซ้อน
- [ ] **Backend AR APIs (สิ่งที่ขาดฝั่ง Backend)**:
  - Backend ยังไม่มี endpoint ตระกูล `/api/{bu_code}/ar-*` บน Swagger

---

### 2.4 Accounting Master Data & Configuration
*อ้างอิง: Master Data FRDs (10 รายการ)*

- [x] **Chart of Accounts (COA)**: ใช้งาน API จริง `/api/config/{bu_code}/chart-of-accounts` สมบูรณ์
- [x] **Bank Accounts**: หน้า Config และ lookup ใช้ API จริง; ยังไม่ได้ smoke test CRUD runtime
- [x] **GL Periods & Lock**: หน้า Config และฟอร์ม JV ใช้ API จริง; ยังไม่ได้ smoke test runtime
- [ ] **Titles (คำนำหน้าชื่อ)**: หน้า Config mock; ไม่พบ `/api/config/{bu_code}/titles` ใน Swagger รุ่นนี้
- [x] **Account Code Grouping (L1-L4 Tree)**: หน้า Config และ COA ใช้ `/api/config/{bu_code}/gl-account-groups`; ยังไม่ได้ smoke test CRUD runtime
- [x] **Dimensions & Sub-codes**: หน้า Config, COA และ JV ใช้ `/api/config/{bu_code}/gl-dimensions` และ `/gl-dimension-values`; smoke test Create/Read/Update ผ่านบน `CARMEN-AVG` (2026-09-30) แต่ Delete ติด backend `Unknown argument deleted_at`; JV เลือกค่าได้ แต่ Save พร้อม Dimension ติด backend `Unknown argument updated_by_id` (Save โดยไม่ใส่ Dimension ผ่าน)
- [x] **JV Prefix Management**: หน้า Config ใช้ `/api/config/{bu_code}/gl-jv-prefixes`; ยังไม่ได้ smoke test CRUD runtime
- [ ] **Payment Types Master (สิ่งที่ยังขาด)**:
  - หน้ากำหนดประเภทการชำระเงิน (Transfer, Cheque, Credit Card, Cash) และเงื่อนไขบัญชี
- [ ] **WHT Service Types & Forms Master (สิ่งที่ยังขาด)**:
  - กำหนดประเภทเงินได้บริการ ภ.ง.ด. 3, 53 และอัตราภาษี 1%, 2%, 3%, 5%
- [ ] **Asset Categories (สิ่งที่ยังขาด)**:
  - กำหนดหมวดหมู่ทรัพย์สิน อายุการใช้งาน และผังบัญชีค่าเสื่อมราคา 3 ขา

---

## 3. สรุปแผนงานที่ต้องทำต่อไป (Recommended Next Steps)

### ระยะสั้น (Frontend Enhancements):
1. **AP Multi-Document Selector**: เพิ่มตัวเลือกเอกสาร `APIV`, `APCN`, `APDN`, `APDP` ในหน้า AP Invoice เช่นเดียวกับที่ทำใน AR
2. **AP Multi-Bank & Multi-WHT**: ขยายฟอร์ม AP Payment ให้รองรับการกระจายยอดจ่ายหลายธนาคาร (Split Allocation) และเลือกหัก WHT ได้สูงสุด 3 รายการ
3. **AR Settlement Matching Modal**: ทำตารางจับคู่ตัดหนี้ระหว่าง Receipt/Deposit กับ Invoices
4. **GL Recurring / Template UI**: สร้างหน้าเชื่อมต่อกับ `/api/{bu_code}/gl-jv-templates` ที่มีบน backend อยู่แล้ว

### ระยะกลาง (Backend Collaboration Required):
1. ให้ backend เพิ่ม invoice lines / payment allocations ใน AP GET detail แล้วจึงเชื่อมฟอร์ม **AP Invoices & Payments** และทดสอบ workflow จริง
2. เปิด Controller สำหรับ **AR 5 Document Types & Settlement** ตาม spec FRD v1.07
3. เพิ่ม Master Data Endpoints สำหรับ WHT และ smoke test Config masters ที่เพิ่งเชื่อม API
