# AP Payment — กฎการบันทึก

ยืนยันโดยโอม วันที่ 2026-11-18 ใช้แทนข้อกำหนด Save Draft เดิมใน FRD ที่ยอมให้ยอดไม่สมดุล

## ค่าเริ่มต้นและข้อมูลหลัก

- บัญชีฝั่งจ่าย, Cost Center และ Dimensions มาจาก Payment Type master ที่เลือก ส่วน Bank Account เป็นบัญชีธนาคารที่ใช้จ่ายจริง หาก Payment Type ผูกธนาคารไว้ต้องตรงกัน
- Payment Type เริ่มต้นจาก Vendor profile หากตั้งไว้ และต้องเลือกสำหรับ Payment ใหม่
- เอกสารไม่มี WHT ได้ หากเพิ่ม WHT ต้องเลือก Service อย่างน้อย 1 รายการ สูงสุด 3 รายการ พร้อม Form และ Condition ที่ไม่ว่าง
- Vendor ที่ตั้ง WHT Service ไว้จะได้แถว WHT อัตโนมัติ หาก Invoice ไม่ได้ระบุ WHT จะใช้บริการที่ Vendor ตั้งไว้
- Form เริ่มจาก Vendor profile ถ้าไม่มีใช้ PND.53 (master code `PND53`); Condition เริ่มที่ `1: หัก ณ ที่จ่าย` เปลี่ยนได้แต่ล้างไม่ได้
- Condition มี 1: หัก ณ ที่จ่าย, 2: ออกให้ตลอดไป, 3: ออกให้ครั้งเดียว โดยเก็บเงื่อนไขบนใบจ่าย ส่วนสูตรเริ่มต้นของยอด WHT ยังคำนวณจากฐาน × อัตราของ Service และรองรับยอด override ตาม FRD
- ไม่บังคับ Other Expense

## เงื่อนไขก่อน Save

`Invoice total = Payment total + WHT total - Other Expense total`

- Invoice total, Payment และ WHT ต้องไม่ติดลบ; Payment ทั้งใบเป็น 0 ได้
- Other Expense total เป็นยอดมีเครื่องหมาย: Debit บวก, Credit ลบ ผู้ใช้เลือก Debit/Credit และกรอกจำนวนบวกเท่านั้น
- ช่อง Payment, ฐาน WHT, ยอด WHT และ Other Expense ไม่รับการกรอกจำนวนติดลบ
- ถ้าสมการไม่สมดุล บันทึกไม่ได้ ตรวจซ้ำที่ backend โดยใช้ยอด WHT ที่ resolve จาก master ไม่เชื่อยอดจาก browser
- API ส่ง Other Expense เป็นจำนวนบวกคู่กับ `is_credit`; database เก็บยอด Credit เป็นลบ ส่วน generated GL แยกเป็น Credit จำนวนบวก
- ใบจ่ายศูนย์ไม่สร้าง Bank leg ที่เป็นศูนย์; หากมีเศษแปลงสกุลเงินจะลง realized FX เพื่อให้ GL สมดุล

Save Draft ไม่ post และไม่ตัดหนี้ การ Submit/final approval เป็นจุด Post และตรวจงวดบัญชี, ยอดคงเหลือ และ GL ตามกฎเดิม

## การเก็บข้อมูล

เก็บ master IDs และ snapshot ที่ backend ตรวจแล้วตอน Save; Reload อ่านค่าที่เก็บ และ Post ใช้บัญชี/Cost Center/Dimensions จาก snapshot เอกสารเดิมที่อ้าง Tax Profile ยังอ่านและทำงานได้

สถานะการทดสอบจริงและข้อจำกัดการ rollout อยู่ใน [QA](qa/2026-11-18-ap-master-integration.md)
