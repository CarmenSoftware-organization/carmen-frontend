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
- **คีย์:** `general.show-doc-audit` · boolean · `defaultValue: "true"` · อยู่ใน section `general`
  ของ `CONFIG_SECTIONS` (`routes/system-admin/company-profile/company-profile-config-registry.ts`)
  + i18n en/th (`defaultSetting.config.generalShowDocAudit`)
- **อ่านค่า:** hook ใหม่ `hooks/use-show-doc-audit.ts` — `useProfile().defaultBu` →
  `useBusinessUnit(id)` → `resolveBuConfigValue(config, key)` (แบบเดียวกับ `use-recipe-price-rates`)
  ค่าที่ไม่ใช่ `"false"` (รวมยังไม่โหลด/ไม่ได้ตั้ง) = แสดง
- **จุดบังคับ:** `DocAuditLine` และ `DocAuditButton` (`components/share/doc-audit-line.tsx`)
  ปิด = `return null` — ครอบทั้ง 15 หน้าที่ใช้อยู่ โดยไม่แตะ call site
- ค่าคีย์/ค่าตั้งต้นเป็น constant ใน `lib/` ใช้ร่วมกันระหว่าง registry กับ hook

## Non-goals
- คอลัมน์ Created/Updated ในตาราง list, Excel export, activity sheet — ไม่เปลี่ยน
- ไม่บังคับฝั่ง backend (ข้อมูล `audit` ยังมากับ API ตามเดิม — นี่คือการซ่อนบนจอ ไม่ใช่ความปลอดภัย)

## Calls ของผู้ออกแบบ (แก้ได้)
- rev. (เลขรุ่น) อยู่ในตารางเดียวกัน จึงหายไปพร้อมกัน
- ระหว่างโหลด BU config ให้แสดงไว้ก่อน (ค่าเริ่มต้นเปิด) — ไม่กระพริบสำหรับ BU ส่วนใหญ่
- ชื่อคีย์ `general.show-doc-audit`
