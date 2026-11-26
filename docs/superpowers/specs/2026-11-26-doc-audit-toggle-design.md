# สวิตช์เปิด/ปิดตาราง audit ในหัวเอกสาร (ราย BU)

## เป้าหมาย
ให้ผู้ดูแล BU เปิด/ปิดตาราง audit ("สร้างโดย / แก้ไขล่าสุดโดย" + rev.) ในการ์ดหัวเอกสารได้เอง
เหมือนฟีเจอร์ตัวหนึ่ง — ค่าเริ่มต้น **เปิด** (BU ที่ไม่เคยตั้ง = เห็นเหมือนเดิม)

## Approaches
- **ก. ค่าตั้ง BU ในหน้า Default Setting** ← เลือก: ผู้ดูแล BU กดเองได้, ทำตาม skill
  `add-business-setting-config` (registry + i18n), ไม่ต้องแก้ backend, ไม่มีลำดับ deploy
- ข. License feature ใน carmen-backstage — เหมาะกับของขาย แต่ต้อง seed/assign ทุก BU ก่อน FE
  (`LICENSE_ENFORCEMENT` เปิดอยู่ = พลาดแล้วหายทุก BU) และระบบ license ยังล็อกได้แค่ระดับหน้า

## Design
- **คีย์สองตัว** (boolean · `defaultValue: "true"` ทั้งคู่ · section `general` ของ `CONFIG_SECTIONS`
  ใน `routes/system-admin/company-profile/company-profile-config-registry.ts` + i18n en/th):
  - `general.show-doc-audit` — แถว "สร้างโดย / แก้ไขล่าสุดโดย" (`config.generalShowDocAudit`)
  - `general.show-doc-revision` — ช่อง rev.x (`config.generalShowDocRevision`)
- **อ่านค่า:** hook ใหม่ `hooks/use-doc-audit-visibility.ts` คืน `{ showAudit, showRevision }` —
  `useProfile().defaultBu` → `useBusinessUnit(id)` → `resolveBuConfigValue(config, key)`
  (แบบเดียวกับ `use-recipe-price-rates`) ค่าที่ไม่ใช่ `"false"` (รวมยังไม่โหลด/ไม่ได้ตั้ง) = แสดง
- **จุดบังคับ:** `DocAuditLine` และ `DocAuditButton` (`components/share/doc-audit-line.tsx`)
  ครอบทั้ง 15 หน้าที่ใช้อยู่ โดยไม่แตะ call site
  | audit | rev | ผล |
  |---|---|---|
  | เปิด | เปิด | เหมือนเดิม (แถว audit + ช่อง rev. ทางขวา) |
  | เปิด | ปิด | แถว audit อย่างเดียว |
  | ปิด | เปิด | กล่องเล็กช่องเดียว `rev. x` (สไตล์ขอบเดียวกัน) — หน้าที่ไม่ส่ง `docVersion` = ไม่ render |
  | ปิด | ปิด | ไม่ render · ปุ่ม Info บนมือถือก็หาย |
  ปุ่ม Info บนมือถือโชว์เมื่อมีอย่างน้อยหนึ่งส่วนให้แสดง
- ค่าคีย์/ค่าตั้งต้นเป็น constant ใน `lib/` ใช้ร่วมกันระหว่าง registry กับ hook

## Non-goals
- คอลัมน์ Created/Updated ในตาราง list, Excel export, activity sheet — ไม่เปลี่ยน
- ไม่บังคับฝั่ง backend (ข้อมูล `audit` ยังมากับ API ตามเดิม — นี่คือการซ่อนบนจอ ไม่ใช่ความปลอดภัย)

## Calls ของผู้ออกแบบ (แก้ได้)
- แยกเป็นสองคีย์ตามที่ผู้ใช้สั่ง (rev. ไม่ผูกกับ audit)
- กรณีปิด audit แต่เปิด rev. ให้เหลือกล่อง `rev. x` ช่องเดียวในตำแหน่งเดิม
- ระหว่างโหลด BU config ให้แสดงไว้ก่อน (ค่าเริ่มต้นเปิด) — ไม่กระพริบสำหรับ BU ส่วนใหญ่
- ชื่อคีย์ `general.show-doc-audit` / `general.show-doc-revision`
