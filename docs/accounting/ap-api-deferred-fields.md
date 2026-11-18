# AP fields waiting for an API contract

ตรวจสัญญา request/response วันที่ 2026-11-18 (branch `codex/ap-master-integration`) เพื่อแยกงาน backend ออกจากการเติม
field ที่ Invoice/Payment UI อ่านและบันทึกได้แล้ว เอกสารนี้ไม่ใช่การยืนยันว่า
flow ที่ยังขาดพร้อมใช้งานบน environment ที่ deploy อยู่

## แหล่งอ้างอิง

- [AP Invoice FRD v4.5.06](https://drive.google.com/file/d/1hrpqTFJbx19WRSKAiDnd-B9X24VlcS7v/view)
- [AP Payment FRD v2.16](https://drive.google.com/file/d/1pT3ApXgbpS736LP7IJ9LJ6AQiltcJHrB/view)
- [Drive specification mapping](drive-ui-spec-implementation-plan.md),
  [Invoice design](specs/accounts-payable-invoice-design.md),
  [Payment design](specs/accounts-payable-payment-design.md)
- Backend repository `carmen-turborepo-backend-v2`:
  `apps/backend-gateway/src/application/{ap-invoice,ap-payment}/swagger/request.ts`
  และ `apps/micro-business/src/ap/{ap-invoice,ap-payment}/dto/*.serializer.ts`

FRD กำหนด business logic; gateway schema และ serializer กำหนด wire contract
ปัจจุบัน เอกสารเก่าที่เรียก AP ว่า mock หรือใช้ proposed endpoint ไม่ใช่หลักฐาน
ว่า endpoint/field นั้นเปิดใช้งานแล้ว

## รายการที่แยกไว้

| ส่วน | Field / logic ตามเอกสาร | สัญญาปัจจุบันและสิ่งที่ต้องเพิ่ม |
| --- | --- | --- |
| Invoice header | บันทึก Credit Term identity ที่ผู้ใช้เลือก | Request รับ `credit_term_days` ไม่รับ `credit_term_id`; response คืน term snapshot และ due date ที่ระบบคำนวณจากวันที่/จำนวนวัน ยังบันทึก term identity ที่เลือกแยกไม่ได้ |
| Invoice matching | PO/contract/service acceptance, tolerance result และ override reason/evidence | Line request รองรับ GRN source item + `matched_qty`; response มี matched quantity/value/variance แต่ไม่มี match-policy/tolerance/override contract จึงไม่ให้ UI ตัดสินว่า exception ผ่านเอง |
| Invoice tax | แก้ Tax Invoice No./Date, filing period และเปลี่ยน tax lifecycle | Invoice CRUD ไม่รับ tax record; response คืน `tb_ap_invoice_tax` แบบอ่านอย่างเดียว ไม่มี filing period ต้องมี tax-write/transition contract พร้อม policy validation |
| Invoice tax snapshot | Vendor registered name, tax ID, branch และ registered address ณ posting | Invoice response มี `vendor_name` แต่ไม่มีชุด legal/tax snapshot ดังกล่าว ห้ามอ่าน vendor master ปัจจุบันแล้วอ้างว่าเป็น snapshot ของใบเก่า |
| Invoice Tax 2 / dimensions | บัญชี/Cost Center/amount override ของ Tax 2 และ dimensions แยก Expense/Tax/AP ตาม FRD §3.4 | Line request รับ `wht_tax_profile_id` แต่ไม่มี WHT account/Cost Center/amount override และมี `dimensions[]` ชุดเดียวต่อบรรทัด จึงคง WHT estimate กับ line dimensions ที่ API รองรับ |
| Invoice payment history | ประวัติ PV/application ต่อ Invoice | Invoice response คืนยอดรวม/outstanding/reference applied แต่ไม่มี payment/application history ต้องตกลง authorized query ที่คืนรายการเชื่อมโยงต่อใบ |
| Payment Type integration | เลือกประเภทการจ่ายจาก master | Implemented ใน branch: `payment_type_id` + server snapshot; GL bank leg ใช้ account/CC/dimensions จาก master ยังรอ backend rollout และ live Post QA |
| WHT Form integration | เลือกแบบและ default GL | Implemented ใน branch: WHT row เก็บ `wht_form_id` และ snapshot; Form ไม่มี GL ใช้ default WHT payable จาก GL Settings ยังรอ rollout |
| WHT Service Type integration | เลือกประเภทบริการและ default WHT rate | Implemented ใน branch: Invoice line และ Payment WHT เก็บ `wht_service_type_id`; backend resolve rate และ Vendor defaults ยังรอ rollout |
| Payment bank allocations | แบ่งหนึ่ง PV จ่ายจากหลายบัญชีหรือหลาย payment methods | Request/response มี `bank_account_id` และ `payment_method` เดี่ยว ไม่มี bank allocation array |
| Payment bank / WHT GL Cost Center | CC/dimensions ของ Bank และ WHT legs | Implemented ใน branch โดย resolve จาก Payment Type / WHT Form snapshot รองรับ typed Dimensions ตาม main ปัจจุบัน ยังรอ live GL verification |
| Payment beneficiary | Verified beneficiary bank instruction snapshot | Response มีบัญชีธนาคารที่ใช้จ่ายและ payee name/tax/address แต่ไม่มี beneficiary instruction snapshot/verification reference |
| Payment execution | Bank execution/reconciliation, cheque lifecycle และ controlled priority | Response มี `doc_status`, payment/paid dates และ cheque/reference fields แต่ไม่มี execution/reconciliation/cheque-state/priority contract ต้องแยกจาก accounting posting status |
| Payment WHT | Certificate no./filing linkage, override audit | Request รองรับ legacy profile หรือ Service+Form และ `is_override`; Condition เก็บบน header ยังไม่มี certificate/filing linkage และ audit เหตุผล override รายแถว |
| Payment WHT payee | แก้ชื่อ/Tax ID/branch/address ตาม FRD §3.4 | Payee ยังเป็น snapshot อ่านอย่างเดียว ส่วน Condition เพิ่ม request/response/column และ UI แล้วใน branch นี้ |
| Payment expense dimensions | Dimensions เฉพาะรายการค่าใช้จ่าย ตาม FRD §3.5 | Expense request รับบัญชี/Cost Center/description/amount แต่ไม่มี dimensions array |
| Posting preview | Preview ตาม posting rules ก่อน Submit/approval | AP CRUD คืน generated JV id/no หลัง posting; ไม่มี posting-preview response ใน gateway AP routes ปัจจุบัน ห้ามใช้ browser calculation เป็น authoritative posting preview |
| Invoice audit author | ชื่อผู้แก้คู่กับ Updated timestamp | Response มี `updated_at` + `updated_by_id` แต่ไม่มี updater name/`audit.updated`; gateway ไม่ใช้ `@EnrichAuditUsers()` ชื่อ `last_action_by_name` เป็น workflow actor จึงใช้แทนผู้แก้ไม่ได้ UI แสดง timestamp และรอ enrichment ที่ไม่ต้องเพิ่มสิทธิ์อ่าน user directory |

Catalog CRUD ใช้ API จริงแล้ว ดู [live master CRUD QA](qa/2026-11-18-ap-master-live-crud.md)
ส่วน transaction integration ของรอบนี้ดู [QA และสถานะ rollout](qa/2026-11-18-ap-master-integration.md)
และ [กฎ Save Payment ที่โอมยืนยัน](ap-payment-save-rules.md)

Backend เก็บ master IDs + snapshot ใน Invoice detail / Payment header และ WHT rows
แทนการนำ catalog mock มาอ้างเป็นหลักฐาน การทดสอบ GL logic อัตโนมัติไม่แทนผล Post จริงบน Dev

`doc_type`, `doc_source`, `vendor_id`, `currency_id` ของ Invoice และ `vendor_id`
ของ Payment เป็น immutable หลังสร้างตาม update schema การเปลี่ยนข้อจำกัดนี้
เป็นงาน contract แยก ไม่ใช่การปลด disabled ของ input ใน frontend

Invoice FRD §3.4 ระบุว่า Discount Profile ถูกถอดแล้ว จึงไม่ยก profile/rate จาก
internal design เก่ากลับมาเป็น field ที่ต้องเติม ส่วน Due Date ตาม FRD เป็นค่า
derived จาก Invoice Date/Credit Days; การ override แยกที่ internal design เสนอ
ไม่ใช่ requirement ของการเติม field ในรอบนี้

## Posting point ที่ต้องคงไว้

ตาม decision ใน Payment design: Save Draft ไม่ post และไม่ตัดหนี้;
Submit ที่ validate ผ่านเมื่อไม่มี LOA หรือ final approval เมื่อมี LOA เป็นจุด
post PV/JV/apply open items แบบ atomic ใน backend การติดตามผลธนาคารไม่ใช่
เงื่อนไขก่อน posting และ UI ห้ามแสดง Posted ว่าเป็นหลักฐานว่า bank execution สำเร็จ
