# Carmen Blue Accounting

คำศัพท์กลางของบริบท Accounting สำหรับ General Ledger และ subledgers ที่ส่งรายการเข้าบัญชี เพื่อให้เอกสารและระบบใช้ความหมายเดียวกัน

## Language

**Journal Batch**:
ชุดนำเข้าหรือชุดสร้างรายการที่ประกอบด้วย Journal Voucher ตั้งแต่หนึ่งใบขึ้นไป และติดตามการตรวจสอบหรือประมวลผลเป็นกลุ่มได้
_Avoid_: Import file, Excel batch, bulk JV

**Journal Voucher**:
เอกสารบัญชีหนึ่งใบที่เป็นหน่วย atomic ประกอบด้วย Journal Lines ตั้งแต่สองบรรทัดขึ้นไป และต้องสมดุลก่อน post
_Avoid_: Transaction, batch, journal row

**Journal Line**:
รายการเดบิตหรือเครดิตหนึ่งบรรทัดภายใน Journal Voucher ซึ่งอ้างถึงบัญชี จำนวนเงิน และมิติทางบัญชี
_Avoid_: JV transaction, record, item

**Journal Group Key**:
รหัสจากแหล่งข้อมูลหรือกฎ mapping ที่ระบุว่า Journal Lines ใดใน Journal Batch ต้องรวมเป็น Journal Voucher ใบเดียวกัน
_Avoid_: Sheet name, row group, voucher guess

**Per-Journal Processing**:
นโยบายที่ประมวลผล Journal Voucher แต่ละใบใน Journal Batch เป็นอิสระ โดยใบที่ผ่านเดินหน้าต่อได้และใบที่ผิดค้างให้แก้หรือ retry
_Avoid_: Partial row posting, best-effort posting

**Original Payload**:
ข้อมูลต้นฉบับที่ระบบรับจาก source และเก็บแบบแก้ไขไม่ได้เพื่อใช้ตรวจสอบเทียบกับ mapped หรือ overridden values
_Avoid_: Editable import data, current row values

**Mapping Override**:
ค่าทางบัญชีที่ผู้มีสิทธิ์กำหนดแทนผลจาก Mapping Rule สำหรับ generated JV โดยไม่แก้ Original Payload และต้องระบุเหตุผล
_Avoid_: Fix source data, silent correction

**Bulk Command**:
คำสั่ง Submit, Approve หรือ Post ที่ผู้ใช้ส่งให้ Journal Vouchers หลายใบพร้อมกัน โดยระบบยังตรวจและบันทึกผลแยกต่อใบตาม Per-Journal Processing
_Avoid_: Batch transaction, all-or-nothing posting

**Ingestion Correlation**:
รหัสที่เชื่อม Journal Batches หลายชุดซึ่งเกิดจาก payload หรือการนำเข้าครั้งเดียวกัน โดยไม่ทำให้ Batch ข้าม Business Unit
_Avoid_: Cross-BU batch, shared batch number

**Batch Accounting Period**:
งวดบัญชีเดียวที่ครอบ Journal Voucher ทุกใบใน Journal Batch โดยแต่ละใบมี Journal Date ต่างกันได้เมื่อยังอยู่ภายในงวดเดียวกัน
_Avoid_: Import month label, mixed-period batch

**Functional Amount**:
ยอดของ Journal Line ที่แปลงและปัดตาม precision ของ functional currency ประจำ Business Unit และใช้เป็นฐานตรวจสมดุลกับลง ledger
_Avoid_: Display amount, unrounded converted amount

**Rounding Adjustment**:
Journal Line ที่แสดงผลต่างจากการปัดสกุลเงินอย่างชัดเจนและลงบัญชี rounding ที่กำหนด เมื่อผลต่างไม่เกิน tolerance ของ Business Unit
_Avoid_: Hidden balance fix, floating-point correction

**Exact Duplicate**:
Accounting Event ที่มี source identity, version, event type หรือ idempotency key ตรงกับ event ที่ระบบเคยรับแล้วและต้องไม่สร้าง JV ซ้ำ
_Avoid_: Similar journal, repeated amount

**Probable Duplicate**:
JV ที่มี fingerprint ทางบัญชีคล้ายรายการเดิมและต้องให้ผู้ใช้ตรวจหรือยืนยันเหตุผล แต่ไม่ถูก block โดยอัตโนมัติ
_Avoid_: Exact duplicate, guaranteed duplicate

**Declared Control Totals**:
จำนวน records และยอดแยกสกุลเงินที่ source ระบุเพื่อใช้ยืนยันความครบถ้วนของ Journal Batch
_Avoid_: Carmen-calculated balance, functional total

**Computed Control Totals**:
จำนวนและยอดที่ Carmen Blue คำนวณจากข้อมูลที่รับ, จัดกลุ่ม, map, generate และ post เพื่อ reconcile กับ source และแต่ละขั้นของ Batch
_Avoid_: Source totals, user-entered expected amount

**Draft Reference**:
รหัสติดตามชั่วคราวของ generated JV ก่อน Submit ซึ่งไม่ใช่เลขเอกสารบัญชีทางการ
_Avoid_: Voucher number, running code

**Mapping Snapshot**:
สำเนาและ hash ภายในของ Mapping Rule ที่การสร้าง JV ใช้ เพื่ออธิบายผล mapping ย้อนหลังโดยไม่เป็น business version ที่ผู้ใช้ต้องจัดการ
_Avoid_: Approved mapping version, editable rule reference

**Optional Workflow**:
การตั้งค่าต่อ Business Unit และ journal type ที่เลือกว่าจะใช้ approval stages ก่อนลง ledger หรือให้ Submit ไปสู่ Posting/Scheduled โดยตรง
_Avoid_: Mandatory approval, JV approved status

**AP Document**:
เอกสารเจ้าหนี้ เช่น Standard Invoice, Deposit, Credit Note หรือ Debit Note ซึ่งมี lifecycle แยกจาก Workflow, Settlement, Tax และ Match status
_Avoid_: Vendor bill row, open item, payment request

**AP Open Item**:
ยอดหนี้หรือยอดเครดิตที่เกิดจาก AP Document ที่ post แล้วและยังมีจำนวนที่ต้อง settle/apply โดยเก็บ transaction และ carrying functional amount
_Avoid_: Draft invoice balance, dashboard total, unpaid form

**Payment Proposal**:
ผลการเลือก AP Open Items แล้วจัดกลุ่มตาม Business Unit, vendor legal entity, payment currency, payment method และ beneficiary instruction ก่อนสร้าง Payment Voucher ตั้งแต่หนึ่งใบขึ้นไป
_Avoid_: Payment Voucher, payment batch, bank transfer

**Payment Voucher**:
เอกสาร AP หนึ่งใบที่ระบุ open-item applications, WHT, payment method, beneficiary snapshot และ posting preview โดยเป็น transaction boundary แยกจากชุดคำสั่งหลายใบ
_Avoid_: Payment proposal, bank instruction, payment batch

**AP Open-Item Reservation**:
ยอดของ AP Open Item ที่ Payment Voucher ที่ยัง active กันไว้เพื่อป้องกัน double payment โดยยังไม่ลด posted open amount จน application สำเร็จตาม posting policy
_Avoid_: Paid amount, payment application, permanent lock

**Payment Application**:
การเชื่อมยอดของ Payment Voucher ที่ post สำเร็จกับ AP Open Item เพื่อปรับ open amount และ settlement status แบบ atomic
_Avoid_: Reservation, selected invoice, approval

**Payment Release**:
คำสั่งที่อนุญาตให้ Payment Voucher ซึ่งผ่าน approval/validation แล้วเริ่มกระบวนการจ่ายตาม payment-method policy โดยยังไม่รับประกันว่าธนาคาร execute หรือระบบ post สำเร็จ
_Avoid_: Approval, bank success, posting

**Bank Execution**:
ผลของ disbursement instruction ที่แยกจาก Payment Voucher lifecycle และ accounting posting; อาจเป็น processing, executed, failed, cancelled หรือ reconciled
_Avoid_: Payment approval, AP settlement, posted journal

**Payment Posting Point**:
เหตุการณ์ที่ policy ของ payment method กำหนดให้สร้าง Journal Voucher, Payment Application, WHT event และปรับ AP Open Item ภายใน transaction เดียวกัน
_Avoid_: Always approval, UI submit, bank reconciliation by default

**AP Match Exception**:
ผลต่างจาก PO, GRN, service acceptance หรือ policy ที่ต้อง resolve หรือผ่าน controlled override ก่อน Submit ตามระดับ tolerance
_Avoid_: User-selected status, informal note, duplicate invoice

**AP Match Override**:
การยอมรับ AP Match Exception โดยผู้มีสิทธิ์ พร้อม reason, evidence, rule snapshot และ audit โดยไม่แก้ source document ย้อนหลัง
_Avoid_: Acknowledge checkbox, silent tolerance change, PO correction

**Source-Generated Journal Voucher**:
Journal Voucher ที่เป็น immutable projection จาก Accounting Event ของ AP, AR, Inventory หรือ Asset และ trace กลับ source version และ posting event ได้ การแก้หรือกลับรายการต้องเริ่มจาก source owner
_Avoid_: Editable draft JV, detached journal, manual correction in GL

**Subledger Control Account**:
บัญชี GL ที่ยอดต้อง reconcile กับ subledger เช่น Trade AP หรือ Trade AR และจำกัด source types/manual posting ตาม account policy
_Avoid_: Normal posting account, dashboard category, unrestricted manual account

**Source Owner**:
โมดูลที่เป็นเจ้าของ business document และผลกระทบประกอบ เช่น AP เป็นเจ้าของ Invoice, Open Item, Payment Application และ tax linkage แม้ GL เป็นเจ้าของ Journal Voucher, Posting Event และ Ledger Entry
_Avoid_: UI route owner, workflow approver, database schema package
