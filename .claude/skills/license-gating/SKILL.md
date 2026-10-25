---
name: license-gating
description: ใช้เมื่อแตะ license gating ฝั่ง FE — canWrite / useCan().guard() / ฟิลด์ licenseFeature ใน constant/module-list.ts / LICENSE_ENFORCEMENT ใน runtime config หรือผูก leaf กับ license feature key ใหม่
---

# License gating (FE)

- **License gating ฝั่ง FE ครอบไม่ครบโดยตั้งใจ** — จุดที่ปิดปุ่มเขียนตาม `canWrite` จริง
  **มีแค่ 3 จุด** คือ `FormToolbar` (Save/Edit/Delete), row actions ของ data-grid
  (`useConfigTable` → `DataGridRowActions`) และ `ConfigListTemplate` (ปุ่ม Add + `readOnly`
  ของ dialog แก้ไข) ปุ่มอื่นที่เรียก mutation ตรงจะยังกดได้แล้วเด้ง 403 จาก backend
  ซึ่งยอมรับได้เพราะ `LicenseInterceptor` ที่ gateway คือตัวบังคับจริง การไล่ปิดทุกปุ่ม
  เป็นงานที่ไม่มีวันจบและตรวจไม่ได้ว่าครบ
- **`useCan().guard()` ยังไม่มีผู้เรียกสักจุดเดียวในแอป** — มันเช็ค `canWrite` ก่อน `can()`
  แล้วเด้ง dialog ให้ตามเหตุผล (expired/permission) และมีเทสต์ครบ แต่ไม่มีใคร destructure
  ออกมาใช้ (ทุก call site ของ `useCan()` เอาแค่ `can`/`isAdmin`/`canWrite`) — **อย่าอ่านว่า
  "การเขียนถูกบล็อกทุกที่ที่มี guard"** ถ้าจะใช้ต้องไปเสียบที่ handler เอง:
  `const { guard } = useCan(); <Button onClick={guard(PERMISSIONS.x.create, doCreate)}>`
  เก็บโค้ดไว้เพราะมันถูกและเป็นทางลัดที่พร้อมใช้ ไม่ใช่เพราะมันทำงานอยู่
- **license feature key ≠ permission key** — `constant/module-list.ts` มีฟิลด์
  `licenseFeature` ไว้ระบุ feature ของ leaf ตรง ๆ เมื่อ key ที่คำนวณจาก `permission`
  ไม่ตรง catalog ของ backend (เช่น `report_analytics.view` → `report.list`,
  `product_management.unit.view` → `configuration.unit`) ค่าที่ใส่ต้องมาจาก
  `LICENSE_ROUTE_FEATURES` ของ backend เท่านั้น และ
  `constant/module-list.license-feature.test.ts` จะแดงถ้า key ที่ผลิตได้ไม่มีใน catalog
  (สำเนา catalog อยู่ที่ `constant/__fixtures__/license-catalog.ts` พร้อมวิธีอัปเดต)
- **`LICENSE_ENFORCEMENT` เปิดอยู่จริงแล้วทุก environment** (ตรวจ 2026-09-20) — เป็น
  optional key ใน `RuntimeConfig` (`lib/runtime-config.ts`) ที่ default `false`
  (shadow mode) แต่ `public/config.{local,dev,uat,prod}.json` **ตั้ง `true` ครบทุกไฟล์
  แล้ว** ไฟล์พวกนี้ถูก gitignore (`public/config*.json` ยกเว้น `public/config.sample.json`)
  จึงอ่านจากรีโปไม่เห็น — **อย่าอ่านค่า default ว่า "ยังไม่มีผล"** และไม่มีทางเปิด/ปิด
  ผ่าน env var หรือ build flag ต้องแก้ที่ไฟล์ config ของ environment นั้น
  ผลที่ตามมา: การผูก leaf กับ **license feature key ใหม่ล็อกหน้านั้นทันทีที่ deploy**
  สำหรับ BU ที่ยังไม่ถูก assign feature การเพิ่มคีย์ระดับ resource จึงต้องทำสามขั้นตาม
  ลำดับเสมอ — deploy backend → `db:seed.license-feature` ของ env นั้น → assign feature
  ให้ทุก BU ที่ carmen-backstage → ค่อย deploy FE (ตรวจงาน license ในเครื่องด้วยการสลับ
  `LICENSE_ENFORCEMENT` เป็น `false` ชั่วคราวแล้วคืนค่า)
