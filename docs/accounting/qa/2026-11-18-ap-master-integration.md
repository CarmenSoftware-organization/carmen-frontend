# AP master integration QA — 2026-11-18

## สถานะ

Implementation อยู่บน branch `codex/ap-master-integration` ทั้ง frontend และ backend รวม main ล่าสุด ณ เวลาตรวจแล้ว
ยังไม่ deploy backend / apply migration และ **ยังไม่ยืนยัน Save → Reload → Post → GL จริงของ flow ใหม่**

## สิ่งที่เชื่อม

- Invoice line ส่ง/อ่าน WHT Service Type ID, อัตราและ snapshot ชื่อ เก็บ legacy Tax Profile ได้สำหรับเอกสารเดิม
- Payment เลือก Payment Type จริง, default bank/method และใช้ GL account/Cost Center/Dimensions ของ master ตอน Post
- WHT ใช้ Service + Form IDs โดยไม่ต้องสร้าง Tax Profile ปลอม; rate/account resolve ที่ backend
- เก็บ snapshot แล้วใช้ตอน Reload/Post รวม lookup และ typed Dimension values (false/0/decimal/date ไม่ถูกทิ้ง)
- Vendor profile เพิ่ม Payment Type/WHT Form/WHT Service default ผ่าน CRUD; new Payment เติม default โดยไม่ทับค่าที่ผู้ใช้แก้แล้ว
- PND.53 เป็น default เมื่อ Vendor ไม่ตั้ง Form; Condition default = withholding เปลี่ยนได้แต่ null ไม่ได้
- กฎ Save ใหม่, Payment ศูนย์ และ Other Expense Debit/Credit ดู [ข้อกำหนดที่โอมยืนยัน](../ap-payment-save-rules.md)

## ทดสอบอัตโนมัติ

- Frontend AP + Vendor form: 82 tests ผ่าน (รันทวนหลังรวม main)
- Micro-business AP master/money/GL + master mapping/Payment Type/WHT Form/Vendor: 72 tests ผ่าน
- Gateway AP payment request: 2 tests ผ่าน
- ครอบคลุม negative input, ยอดไม่สมดุล, payment=0, Credit expense, FX rounding เมื่อจ่ายศูนย์, partial VAT-exclusive WHT base, master IDs/snapshot round trip และ legacy compatibility
- Typecheck frontend/gateway/micro-business และ scoped ESLint ผ่าน; backend builds ผ่าน
- Frontend Vite production build ผ่าน โดยใช้ config.local ใน APP_CONFIG_JSON; ไม่ได้ deploy
- React Doctor 91/100 เหลือ warning 1 จุดเรื่องเติม Vendor defaults หลัง query สำเร็จ ตรวจแล้วมี vendor ID guard, เติมครั้งเดียว และ helper ไม่ทับค่าที่แก้เอง มี unit test ครอบคลุม จึงคงพฤติกรรมนี้โดยไม่ suppress rule
- ผลตรวจ source เหล่านี้ไม่ใช่หลักฐานว่า API รุ่นนี้ deploy แล้ว

## ตรวจ API/UI จริงบน Dev

- Frontend localhost:3000 ใช้ API `dev.blueledgers.com:4001`, BU `CARMEN-FIFO`
- เลือก QA-PAY-01 จาก lookup จริงแล้ว bank default เป็น DEVQA-BANK
- Invoice และ Payment lookup เรียก WHT Service master จริง (QA-SVC-01 3%, QA-SVC-02 5%)
- สร้าง Form code `PND53`, description `PND.53 / ภ.ง.ด.53`, id `aec74543-a64b-440d-bb7c-fcd008e528c0` ด้วย API จริง (201) สำหรับ default ที่โอมเลือก; ไม่กำหนด GL override ใช้ default WHT payable ตาม GL Settings
- เปิด new Payment → Add WHT เห็น PND53 และ Condition 1 เป็นค่าเริ่มต้น; เลือก QA-SVC-01 ผ่าน lookup จริง
- ตรวจหน้า new Payment ที่ 1366px และ 390px ไม่มี horizontal overflow ของ document; view/edit ของเอกสาร master flow ใหม่รอ Save/Reload จริงหลัง rollout
- ไม่มีการ Post เอกสารใหม่ของ flow นี้ใน Dev ระหว่างเตรียม implementation

## Rollout ที่ต้องทำก่อน live test

1. ตรวจ migration status และไฟล์ pending บน Dev อีกครั้ง: main ล่าสุดเพิ่มงาน Dimensions ที่อาจยังไม่ apply ครบ ห้ามกด deploy-all โดยไม่ตรวจราย BU
2. Deploy backend gateway + micro-business ที่รวม branch นี้
3. Apply migration `20261118100000_ap_wht_master_reference` เฉพาะ BU ที่ทดสอบ (`CARMEN_FIFO`) หลังได้รับอนุมัติ DDL ที่เจาะจง
4. DDL นี้ปลด NOT NULL ของ `tb_ap_payment_wht.wht_tax_profile_id`, สร้าง enum `enum_ap_wht_condition` และเพิ่ม `tb_ap_payment.wht_condition` default withholding ไม่มีการลบข้อมูล
5. ทดสอบ Invoice/Payment Save, Reload, Submit/Post และอ่าน generated JV/GL จริง รวม CoA, CC, Dimensions, WHT rate, เครดิต Other Expense, zero Payment และยอดค้าง

ห้ามถือว่า frontend ที่ส่ง field ใหม่พร้อมใช้กับ backend เก่า: gateway เก่าอาจตัด field ที่ยังไม่รู้จัก จึงต้อง rollout backend ก่อน frontend

## ขอบเขตที่ยังแยกไว้

ยังไม่ทำ multi-bank allocation, beneficiary verification, WHT certificate/filing, แก้ payee tax identity และ Other Expense dimensions ซึ่งเป็น contract คนละส่วน
Cheque form ยังอยู่ใน Detail; QA BU ไม่มี cheque form ที่อนุญาต จึงยังไม่ยืนยัน cheque flow จริง

Rollback: หลังมี WHT rows แบบใหม่ที่ profile เป็น null ห้ามย้อน backend ไปเวอร์ชันที่อ่านได้เฉพาะ Tax Profile และห้าม SET NOT NULL กลับโดยไม่จัดการข้อมูลใหม่ ต้องคง reader ที่รองรับ master IDs ไว้
