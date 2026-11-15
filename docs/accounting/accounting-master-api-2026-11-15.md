# Payment Type / WHT Form / WHT Service Type — API และ UI

สถานะล่าสุด 2026-11-15: ตามคำสั่งโอม หน้า master ทั้งสามเปลี่ยนเป็น **mockup รอ API**
ที่ทำงานเฉพาะ session และอิง logic จาก HTML โดยคงธีม Carmen เดิม ดู
[mockup QA และ HTML อ้างอิง](accounting-master-mockup-2026-11-15.md)
รายละเอียด API ด้านล่างเป็น source ที่เตรียมไว้ ยังไม่ได้ apply migration หรือ
deploy backend dev จึงยังไม่ยืนยัน live database CRUD ของ master ทั้งสามรายการนี้
การ post AP ที่ทดสอบก่อนหน้านี้ใช้ payment-method enum และ Tax Profile เดิม
ไม่ได้เป็นหลักฐานว่า master ใหม่เชื่อม transaction แล้ว

## เอกสารอ้างอิง

- [Payment Type FRD v1.0](https://docs.google.com/document/d/1XFtuGdLYv1_SZew49ZirgJnFsxPDpa1GHpv9DFnhA5k/edit)
- [WHT Form FRD v1.0](https://docs.google.com/document/d/1-DwFkt9BEJLg4Xy3pcNqv-BZ4e6a2vvCNVJF9s3Fzdw/edit)
- [WHT Service Type FRD v1.0](https://docs.google.com/document/d/1odN7OuFlUsZgKetgs1yDwnmV__ghtP38GX7o1pWPN9g/edit)

## สัญญา API

ฐาน URL คือ `/api/config/:bu_code/{payment-types,wht-forms,wht-service-types}`
ข้อมูลแยกตาม tenant ของ BU ใช้ Keycloak, AppIdGuard และ permission เดิม
`accounting.config.ap` ตาม action `view/create/update/delete` ไม่เพิ่ม license feature ใหม่

| Method / path ต่อท้าย | การทำงาน |
| --- | --- |
| `GET /` | ค้นหารหัส/คำอธิบาย กรองสถานะ เรียงลำดับ และแบ่งหน้า |
| `GET /:id` | อ่านรายละเอียดพร้อมชื่อข้อมูลอ้างอิงและ dimensions |
| `POST /` | สร้าง คืน `id` และ `doc_version` |
| `PUT /:id` | แก้บาง field ได้ ต้องส่ง `doc_version`; ห้ามเปลี่ยน code |
| `DELETE /:id?doc_version=N` | Soft delete แบบตรวจ version และ historical references |
| `GET /:id/dependencies` | คืน `is_used`, `can_deactivate`, `can_delete`, `references: [{type,count}]` โดยไม่เปิดเผยชื่อ vendor/customer |
| `GET /account-mapping/:account_id` | Payment Type และ WHT Form: อ่าน Cost Center และกฎ dimension จากบัญชีจริง |
| `GET /cheque-forms` | Payment Type เท่านั้น: แบบเช็คที่เปิดใช้และ BU นี้มีสิทธิ์ |

| Master | ข้อมูลที่รองรับ |
| --- | --- |
| Payment Type | code ไม่เกิน 10 ตัว, description 50, AP/AR ต้องเปิดอย่างน้อยหนึ่งด้าน, GL บังคับ, Cost Center/dimensions ตามบัญชี, bank profile ไม่บังคับ, is_cheque และ cheque_form_id ที่บังคับเมื่อเป็นเช็ค |
| WHT Form | code ไม่เกิน 15 ตัวและยอมรับ `/` กับ `-`, description 100, GL ไม่บังคับ, Cost Center/dimensions ตามบัญชี |
| WHT Service Type | code ไม่เกิน 15 ตัว, description 255, rate_percent 0–100 ทศนิยมไม่เกินสองตำแหน่ง |

ทุก master มีสถานะ audit และ `doc_version` รหัส trim/uppercase และไม่อนุญาตให้นำ
รหัสของแถวที่ soft delete แล้วกลับมาใช้ซ้ำ WHT rate อยู่ที่ Service Type เท่านั้น
ไม่มี field mock เดิม `payment_method`, `description_local` หรือ `form_type` ในสัญญาใหม่

การปิดสถานะตรวจ active profile/vendor และ pending transaction ส่วนการลบตรวจประวัติ
ทั้งหมดรวมแถว void/soft delete และคืน dependency counts เมื่อถูกบล็อก
Activity registry บันทึก create/update/delete ด้วย entity `tb_payment_type`,
`tb_wht_form`, `tb_wht_service_type` พร้อม snapshot ของ dimension mappings

## UI และ mapping ของ API (พักไว้ระหว่างใช้ mockup)

ส่วนนี้อธิบายการเชื่อม API ที่เตรียมไว้ก่อนเปลี่ยนเป็น mockup ตามคำสั่งล่าสุด
หน้าปัจจุบันใช้ fixture defaults จาก HTML และไม่เรียก API เหล่านี้

ใช้ `ConfigListTemplate`, `ConfigEntityDialog`, Field/Lookup และ token เดิม มีโหมดอ่าน
เป็น plain text, code อ่านอย่างเดียวเมื่อแก้ไข, delete ส่ง version ของแถวที่เลือก
และแสดง dependency ก่อนดำเนินการ หน้าทั้งสามเลิกอ่าน/เขียน localStorage mock แล้ว

เมื่อเปลี่ยน GL จะล้าง Cost Center/dimension เดิม และอ่านรายการที่บัญชีนั้นอนุญาต
จาก API ไม่ใช้ Department ID แทน Cost Center ไม่เปิดให้เพิ่ม/ลบ category นอกกฎบัญชี
เลือก dimension value ได้จากข้อมูลจริงต่อ category เท่านั้น

COA ปัจจุบันไม่มี persisted default Cost Center/default dimension values จึงส่ง
`default_cost_center_id: null` ไม่สร้างค่าเริ่มต้นสมมติ หากจะให้เลือก default อัตโนมัติ
ต้องเพิ่มสัญญาของ COA ก่อน

แบบเช็คใช้ report template กลางที่ active, `template_type=form`, `report_group=CHEQUE`
และผ่าน allow/deny BU โดย deny มีลำดับสูงกว่า allow ไม่สร้าง catalog จำลองอีกชุด
หากยังไม่มีแบบเช็คที่อนุญาต จะไม่มีรายการให้เลือกและสร้าง payment type แบบเช็คไม่ได้

## Migration และขอบเขตที่ยังแยกไว้

Backend: `C:\source\carmen-turborepo-backend-v2`
Migration: `packages/prisma-shared-schema-tenant/prisma/migrations/20261115090000_accounting_payment_wht_masters/migration.sql`
เพิ่ม master 3 ตาราง, dimension mapping 2 ตาราง, nullable reference columns และ indexes
พร้อม CHECK ของ code/AP-AR/cheque/rate ไม่ลบหรือแปลง field transaction เดิม

ต้องใช้ขั้นตอน tenant migration ต่อ BU ของ backend ก่อน deploy UI ที่เรียก endpoint นี้
หลัง deploy ตรวจ application API allowlist ของ `x-app-id` ด้วย หากไม่ได้เปิด `allow_all`
ต้องอนุญาตกลุ่ม `payment-types.*`, `wht-forms.*`, `wht-service-types.*` ที่เพิ่มใน generated catalog
ไม่มีการ migrate database หรือ deploy ในงานรอบนี้ เพราะยังไม่มี PostgreSQL dev connection
สำหรับตรวจสอบ และ Docker database ในเครื่องยังไม่ทำงาน

nullable reference columns เตรียม dependency identity แต่ AP/AR/Vendor/Tax Profile
writers ยังไม่รับหรือ resolve master IDs ใหม่ ไม่แปลง PND enum หรือ income-type text
เป็น master ID อัตโนมัติ งานเชื่อม defaults และ posting rules เป็นขั้นถัดไปหลัง master API
พร้อมใช้งานจริง ดูรายการอื่นที่ยังขาดใน [AP deferred fields](ap-api-deferred-fields.md)

## Verification ก่อนเปลี่ยนเป็น mockup

ผลด้านล่างเป็นหลักฐานของ backend source และ UI รุ่นก่อนหน้า ไม่ใช่ผลตรวจของ
mockup ปัจจุบัน ให้ใช้เอกสาร mockup QA ที่ลิงก์ไว้ด้านบนสำหรับหน้าจอล่าสุด

ทดสอบ DTO/CRUD/partial update/version conflicts/duplicate code/dependency guards,
tenant context, account mappings, cheque BU permissions และ Nest module wiring ด้วย
isolated test doubles ไม่ใช่ live database integration

| ชุดตรวจ | ผล |
| --- | --- |
| Micro-business masters + shared mapping + activity | 92 tests / 7 suites ผ่าน |
| Gateway masters/DTO/module wiring | 30 tests / 7 suites ผ่าน |
| Error catalog | 12 tests / 4 suites ผ่าน |
| Frontend masters + access + mock cleanup regression | 43 tests / 5 files ผ่าน |
| Prisma validate/generate และ shared package build | ผ่าน; packages 17/17 |
| Typecheck gateway + micro-business + frontend | ผ่าน |
| Nest build gateway + micro-business | ผ่าน |
| Frontend bundle build | ผ่านด้วย `BUILD_CONFIG_FILE=config.local.json`; build ปกติรอบแรกขาดไฟล์ `config.prod.json` ที่ gitignore จึงไม่ใช่การยืนยัน production environment config |
| Scoped ESLint และ diff whitespace checks | ผ่าน |
| RPC drift, literal pattern และ App API catalog audits | ผ่าน |
| Full license catalog / guard provider audits หลัง cleanup scope | License audit ยังรายงาน baseline drift ของ 6 legacy routes และ seed artifact เดิม; Windows guard-audit path fix ถูกนำออกจากชุดงานนี้ จึงไม่อ้างผลผ่านของ tool ที่เคยแก้ชั่วคราว ส่วน Nest module wiring tests ผ่าน |
| React Doctor diff | 84/100 เท่าเดิม; 4 maintainability warnings ใน AP Invoice/Payment จากงานก่อน ไม่มี master page อยู่ใน warning; diff scan ครอบคลุม tracked files ส่วนไฟล์ใหม่ตรวจด้วย ESLint/tests |

Regression สำคัญ: รวม historical references ที่ soft delete แล้ว; เช็กวันมีผล dimension
ด้วยวันของ BU แบบ date-only รวมวันสุดท้าย; ไม่ปล่อยให้ partial PUT reset ค่า default;
stale version และ backend dependency race ถูกบล็อก; ค่า WHT 3.251 ไม่ถูกปัดเป็น 3.25

UI QA รอบแรกเปิดฟอร์มจริงผ่าน route ชั่วคราวในเครื่องที่ไม่ persist fixture แล้วลบทิ้งครบ
ตรวจที่ 390/768/1366/1920/3840 px ไม่พบ horizontal overflow; ตรวจ required validation,
การแสดง `3.00`, การปฏิเสธ precision เกิน และ cheque lookup error ที่บันทึกต่อไม่ได้
คืนหน้าเดิมและ reset viewport แล้ว ไม่มี QA route หรือ fixture ค้างใน source
หน้า list ที่เรียก backend dev จริงยังคืน 404 เพราะ endpoint ใหม่ยังไม่ deploy
ดังนั้นผล form/transport tests ไม่ใช่ผล live CRUD หรือ live list data

ภาพฟอร์ม:

- [Payment Type 1366 px](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/master-payment-type-1366.jpg)
- [WHT Form 390 px](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/master-wht-form-390.jpg)
- [WHT Service Type 390 px](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/master-wht-service-390.jpg)

ข้อจำกัดของ checks: ไม่รัน lint ทั้ง repo แบบ autofix; raw-SQL audit ทั้ง repo ยังพบ
3 จุดเดิมนอกงานใน `tenant_reset.service.ts` และ `document-number.helper.ts`
ไม่ได้แก้ code เหล่านั้น ไม่มีการทดลอง migration กับ PostgreSQL จริง

หลังโอมตรวจ scope: คืน 179 ไฟล์ generated ที่ไม่มี content diff (line endings),
คืน Windows audit script และเอา 6 legacy license mappings ที่ generator พ่วงมาออก
เก็บเฉพาะ mapping ของ `payment-types`, `wht-forms`, `wht-service-types`
ไฟล์กลางที่เหลือเปลี่ยนเพื่อ register module/RPC/API permissions/activity/error/schema
ของทั้งสาม master เท่านั้น ไม่แก้ business logic ของ module อื่น

## Frontend follow-up: Tax Profile

ปรับ Tax Profile กลับเป็น Name, Tax Rate และ Active ตาม field table ของ
`docs/ui/modals/CB-MODAL-012-tax-profile-dialog.md` ไม่เพิ่มตัวเลือก VAT/WHT,
บัญชีลงภาษี, PND Form หรือ Income Type ในหน้านี้จากการอนุมาน API
AP Invoice FRD ยังระบุ WHT Tax 2 Profile แต่ไม่ได้กำหนด Config editor ดังกล่าว
และ foundation ยังมีคำถามเรื่อง ownership ระหว่าง TaxProfile กับ WHT masters

Save ของ Tax Profile ส่งเฉพาะสาม field พร้อม doc_version จึงไม่ส่ง null ไปทับ
classification/account/PND/income metadata เดิมที่ AP อ้างใช้อยู่ ไม่ลบ profile เดิม
และ lookup VAT/WHT ของเอกสารยังคงทำงานตาม API ปัจจุบัน

หน้า master เปิดไม่ได้เพราะ backend dev ยังคืน 404 ของ endpoint ใหม่ ปัจจุบันทั้งสาม
route ใช้ session mockup ตาม HTML จึงเปิดรายการและฟอร์มได้โดยไม่พึ่ง endpoint นี้
การแก้ error handling ชั่วคราวใน ConfigListTemplate ถูกคืนแล้ว ไม่เปลี่ยน shared template
เพื่อรองรับกรณีของ master ทั้งสามโดยเฉพาะ

- [Tax Profile ตามเอกสาร](C:/Users/thago/.codex/visualizations/2026/11/15/01a1dea2-2691-7141-bde2-7311c280f934/tax-profile-documented-fields.jpg)
- [สถานะและผลตรวจ mockup ปัจจุบัน](accounting-master-mockup-2026-11-15.md)
