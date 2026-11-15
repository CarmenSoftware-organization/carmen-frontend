# Payment Type / WHT Form / WHT Service Type — mockup QA

สถานะ 2026-11-15: ทั้งสามหน้าเป็น **MOCKUP รอ API** ตามคำสั่งโอม ใช้ logic จาก
HTML อ้างอิงและคง Carmen theme ด้วย ConfigListTemplate, ConfigEntityDialog,
Field, LookupCombobox, StatusBadge และ dependency dialog เดิม

## HTML อ้างอิง

- [Payment Type Master v1.4](https://drive.google.com/file/d/1BJOHsVGRYI6kVMHHUk2xHAcy_mv5GYVS/view)
- [WHT Form Master v1.4](https://drive.google.com/file/d/1n0rzdqHGkJj84wid8662RXGSU64A-irc/view)
- [WHT Service Type Master v1.1](https://drive.google.com/file/d/1nOeKF6DQy8FsC98ajnYgPB5W1E7FAGst/view)

## พฤติกรรมที่จำลอง

| หน้า | Logic |
| --- | --- |
| Payment Type | ตัวอย่าง 5 รายการ; GL บังคับและเปลี่ยนแล้วแทน Cost Center/dimensions/bank ด้วย defaults ของบัญชี; เลือก bank หรือเปิด cheque เติมแบบพิมพ์; ปิด cheque ล้างแบบพิมพ์; ต้องเลือก AP/AR อย่างน้อยหนึ่งด้าน |
| WHT Form | ตัวอย่าง 1/2/3/53; ไม่มี rate; GL ไม่บังคับ; เปลี่ยน GL แทน Cost Center และชุด dimensions ด้วย defaults โดยไม่เปิดเพิ่ม/ลบ category เอง |
| WHT Service Type | ตัวอย่าง 01–06; rate 0–100 แสดงสองตำแหน่ง ไม่ปัดค่าที่ precision เกินให้ผ่าน; ค้นด้วย code/description/rate |
| ทุกหน้า | เพิ่ม/อ่าน/แก้/ลบใน session; code unique และเปลี่ยนไม่ได้หลังสร้าง; ตรวจ doc_version; filter status, sort, paging, list/cards; บล็อก deactivate/delete ตาม fixture references พร้อมชื่อ vendor ตัวอย่าง |

WHT Form 53 มีประวัติใช้ จึงลบไม่ได้ แต่ปิดสถานะได้เพราะไม่มี active vendor link
ในตัวอย่าง ส่วน Form 3 และ Payment Type CHQ-BBL แสดง vendor ที่ต้องแก้ reference ก่อน
Service 01–04 มี vendor/history จึงปิดและลบไม่ได้; Service 05–06 ทดลองลบได้
จำนวนประวัติ Payment/Form เป็น fixture สำหรับแสดง guard ไม่ใช่ยอดจริงบน dev

## ขอบเขตข้อมูล

- `createApMasterMockCrud` เก็บใน QueryClient key `ap-master-mockup` แยก BU/master
  ใช้ fixture ใน `ap-master-mock-data.ts`; ไม่ใช้ localStorage และ reload คืนข้อมูลตั้งต้น
- CRUD, dependency, GL, Cost Center, dimension, bank และ cheque form ของสามหน้านี้
  ไม่เรียก HTTP ทุก lookup ใช้ข้อมูลตัวอย่างที่สัมพันธ์กันตาม HTML
- ไม่มีการเขียน dev database, สร้าง AP transaction หรือ post GL ในรอบ mockup นี้
  Backend source/migration เก็บแยกไว้ตาม [API scope](accounting-master-api-2026-11-15.md)
  และยังไม่ deploy/apply migration
- Tax Profile editor คง Name/Tax Rate/Active; ลบ runtime arrays `TAX_PROFILE_TYPES`
  และ `WHT_PND_FORMS` แล้ว Create DTO ส่งเฉพาะ field ที่เอกสารรองรับ ส่วน read union
  และ metadata ของ API ยังอยู่สำหรับ lookup ของ AP เดิม

## Verification

- 56 tests / 8 files ผ่าน: master session CRUD/validation/dependencies/no-HTTP,
  config dialog access, Tax Profile dialog/schema/lookup, shared license behavior
  และ regression ของ mock store เดิมที่ยังใช้โดย master อื่น
- TypeScript, scoped ESLint, diff whitespace และ local-config build ผ่าน
  (`SKIP_VERSION_BUMP=1`, `BUILD_CONFIG_FILE=config.local.json`)
- React Doctor diff 84/100: คง 4 maintainability warnings ใน AP Invoice/Payment
  จากชุดงานก่อน ไม่มี master mockup อยู่ในรายชื่อ warning
- Browser จริง: เพิ่ม–แก้–ลบ Payment Type แล้วรายการเปลี่ยนทันที; GL เติม CC/dimension/
  bank และ cheque form; CHQ-BBL ปิดสถานะไม่ได้และเห็น vendor dependencies
- WHT Form: เปลี่ยน GL ของ Form 2 เป็น 2191-053 แล้วได้ D1/D3/D6 แทน D4;
  Save แล้วตรวจค่าบน cards ได้
- WHT Service Type: เห็น rate สองตำแหน่งและรายการ inactive; search `5.00` เหลือ 02;
  ทดลองปิด 01 แล้วถูกบล็อกพร้อม vendor 3 รายและประวัติ AP payment 11 รายการ
- Reload แล้วข้อมูลตั้งต้นกลับมาและแสดงป้าย MOCKUP; เปิด preview Payment Types ค้างไว้
  โดยไม่เปลี่ยนแท็บ Document Management เดิมของโอม

Browser รอบนี้วัดจริงที่ 1280px และไม่มี document horizontal overflow; viewport
provider ไม่เปลี่ยน innerWidth ตาม override จึงไม่อ้างผลหลายขนาดจอจากรอบนี้
ไม่ได้ทดสอบ live master API/database CRUD หรือ integration ไป AP/AR/GL

## ภาพหลักฐาน

- [Payment Type / cheque defaults](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/payment-type-mockup-form.jpg)
- [Payment Type / dependencies](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/payment-mockup-dependency.jpg)
- [WHT Form / account defaults](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/wht-form-mockup-defaults.jpg)
- [WHT Service Type / list](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/wht-service-mockup-list.jpg)
