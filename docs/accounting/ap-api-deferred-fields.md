# AP fields waiting for an API contract

ตรวจสัญญา request/response วันที่ 2026-11-15 เพื่อแยกงาน backend ออกจากการเติม
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
| Payment Type integration | เลือกประเภทการจ่ายจาก master และใช้กฎของประเภทนั้น | Backend catalog CRUD source/migration พร้อมแต่ยังไม่ deploy; UI เป็น session mockup รอ API ตามคำสั่งล่าสุด AP request ยังรับ `payment_method` enum ไม่รับ `payment_type_id` ต้องเชื่อม transaction writer และกฎ master ต่อ |
| WHT Form integration | เลือกแบบยื่นและบัญชีที่กำหนดจาก master | Backend catalog CRUD source/migration พร้อมแต่ยังไม่ deploy; UI เป็น session mockup รอ API Tax Profile writer ยังรับ `wht_pnd_form` enum และ posting account แยก ไม่รับ `wht_form_id` จึงยังไม่เชื่อม defaults/posting rules |
| WHT Service Type integration | เลือกประเภทบริการและ default WHT rate จาก master | Backend catalog CRUD source/migration พร้อมแต่ยังไม่ deploy; UI เป็น session mockup รอ API Tax Profile writer ยังรับ `wht_income_type` free text และ `tax_rate` แยก ไม่รับ `wht_service_type_id` ต้องเชื่อม identity และการ resolve default rate ต่อ |
| Payment bank allocations | แบ่งหนึ่ง PV จ่ายจากหลายบัญชีหรือหลาย payment methods | Request/response มี `bank_account_id` และ `payment_method` เดี่ยว ไม่มี bank allocation array |
| Payment bank / WHT GL Cost Center | ระบุ Cost Center ของบรรทัด Bank และ WHT payable ใน generated JV | Payment header และ WHT row request ไม่มี Cost Center; `buildPaymentJvLines` ไม่ส่ง `cost_center_id` ให้สอง leg นี้ จึง post ไม่ผ่านเมื่อบัญชี Bank/WHT ตั้ง `is_require_cost_center=true` ต้องเพิ่ม contract + posting derivation ก่อนทำ UI ส่วน AP leg ใช้ `cr_cost_center_id` จาก Invoice และ expense มี `cost_center_id` ให้แก้ใน UI/API แล้ว |
| Payment beneficiary | Verified beneficiary bank instruction snapshot | Response มีบัญชีธนาคารที่ใช้จ่ายและ payee name/tax/address แต่ไม่มี beneficiary instruction snapshot/verification reference |
| Payment execution | Bank execution/reconciliation, cheque lifecycle และ controlled priority | Response มี `doc_status`, payment/paid dates และ cheque/reference fields แต่ไม่มี execution/reconciliation/cheque-state/priority contract ต้องแยกจาก accounting posting status |
| Payment WHT | Certificate no./filing linkage, calculated-versus-overridden value, override reason/approver | Request รับ profile/base/amount/`is_override`; response เพิ่ม PND form/income type/rate แต่ไม่มี certificate/filing linkage หรือข้อมูล audit ของ override เป็นราย WHT row |
| Payment WHT payee | แก้ชื่อ/Tax ID/branch/address และ WHT condition ตาม FRD §3.4 | Response มี payee snapshot ให้อ่าน แต่ request ไม่มี payee/condition fields จึงไม่ทำ editor ที่บันทึกไม่ได้ |
| Payment expense dimensions | Dimensions เฉพาะรายการค่าใช้จ่าย ตาม FRD §3.5 | Expense request รับบัญชี/Cost Center/description/amount แต่ไม่มี dimensions array |
| Posting preview | Preview ตาม posting rules ก่อน Submit/approval | AP CRUD คืน generated JV id/no หลัง posting; ไม่มี posting-preview response ใน gateway AP routes ปัจจุบัน ห้ามใช้ browser calculation เป็น authoritative posting preview |
| Invoice audit author | ชื่อผู้แก้คู่กับ Updated timestamp | Response มี `updated_at` + `updated_by_id` แต่ไม่มี updater name/`audit.updated`; gateway ไม่ใช้ `@EnrichAuditUsers()` ชื่อ `last_action_by_name` เป็น workflow actor จึงใช้แทนผู้แก้ไม่ได้ UI แสดง timestamp และรอ enrichment ที่ไม่ต้องเพิ่มสิทธิ์อ่าน user directory |

หลักฐานของสาม catalog ที่ยังไม่เชื่อม API:

- `routes/config/{payment-type/payment-type,wht-form/wht-form,wht-service-type/wht-service-type}-page.tsx`
  ใช้ `createApMasterMockCrud` จาก `routes/config/shared/ap-master-crud.ts`
  เก็บตัวอย่างใน QueryClient แยกตาม BU ไม่ใช้ localStorage และ reset เมื่อ reload
  ดู [HTML logic และ mockup QA](accounting-master-mockup-2026-11-15.md)
- Backend `apps/backend-gateway/src/application/ap-payment/swagger/request.ts`
  รับ `payment_method` enum และ `wht_tax_profile_id` แต่ไม่มีสาม catalog IDs
- Backend `apps/backend-gateway/src/common/dto/tax-profile/tax-profile.dto.ts`
  รับ `wht_pnd_form` enum และ `wht_income_type` free text; ไม่รับ WHT Form / Service Type master IDs

ผลทดสอบ CRUD / posting / GL ที่ผ่านในรอบนี้ยืนยันเฉพาะ Payment ตาม API ปัจจุบัน:
ใช้ `payment_method` enum และ Tax Profile จริงที่กำหนด rate, PND form และ income metadata
การทดสอบนี้ไม่ยืนยันการเชื่อมสาม catalog หรือ Payment workflow ครบทั้ง FRD
และไม่ใช้ mock catalog เป็นหลักฐานว่า master integration พร้อมใช้งานแล้ว

หลักฐานของข้อจำกัด Payment bank / WHT GL Cost Center ใน backend repository
`carmen-turborepo-backend-v2`:

- `apps/backend-gateway/src/application/ap-payment/swagger/request.ts`:
  `ApPaymentCreateRequestSchema` และ `Wht` ไม่มี Cost Center; `Expense` รองรับอยู่แล้ว
- `apps/micro-business/src/ap/ap-payment/interface/ap-payment.interface.ts`:
  `ICreateApPayment` / `IApPaymentWhtInput` ไม่มี Cost Center
- `apps/micro-business/src/ap/ap-payment/ap-payment.logic.ts`:
  `buildApLegs` ส่ง Invoice `cr_cost_center_id`; `buildPaymentJvLines` ส่ง CC เฉพาะ expense
  และไม่กำหนด CC ให้ Bank / WHT
- `apps/micro-business/src/gl/gl-jv/gl-jv.validation.ts`:
  `validateJvLines` คืน `GL_COST_CENTER_REQUIRED` เมื่อ account กำหนด
  `is_require_cost_center=true` แต่ generated line ไม่มี `cost_center_id`

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
