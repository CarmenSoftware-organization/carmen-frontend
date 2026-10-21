# Accounting Foundation

## 1. เป้าหมาย

สร้างฐานร่วมสำหรับ General Ledger, Accounts Payable, Accounts Receivable และ Fixed Assets โดยใช้ master data และ platform services ที่มีอยู่ใน Carmen Blue ให้มากที่สุด แต่แยกข้อมูลที่ต้องมี accounting integrity ออกมาให้ Accounting เป็นเจ้าของ

Foundation ต้องทำให้ทุก subledger ใช้กฎเดียวกันสำหรับ:

- Chart of Accounts และ account validation
- Accounting period และ posting date
- Debit/Credit และ functional currency
- Accounting dimensions
- Approval, posting, reversal และ audit trail
- Source-document traceability
- Idempotency และ optimistic concurrency

## 2. Non-goals ของระยะแรก

- AP invoice/payment, AR invoice/receipt และ Fixed Asset register
- Consolidation ข้ามนิติบุคคล
- Budget preparation และ budget version management
- Financial report builder เต็มรูปแบบ
- AI-generated journal

Budget check ใน Journal Voucher สามารถอ่านข้อมูลจาก budget service ในอนาคตได้ แต่ Foundation ระยะแรกไม่สร้าง budget engine

## 3. Accounting boundaries

### Shared Carmen Blue data

ข้อมูลต่อไปนี้เป็น master data กลางและไม่ควรสร้างสำเนาใหม่ใน Accounting:

- Business Unit
- Currency
- Exchange-rate catalogue
- Department
- User, Role และ Workflow
- Tax profile พื้นฐาน
- Running-code configuration

Accounting เก็บ foreign key ไปยัง master data เหล่านี้ และ snapshot เฉพาะค่าที่จำเป็นต่อการตรวจย้อนหลัง เช่น currency code, exchange rate, account code และชื่อ source document

### Accounting-owned data

- Chart of Accounts และ account hierarchy
- Journal header/lines
- Applied exchange-rate snapshot
- Accounting dimensions และค่าที่อนุญาตต่อ account
- Posting batch/event และ ledger entries
- Period close/reopen history
- Auto-reversal instruction และ generated reversal JV
- Tax/WHT accounting detail และ account mapping
- Source-to-journal posting mapping

## 4. Reuse Existing Carmen Blue Services

สถานะในตารางอ้างอิงจากโค้ด frontend ปัจจุบัน ต้องยืนยัน API/schema กับ backend ก่อน implementation

| Capability เดิม | หลักฐานในระบบ | แนวทาง | Accounting requirement เพิ่มเติม |
| --- | --- | --- | --- |
| Business Unit | `types/business-unit.ts`, `hooks/use-business-unit.ts` | **Reuse** | ใช้ `default_currency_id`, timezone, date format, `amount_format.locales` และ BU isolation; ต้องกำหนดว่า BU หนึ่งรายการเท่ากับ accounting entity หรือไม่ |
| Currency master | `types/currency.ts`, `hooks/use-currency.ts`, `LookupCurrency` | **Reuse** | ใช้ code, symbol, `decimal_places` และ active status; ห้ามลบหรือเปลี่ยน precision ของ currency ที่มี ledger history โดยไม่มี controlled migration |
| Exchange rate | `types/exchange-rate.ts`, `hooks/use-exchange-rate.ts` | **Extend** | เดิมมี currency, `at_date`, rate และ audit; ต้องเพิ่ม rate type/source/approval และ API สำหรับ resolve rate by date |
| Department | `types/department.ts`, `hooks/use-department.ts`, `LookupDepartment` | **Reuse** | ใช้เป็น dimension หลัก; `department.account_code` เป็นรหัส mapping ภายนอก ไม่ใช่ GL account โดยอัตโนมัติ |
| Period | `types/period.ts`, `hooks/use-period.ts` | **Reuse if semantics match** | เดิมมี fiscal year/month, start/end และ open/closed/locked; ต้องยืนยันว่า period เดิมใช้ร่วมกับ Accounting ได้โดยไม่ให้ Inventory เปิด/ปิดงวดบัญชีโดยไม่ได้รับสิทธิ์ |
| Running code | `types/running-code.ts`, `hooks/use-running-code.ts` | **Extend** | ใช้ engine/config เดิม แต่เพิ่ม sequence ต่อ BU, prefix, journal type และ fiscal period; number allocation ต้อง atomic |
| Tax profile | `types/tax-profile.ts`, `hooks/use-tax-profile.ts` | **Extend** | เดิมมีชื่อและ tax rate; Accounting ต้องมี input/output tax account, WHT type/account, effective dates และ tax document data |
| Workflow | `types/workflows.ts`, `hooks/use-workflow.ts` | **Reuse/Extend** | เป็น optional configuration ต่อ BU/journal type; เมื่อเปิดให้ใช้ workflow designer/stage approval เดิมและเพิ่ม document type `journal_voucher` |
| Activity log | `hooks/use-activity-log.ts`, `components/share/activity-sheet.tsx` | **Reuse/Extend** | ลงทะเบียน JV ใน backend activity registry; เพิ่ม action submit/approve/reject/post/schedule/reverse/void/retry |
| Auth/HTTP/BU context | `lib/auth`, `lib/http-client.ts`, `useBuCode` | **Reuse** | API ทุกตัวต้องบังคับ BU scope และ permission ฝั่ง backend ไม่เชื่อ frontend อย่างเดียว |
| i18n/design/DataGrid | `messages/{en,th}.json`, `docs/DESIGN.md`, `components/ui/data-grid` | **Reuse** | UI ต้อง bilingual, dense ERP style, keyboard-accessible และ server-side pagination/filter/sort |
| Attachments | UI เอกสารเดิมและ `micro-file` ใน system architecture | **Verify then reuse** | ใน frontend ยังไม่พบ generic JV attachment abstraction; ต้องยืนยัน API, permission, virus/content validation และ retention ก่อนออกแบบ |
| Budget control | ยังไม่มี shared budget engine ที่ยืนยันได้ใน repo นี้ | **New/Integrate later** | GL ส่ง account+department+period+dimensions ให้ budget service และแสดง Posted/Pending/Current/Remaining |

### Exchange-rate guardrails

`Currency.exchange_rate` เป็น display/current rate และไม่เพียงพอสำหรับ ledger ส่วน `ExchangeRateItem` มีอัตราตามวันที่แล้ว จึงใช้เป็นต้นทางได้เมื่อเพิ่ม contract สำหรับ Accounting

Calculation utilities ปัจจุบันใน `lib/currency-utils.ts` ใช้ JavaScript `number`, `round2()` และการแสดง amount 2 ตำแหน่ง จึง reuse ได้เฉพาะงานแสดงผลที่ไม่ใช่ source of truth ห้ามใช้เป็น accounting arithmetic

เมื่อสร้างหรือ post journal line ต้องเก็บ snapshot อย่างน้อย:

```text
transaction_currency_id
transaction_currency_code
foreign_debit / foreign_credit
exchange_rate
rate_date
rate_type
rate_source
functional_currency_id
functional_debit / functional_credit
```

การแก้ exchange rate master ภายหลังต้องไม่เปลี่ยน journal หรือ ledger ที่ post แล้ว

### Decimal and rounding contract

- API รับ/ส่ง amount และ exchange rate เป็น decimal string ห้ามใช้ JSON number เป็น canonical value
- Database ใช้ `DECIMAL/NUMERIC`; frontend/backend ใช้ decimal arithmetic library ห้ามคำนวณ ledger ด้วย binary floating point
- Transaction amount validate และปัดตาม `Currency.decimal_places`
- Exchange rate เก็บ precision อย่างน้อย 10–12 decimal places โดยไม่ใช้ค่าที่ format เพื่อแสดงผลกลับมาคำนวณ
- Functional amount คำนวณและปัดต่อ Journal Line ด้วย precision ของ functional currency และ rounding mode `HALF_UP`
- JV และ Batch control totals รวมจาก functional amounts ที่ปัดระดับ line แล้ว
- Transaction-currency totals ต้องแยกตาม currency ห้ามรวมคนละสกุลเป็นยอดเดียว
- JV บังคับสมดุลที่ functional currency; transaction-currency totals ไม่จำเป็นต้องสมดุลแยกสกุลเมื่อมี FX conversion/clearing
- ผลต่างจากการปัดต้องเป็น explicit Rounding Adjustment line ไปยังบัญชีที่ BU กำหนด ห้ามปรับยอด line อื่นหรือซ่อน variance
- ระบบสร้าง Rounding Adjustment อัตโนมัติได้เฉพาะเมื่อ variance ไม่เกิน `rounding_tolerance`; หากเกินให้ validation fail
- Auto-Reverse ต้องคัดลอก Functional Amount และ Rounding Adjustment เดิมแล้วสลับ Debit/Credit เพื่อหักล้าง original ครบ

### Number-format ownership

Number Formats ใน Company Profile ใช้ร่วมกับ Accounting สำหรับการแสดงผล แต่ไม่ใช่ calculation policy

| Owner | Setting | Accounting usage |
| --- | --- | --- |
| Company Profile | `amount_format.locales` | รูปแบบตัวคั่นหลักพัน/ทศนิยมในการแสดงผล |
| Company Profile | `default_currency_id` | functional currency ของ BU ก่อนเริ่มมี ledger |
| Currency master | `decimal_places` | precision ของ transaction และ functional currency |
| Accounting Settings | `rounding_mode` | Phase 1 ใช้ `HALF_UP` |
| Accounting Settings | `rounding_tolerance_minor_units` | default 1 minor unit ของ functional currency |
| Accounting Settings | `rounding_account_id` | บัญชีสำหรับ explicit Rounding Adjustment |
| Accounting Settings | `exchange_rate_precision` | precision สำหรับเก็บ/คำนวณ rate อย่างน้อย 10–12 ตำแหน่ง |

`amount_format.minimumIntegerDigits` ไม่ใช่จำนวนทศนิยมและห้ามนำมาใช้เป็น accounting precision; UI ปัจจุบันซ่อน field นี้สำหรับ amount อยู่แล้วเพราะ formatter ไม่ได้อ่านค่า

- เปลี่ยน locale ได้โดยไม่มีผลต่อ ledger values
- Default tolerance คำนวณจาก 1 minor unit เช่น THB 0.01, JPY 1, KWD 0.001
- BU Accounting Admin ปรับ tolerance ได้เมื่อกำหนด rounding account แล้ว
- JV ต้อง snapshot rounding mode, tolerance และ rounding account ที่ใช้เมื่อ generate/validate เพื่อให้ตรวจย้อนหลังได้
- หลังมี posted ledger การเปลี่ยน functional currency หรือ currency precision ต้องถูก block หรือผ่าน controlled migration แยกต่างหาก

## 5. High-volume journal creation

Accounting ต้องรองรับปริมาณมากสองรูปแบบโดยไม่ใช้คำว่า "bulk JV" ปนกัน:

1. **หนึ่ง Journal Batch มีหลาย Journal Vouchers** — เหมาะกับข้อมูลจาก POS/PMS, หลายสาขา, หลายวัน หรือหลาย source documents
2. **หนึ่ง Journal Voucher มี Journal Lines จำนวนมาก** — เหมาะกับ allocation, closing entry หรือ adjustment ที่ต้องอยู่ในเอกสารบัญชีใบเดียว

Canonical containment model คือ:

```text
Journal Batch 1
└── Journal Voucher 1..n
    └── Journal Line 2..n
```

Journal Voucher เป็นหน่วย atomic และต้องสมดุลในตัวเองก่อน post ส่วน Journal Batch เป็นขอบเขตสำหรับรับข้อมูล, ตรวจสอบ, อนุมัติหรือสั่งประมวลผลหลายใบพร้อมกัน โดยใช้ `journal_group_key` และ `per_journal` processing ตามกฎด้านล่าง

Journal Batch หนึ่งชุดอยู่ภายใต้ Business Unit เดียวเท่านั้น เพราะ BU เป็นขอบเขตของสิทธิ์, functional currency, timezone, accounting period, workflow, Chart of Accounts และ running code

- Payload ที่มีหลาย BU ต้องถูก ingestion gateway แยกเป็นหลาย Journal Batches
- Batch ที่ถูกแยกจาก ingestion เดียวกันใช้ `ingestion_correlation_id` ร่วมกันเพื่อ trace และดู summary ข้าม Batch
- Control totals, validation, approval และ posting status คำนวณภายใน BU เท่านั้น
- API/UI ต้อง reject การเพิ่ม event/JV ของ BU อื่นเข้า Batch ที่สร้างแล้ว

Journal Batch หนึ่งชุดอยู่ใน accounting period เดียว แต่ Journal Vouchers ภายใน Batch มี `journal_date` ต่างกันได้เมื่อทุกวันที่อยู่ภายใน period เดียวกัน

- Batch ต้อง resolve และเก็บ `accounting_period_id` ก่อน generate JV
- Event ที่อยู่นอก period ของ Batch ต้องถูก reject หรือแยกไป Batch ใหม่ ห้ามเปลี่ยน Journal Date เพื่อให้เข้ากับ Batch
- Payload ที่ข้ามหลาย periods ต้องแยก Batch อัตโนมัติและใช้ `ingestion_correlation_id` เดียวกัน
- Period status เปลี่ยนระหว่างการสร้าง JV กับ posting ได้ จึงต้องตรวจ period ใหม่ต่อ JV ตอน post
- Control totals และ reconciliation ของ Batch ต้องระบุ accounting period ชัดเจน

Excel/XLSX เป็นเพียงหนึ่ง input adapter สำหรับ compatibility ไม่ใช่ domain model หรือช่องทางหลักของ Accounting

### Journal Group Key

ทุก input channel ต้องส่งหรือสร้าง `journal_group_key` เพื่อระบุว่า lines ใดใน Batch ต้องรวมเป็น JV ใบเดียวกัน ระบบห้ามเดาการจัดกลุ่มจากลำดับแถว ชื่อ sheet หรือยอดที่ดูเหมือนสมดุล

```text
Batch B001
├── POS:BKK:2026-08-10:SALES -> JV 1
├── POS:HKT:2026-08-10:SALES -> JV 2
└── POS:BKK:2026-08-10:TAX   -> JV 3
```

- API/source system ส่ง group key มาโดยตรงได้
- Mapping Rule derive key จาก field เช่น BU, accounting date, document type และ source document ได้
- Manual paste/file import ต้องให้ผู้ใช้ map คอลัมน์ group key เมื่อสร้างหลาย JV
- กรณีสร้าง JV ใบเดียว ระบบสร้าง group key เดียวให้ทั้งชุด
- หาก Batch ตั้งใจสร้างหลาย JV แต่ resolve group key ไม่ได้ ให้ validation fail แทนการเดา

### Per-Journal Processing

Journal Batch ใช้ policy `per_journal`: แต่ละ JV เป็น validation, generation และ posting transaction boundary อิสระ ใบที่ผ่านสามารถเดินหน้าต่อได้ ส่วนใบที่ผิดต้องแก้ที่ต้นทางก่อน retry

- ห้าม partial success ภายใน JV; header, lines, ledger และ related records ต้องสำเร็จหรือ rollback ทั้งใบ
- Batch ที่มีทั้งสำเร็จและล้มเหลวใช้สถานะ `partially_completed`
- UI/API ต้องแสดง error แยกตาม `journal_group_key` และห้ามข้ามรายการผิดแบบเงียบ ๆ
- Retry เฉพาะ JV ที่ผิดต้องใช้ idempotency key เดิมและไม่สร้าง JV/ledger ของใบที่สำเร็จแล้วซ้ำ
- Batch ต้องเก็บ control totals อย่างน้อยจำนวน JV, จำนวน lines, total debit และ total credit หลังสร้างและหลัง post
- การ approve หรือ post แบบ batch เป็นเพียงคำสั่งหลายรายการ แต่ผลลัพธ์และ audit ต้องบันทึกแยกต่อ JV
- Schedule Post และ Auto-Reverse ตั้งค่าได้เฉพาะภายใน JV ทีละใบ ไม่ใช่ Batch setting และไม่มี bulk action สำหรับสองค่านี้

### Bulk Commands

Bulk JV actions รองรับ `Submit`, `Approve` และ `Post/Retry Post` หลาย JV พร้อมกัน แต่ Bulk Command ไม่เปลี่ยน transaction boundary จาก `per_journal`; `Approve` แสดงเฉพาะ JV ที่เปิด Workflow

- ก่อนยืนยันต้องแสดงจำนวน JV, จำนวน lines, total debit/credit และรายการที่จะถูก skipped
- ระบบตรวจ permission, workflow stage เมื่อเปิดใช้, segregation of duties, period, balance และ validation แยกต่อ JV
- ผลลัพธ์ต้องแยก `succeeded`, `failed` และ `skipped` พร้อม reason ต่อ `journal_group_key`/JV
- Approve ห้ามผู้เตรียม approve JV ของตนเองเมื่อ BU เปิด segregation of duties
- Post ใช้ idempotency key แยกต่อ JV และ retry เฉพาะใบที่ล้มเหลวได้
- Bulk Command ห้ามรวม Schedule Post และ Auto-Reverse
- Activity log บันทึกทั้ง bulk command correlation ID และ action/result ของ JV แต่ละใบ

### Duplicate and idempotency policy

ระบบแยก duplicate detection เป็นสองระดับ:

1. **Exact Duplicate** — block อัตโนมัติและคืนผลลัพธ์ของการประมวลผลเดิม
2. **Probable Duplicate** — warning เพื่อให้ผู้ใช้ตรวจ; ยืนยันต่อได้เมื่อมี permission และระบุเหตุผล

Exact identity ของ system/API source ประกอบด้วย:

```text
bu_id + source_system + source_type + source_id + source_version + event_type
```

Source สามารถส่ง deterministic `idempotency_key` ที่มี unique constraint ภายใน BU แทน composite identity ได้

- Inventory, AP, AR, Fixed Assets และ external API ต้องส่ง deterministic idempotency key
- Retry ใช้ key เดิมและห้ามสร้าง JV/ledger ซ้ำ
- Correction/resend ใช้ source version ใหม่และ link ไป event version ก่อนหน้า
- Manual entry, Copy/Paste, CSV และ Excel สร้าง `submission_id` ใหม่ แต่ระบบคำนวณ canonical fingerprint จาก BU, period, group key, journal date, accounts, amounts และ dimensions
- Fingerprint match เป็น probable duplicate ไม่ใช่ exact duplicate เพราะ recurring/accrual อาจเหมือนกันโดยชอบด้วยเหตุผล
- ผู้ใช้ที่ยืนยัน probable duplicate ต้องระบุ reason และระบบเก็บ actor/timestamp
- Re-upload ไฟล์เดิมด้วย file hash และ mapping version เดิมต้องเตือนระดับ Batch แต่ไม่ใช้ชื่อไฟล์เป็น duplicate key

### Control totals and reconciliation

Journal Batch เก็บ control totals สองชุด:

- `declared_control_totals` — source ระบุ record count และยอดแยกตาม transaction currency
- `computed_control_totals` — Carmen Blue คำนวณใหม่ในแต่ละ stage

```text
received -> generated -> submitted -> posted
```

ขั้นต่ำต้อง reconcile:

- จำนวน source records ที่ declared กับ received
- จำนวน `journal_group_key` กับ generated JVs
- จำนวน Journal Lines
- transaction totals แยกตาม currency
- functional debit/credit totals หลัง mapping, rate และ line-level rounding
- succeeded/failed/skipped ต่อ stage และต่อ JV

System/API integration ต้องส่ง declared record count เป็นอย่างน้อย และควรส่ง transaction totals แยก currency เมื่อ source คำนวณได้ CSV/Excel รองรับ control row/metadata หรือให้ผู้ใช้ออกค่าก่อน submit ส่วน Manual Copy/Paste ที่ไม่มี declared totals ใช้ computed totals อย่างเดียวและต้องแสดง `source_totals_not_provided`

- Declared กับ computed ไม่ตรงให้ Batch เป็น `reconciliation_failed` และ block generate/post จน resolve
- Functional totals เป็นค่าที่ Carmen Blue คำนวณเท่านั้น source ห้าม override
- Reconciliation ต้อง trace จาก Batch -> `journal_group_key` -> JV -> Journal Lines ได้

### Generated-JV edit policy

Source-generated Journal Voucher เป็น immutable projection ของ source document แม้ยังไม่ Submit ผู้ใช้ห้ามแก้ header/lines ที่มีผลต่อ accounting, mapping, currency, dimensions หรือ control totals ตรงหน้า JV

- หากข้อมูลผิด ให้แก้ source document แล้วสร้าง correction/reversal ตาม source policy
- Generated JV revision เดิมเปลี่ยนเป็น `superseded` และ link ไป revision ใหม่; ห้ามลบหรือทับข้อมูลเดิม
- Source identity/version และ generated JV ต้อง trace ถึงกันได้
- Fields ที่ไม่กระทบ accounting เช่น internal note หรือ attachment แก้ได้ตาม permission โดยไม่ทำให้ control totals เปลี่ยน
- Manual JV ที่สร้างทีละใบแก้ header/lines ได้ขณะเป็น Draft
- หลัง Submit การแก้ต้องผ่าน workflow return-to-draft เมื่อเปิด Workflow หรือ lifecycle action ที่มี audit; หลัง Post ใช้ reversal/adjustment เท่านั้น

### Voucher-number allocation

- JV ที่ยังไม่ Submit ใช้ `draft_reference` แยกจากเลขเอกสารทางการ
- Running-code engine ออก `voucher_no` ทางการแบบ atomic เมื่อ Submit สำเร็จ
- Submit retry ด้วย idempotency key เดิมต้องคืน voucher number เดิม
- Validation failure ก่อน Submit ไม่ใช้ voucher number ทางการ
- หลังออกเลขแล้วห้ามคืนหรือนำเลขไปใช้ใหม่; Reject/return-to-draft ยังคงเลขเดิม
- Running-code sequence แยกตาม BU, journal type/prefix และ fiscal policy ที่กำหนด
- Activity/audit ต้อง link `draft_reference`, voucher number และ Batch/group key ได้

### Input channels

ช่องทางที่สร้าง Journal Voucher ต้องผ่าน backend validation และ posting policy เดียวกัน:

| Channel | Use case | หมายเหตุ |
| --- | --- | --- |
| Carmen Blue subledger/API | Inventory, AP, AR, Fixed Assets | ช่องทางหลักของระบบภายใน ใช้ idempotency/source version |
| External integration API | POS, PMS, payroll, bank หรือระบบลูกค้า | ใช้ authenticated contract, mapping profile และ asynchronous result |
| Journal Template | รูปแบบบรรทัดเดิมแต่ parameter/ยอดเปลี่ยน | Template สร้าง event ไม่สร้าง ledger โดยตรง |
| Recurring Journal | ค่าเช่า, accrual, prepaid และรายการตามรอบ | Scheduler สร้าง event ตาม recurrence แล้วผ่าน validation ทุกครั้ง |
| Allocation | กระจายยอดตามเปอร์เซ็นต์, revenue, headcount หรือฐานอื่น | เก็บ allocation rule/version และผลคำนวณ |
| Bulk-entry Wizard | Generate lines/JVs จาก pattern ที่ผู้ใช้กำหนด | เหมาะกับหลาย departments/dimensions |
| Copy/Paste Grid | วางช่วงข้อมูลจาก Excel/Google Sheets | Validate ใน browser เพื่อ feedback ได้ แต่ backend เป็น source of truth |
| JSON/CSV ingestion | Integration และข้อมูลปริมาณมาก | Backend ต้องตรวจข้อมูลก่อนสร้าง JV |
| Excel/XLSX import | Compatibility และ ad-hoc migration | เป็น adapter เท่านั้น ใช้ pipeline เดียวกับ channel อื่น |

AI สามารถแนะนำ account, mapping หรือ anomaly ได้ แต่ไม่ใช่ input channel ที่มีสิทธิ์ post เอง ผลทุกอย่างต้องเป็น suggestion ที่ผู้ใช้ยืนยันและผ่าน validation/approval ตามปกติ

## 6. Core domain model

### Account

```text
Account
- id
- bu_id or chart_id
- code
- name_en / name_th
- account_type: asset | liability | equity | revenue | expense
- normal_balance: debit | credit
- parent_id
- posting_allowed
- requires_department
- allowed_dimension_schema_id
- tax_behavior
- currency_behavior
- active_from / active_to
- is_active
- doc_version
```

Header/non-posting accounts ใช้จัด hierarchy เท่านั้น ห้ามเลือกใน journal line

### Journal Voucher

```text
JournalVoucher
- id / bu_id / doc_version
- journal_type / prefix / voucher_no
- journal_date
- description
- source_type / source_id / source_no
- functional_currency_id
- status
- schedule_post / scheduled_post_at
- auto_reverse / reverse_date
- reversal_of_id / generated_reversal_id
- workflow_enabled_snapshot / workflow_id / workflow_instance_id / current_stage
- prepared_by / submitted_at / approved_at
- posted_at / posted_by / posting_event_id
- voided_at / voided_by / void_reason
- created_at / created_by / updated_at / updated_by
```

### Journal line

```text
JournalLine
- id / journal_id / line_no
- account_id / account_code_snapshot
- department_id / department_code_snapshot
- comment
- transaction_currency_id / currency_code_snapshot
- exchange_rate / rate_date / rate_type / rate_source
- transaction_debit / transaction_credit
- functional_debit / functional_credit
- tax_detail_id
- doc_version
```

### Dimensions

Dimension ต้องเป็น data-driven ไม่ hardcode เป็น `dim1..dim7` ใน journal table

```text
DimensionDefinition: id, code, name, data_source, is_active
DimensionValue: id, dimension_id, code, name, active dates
JournalLineDimension: journal_line_id, dimension_id, dimension_value_id
AccountDimensionRule: account_id, dimension_id, required, allowed-values rule
```

Department ใช้ field หลักบน line เพื่อ UX และ reporting performance แต่สามารถ expose เป็น dimension ใน reporting layer ได้

## 7. Double-entry invariants

1. Journal ต้องมีอย่างน้อย 2 lines
2. แต่ละ line ใส่ Debit หรือ Credit ได้เพียงด้านเดียวและจำนวนต้องมากกว่า 0
3. ผลรวม functional debit ต้องเท่ากับ functional credit ภายใน tolerance ที่กำหนด
4. ห้าม post ไปยัง header/inactive account
5. Account, department และ dimensions ต้อง active ณ `journal_date`
6. `journal_date` ต้องอยู่ใน accounting period ที่เปิดรับ posting
7. Functional currency มาจาก BU และเปลี่ยนไม่ได้หลัง BU มี posted ledger
8. Posted journal และ ledger entry เป็น immutable
9. การ post header, lines, ledger, tax detail, source link และ posting event ต้องอยู่ใน database transaction เดียวกัน
10. ทุกคำสั่ง post ต้องมี idempotency key; retry แล้วต้องไม่สร้าง ledger ซ้ำ

## 8. Status model

JV lifecycle status และ Workflow status เป็นคนละแกน ห้ามเพิ่ม `approved`/`rejected` เป็น JV lifecycle status เพราะบาง BU/journal type ปิด Workflow

### JV lifecycle

```text
draft
  -> submitted       (เฉพาะเมื่อ Workflow เปิดและกำลังรอ stage)
  -> posting         (Submit แล้ว Workflow ปิด หรือ final approval สำเร็จ)
  -> scheduled       (Submit/final approval สำเร็จและตั้ง Schedule Post)
submitted
  -> draft           (workflow return/reject; เก็บ outcome ใน workflow history)
  -> posting
  -> scheduled
posting
  -> posted
  -> post_failed
scheduled
  -> posting
  -> posted
  -> post_failed
posted
  -> reversal_scheduled
  -> reversed
  -> voided_by_reversal
```

- `void` ก่อน post เปลี่ยนเอกสารเป็น cancelled/voided โดยไม่สร้าง ledger
- หลัง post ห้ามลบหรือ void แบบ destructive ต้องสร้าง reversal journal
- `post_failed` ต้องเก็บ error code, error message, attempt count และ last attempted time

### Optional Workflow

Workflow ตั้งค่าเปิด/ปิดต่อ BU และ journal type:

```text
workflow_enabled = false
Submit -> Posting หรือ Scheduled -> Posted

workflow_enabled = true
Submit -> JV Submitted + Workflow Pending
Final approval -> Posting หรือ Scheduled -> Posted
Return/Reject -> JV Draft + Workflow outcome/history
```

- เมื่อปิด Workflow ไม่สร้าง workflow instance และไม่มี Approved/Rejected status
- เมื่อเปิด Workflow ต้อง resolve active `workflow_id`; ถ้าตั้งค่าไม่ครบให้ block Submit ห้าม bypass เป็น no-workflow
- Workflow definition/stages ต้อง snapshot ตอน Submit เพื่อไม่ให้การแก้ config เปลี่ยนรายการที่กำลังอนุมัติ
- Approval/return/reject เป็น workflow actions และ history ไม่ใช่ JV lifecycle statuses
- Submit ทำให้ accounting fields ถูกล็อกทั้งสองโหมด; กลับมาแก้ได้เมื่อ workflow คืนเป็น Draft หรือผ่าน explicit audited action

## 9. Posting engine

Posting engine รับ `journal_id` และ idempotency key แล้วทำตามลำดับ:

1. Lock journal และตรวจ `doc_version`/status
2. ถ้า JV snapshot ว่า Workflow เปิด ให้ตรวจ final workflow approval; ถ้าปิดให้ข้ามขั้นนี้
3. Resolve accounting period จาก `journal_date`
4. ตรวจ account/dimension/tax/currency rules
5. ตรวจยอดสมดุลใน functional currency
6. สร้าง immutable ledger entries
7. สร้าง posting event และ source link
8. เปลี่ยน status เป็น posted
9. ถ้า Auto-Reverse เปิดอยู่ ให้สร้าง reversal instruction หลัง original post สำเร็จ
10. Commit ทั้งหมดพร้อมกัน

Subledger ต้องเรียก posting engine ผ่าน contract เช่น:

```text
source_type
source_id
source_version
posting_rule_code
posting_date
lines[]
idempotency_key
```

ห้าม AP/AR/Inventory/Asset เขียน ledger entry โดยตรง

### Subledger control-account policy

บัญชีควบคุม เช่น Trade AP, Trade AR, Inventory control, Pending/Input VAT และ WHT Payable ต้องกำหนด metadata อย่างน้อย `control_account_type`, `manual_posting_allowed` และ `allowed_source_types[]`

- Manual JV ลง control account ได้เฉพาะเมื่อ policy และ permission อนุญาต พร้อม reason/audit; default คือไม่อนุญาต
- Posting engine ตรวจ source type กับ account policy ทุกครั้ง ห้ามเชื่อ account code ที่ UI ส่งมา
- Reversal ของ source-generated JV ต้องเริ่มจาก source owner เพื่อให้ subledger open item, application และ tax state เปลี่ยนพร้อมกับ ledger
- GL เก็บ source/posting snapshot และ link แต่ไม่เป็น owner ของ AP open item, payment application หรือ tax filing state
- ยอด subledger control account ต้องมี reconciliation endpoint/report ที่อธิบาย variance ถึง source event, generated JV และ posting event ได้

## 10. Schedule Post

Schedule Post คือการกำหนดเวลาที่ระบบจะพยายาม post ไม่ใช่การเปลี่ยน `journal_date`

Schedule Post เป็นคำสั่งระดับ Journal Voucher เท่านั้น Journal Batch, template import หรือ bulk action ห้ามกำหนด/ถ่ายทอดค่า `scheduled_post_at` ให้หลาย JV พร้อมกัน

- เปิด toggle แล้วต้องระบุ `scheduled_post_at`
- `scheduled_post_at` ต้องไม่อยู่ในอดีตตอน submit
- ถ้า Workflow เปิด เอกสารต้องผ่าน final approval ก่อนเข้า `scheduled`; ถ้าปิด Submit แล้วเข้า `scheduled` ได้โดยตรง
- เมื่อถึงเวลา scheduler ต้องตรวจ period/account/rules ใหม่ทั้งหมด
- ถ้า Workflow เปิดและยังไม่ final-approved ให้คง `submitted` ห้าม scheduler post ข้าม workflow
- ถ้า period ของ `journal_date` ปิดอยู่ ให้เป็น `post_failed`/exception ห้ามย้าย posting date อัตโนมัติ
- user ที่มีสิทธิ์สามารถ reschedule/cancel schedule ได้ก่อน post พร้อม activity log
- scheduler ต้องใช้ distributed lock และ idempotency key ต่อ journal
- timezone ใช้ timezone ของ BU; backend เก็บ timestamp เป็น UTC

## 11. Auto-Reverse

Auto-Reverse ใช้กับ accrual/adjustment ที่ต้องกลับรายการในวันที่กำหนด

Auto-Reverse เป็นคำสั่งระดับ Journal Voucher เท่านั้น ต้องเปิดและกำหนดวันที่ใน JV แต่ละใบ ห้ามตั้งค่า default หรือสั่งพร้อมกันจาก Journal Batch

- เปิด toggle แล้วต้องระบุ `reverse_date`
- `reverse_date` ต้องมากกว่า `journal_date`
- ถ้าใช้ร่วมกับ Schedule Post: `reverse_date` ต้องอยู่หลังวันที่ original journal ถูกกำหนดให้ post
- ระบบสร้าง reversal instruction หลัง original journal post สำเร็จเท่านั้น
- Reversal JV ต้อง link กลับ original และ original ต้อง link ไป generated reversal
- Reversal คัดลอก account, department, dimensions, currency/rate snapshot และ functional amount แล้วสลับ Debit/Credit
- ใช้ rate snapshot เดิม ไม่ใช้ exchange rate ของวัน reverse เพื่อให้ยอด functional currency หักล้าง original ได้ครบ
- Voucher number ของ reversal ต้องสร้างจาก running-code engine และสร้างเพียงครั้งเดียว
- Reversal ใช้ Workflow toggle ของ reversal journal type: เมื่อปิดให้ Submit แล้ว post/schedule ตามปกติ; เมื่อเปิดให้สร้าง workflow instance และรอ final approval
- ถ้า reverse period ปิดอยู่ ให้ค้างเป็น `reversal_failed` พร้อม exception ห้ามเลื่อนไปงวดถัดไปเอง
- หาก original ถูก reverse ด้วยมือก่อนถึงกำหนด scheduler ต้องไม่สร้าง reversal ซ้ำ
- Tax/WHT metadata ต้องไม่ถูกนำไปยื่นซ้ำโดยอัตโนมัติ การกลับภาษีต้องผ่าน tax posting rule ที่ชัดเจน

## 12. Permissions and segregation of duties

ขั้นต่ำควรมี permissions:

- `gl.jv.view`
- `gl.jv.create`
- `gl.jv.edit`
- `gl.jv.submit`
- `gl.jv.approve` (ใช้เมื่อ Workflow เปิด)
- `gl.jv.post`
- `gl.jv.schedule`
- `gl.jv.reverse`
- `gl.jv.void`
- `gl.jv.view_attachments`
- `gl.jv.manage_attachments`
- `gl.period.close`
- `gl.period.reopen`

เมื่อ Workflow เปิด ต้องรองรับ policy ที่ห้ามผู้เตรียม approve รายการของตัวเอง เมื่อปิด Workflow การควบคุมผู้สร้างกับการ post ให้เป็น policy แยกของ segregation of duties

## 13. Open decisions ก่อนออกแบบ schema/API

1. Accounting ใช้ period เดียวกับ Inventory หรือมี accounting calendar แยก
2. BU เท่ากับ legal/accounting entity เสมอหรือจำเป็นต้องมี `legal_entity`
3. **Decided for Phase 1:** Accounting backend อยู่ใน `apps/micro-business` และเปิดผ่าน `apps/backend-gateway`; การแยก service พิจารณาใหม่เมื่อ throughput, ownership หรือ deployment isolation ต้องการ
4. Workflow เดิมรองรับ auto-approval สำหรับ system-generated reversal หรือไม่
5. Rate type ที่ต้องรองรับใน Phase 1: daily, month-end, manual หรือทั้งหมด
6. Tax/WHT master จะ extend `TaxProfile` เดิมหรือแยก accounting tax configuration
7. Attachment API และ retention policy ที่จะ reuse
8. Budget service มีอยู่ใน backend อื่นหรือเป็นงานใหม่
