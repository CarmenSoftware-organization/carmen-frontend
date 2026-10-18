# ย้าย External ออกจาก Accounting ไปหมวดใหม่ "Export tools"

วันที่ 2026-10-18 · รีโป: `carmen-inventory-frontend-react` (FE) + `carmen-turborepo-backend-v2` (BE)

## เจตนา

หน้า `/system-admin/interface` จัด interface เป็นสองชั้น หมวด (category) ถือ brand ปัจจุบัน
External อยู่ใต้หมวด **Accounting** แต่ External ไม่ใช่ระบบบัญชี — เป็นช่องให้ระบบภายนอก
ดึงข้อมูล (ap-invoices / gl-journals) เองผ่าน API key และจะมีเครื่องมือ export ตัวอื่นตามมา
จึงต้องมีหมวดของตัวเองชื่อ **Export tools** ให้ของใหม่มีที่ลง

ผู้ใช้เลือก **ย้ายจริง** — key, URL, license key และข้อมูลต้องตรงกับหมวดใหม่ทั้งหมด
ไม่ใช่แค่เปลี่ยนป้ายบนหน้า list เพราะ key ที่ไม่ตรงหมวดจะทำให้เครื่องมือตัวถัดไปไม่รู้ว่าจะตั้งชื่อตามแบบไหน

## เป้าหมาย

- หมวดใหม่ key `export` ป้าย "Export tools" / "เครื่องมือส่งออก" อยู่ต่อท้าย Accounting / POS / PMS
  ในหน้า list มี brand เดียวคือ External
- ชื่อใหม่ทั้งชุด:

  | สิ่ง | เดิม | ใหม่ |
  |---|---|---|
  | config key (tenant `tb_application_config`) | `interface_accounting_external` | `interface_export_external` |
  | license feature | `interface.accounting.external` | `interface.export.external` |
  | license parent (ใหม่) | — | `interface.export` (parent = `interface`) |
  | URL | `/system-admin/interface/accounting/external` | `/system-admin/interface/export/external` |
  | i18n namespace | `systemAdmin.interface.accounting.external.*` + label brand ใต้ `accounting.brand.external` | `systemAdmin.interface.export.*` (title หมวด + `brand.external` + เนื้อหาฟอร์มเดิมทั้งหมด) |

- BU ที่ตั้งค่า External ไว้แล้ว และ BU ที่ได้ license External แล้ว ต้องใช้งานต่อได้ทันทีหลัง deploy
  โดยไม่มีใครต้องตั้งค่าหรือ assign ใหม่

## ไม่ทำ (non-goals)

- ไม่เพิ่มเครื่องมือ export ตัวใหม่ในงานนี้
- ไม่เปลี่ยนพฤติกรรมของ External: API key, endpoint ap-invoices / gl-journals, บัญชีตั้งต้น
  (gl defaults), API docs — ทั้งหมดย้ายบ้านเฉย ๆ
- ไม่แก้ carmen-platform — หน้า license feature / ใบ INF ขับด้วยข้อมูลใน catalog
  (ตรวจแล้ว ไม่มีการ hardcode `interface.accounting.*`) คีย์ใหม่จะขึ้นเองหลัง seed

## สิ่งที่ถือว่าล้มเหลวแม้จะทำงานได้ (anti-goals)

- BU ที่เคยมี External แล้วหลัง deploy เห็นฟอร์มว่าง / สถานะ "ไม่มีสิทธิ์" / สร้าง API key ไม่ได้
  (ด่าน `config:bu-api-key` เป็น fail-closed — license key หลุดหนึ่งจุด = 403 ทันที)
- config key ใหม่หลุดจากด่าน `assertInterfaceEntitled` เงียบ ๆ เพราะ regex ไม่รู้จักหมวด `export`
  (ไม่มี error ใด ๆ — แค่ไม่ตรวจสิทธิ์)
- seed รันก่อน migration แล้วได้แถว license ใหม่ซ้อน ขณะที่กลุ่มยังชี้คีย์เก่า
  (กับดักเดียวกับที่ migration `20261014230000_move_mcp_license_under_ai` เขียนเตือนไว้)

## ข้อจำกัด / ข้อเท็จจริงที่ตรวจแล้ว

- **มี license External เฉพาะบน dev** (ผู้ใช้ยืนยัน) — UAT/prod ยังไม่มีใบไหนอ้างคีย์นี้
  migration จึงแทบไม่มีข้อมูลให้ย้ายบน UAT/prod แต่ต้องรันได้อย่างปลอดภัย (idempotent) ทุก env
- **External ไม่มี secret** — `secretPathsFor` ใน `apps/micro-business/src/app-config/app-config.service.ts:203`
  ไม่มีเคส `interface_accounting_external` การ rename แถว config จึงไม่กระทบการถอดรหัส
- gateway แปลง config key เป็น license key ตรง ๆ: `INTERFACE_CONFIG_KEY_RE`
  (`apps/backend-gateway/src/config/config_app-config/config_app-config.service.ts:28`)
  `^interface_(accounting|pos|pms)_(.+)$` → `interface.<category>.<brand>` — ต้องเติม `export`
- FE ตรวจ entitlement ด้วยสายคีย์ `interface` → `interface.<cat>` → `interface.<cat>.<brand>`
  (`hooks/use-interface-entitlement.ts`) และ backend `evaluateLicense` ต้องเจอบรรพบุรุษทุกชั้น
  ดังนั้นทุกกลุ่ม license ที่มี `interface.export.external` ต้องมี `interface.export` ด้วย
- ใบ INF (`tb_business_unit_interface_license`) ชี้ไปที่ `license_feature_group_id`; คีย์อยู่ใน
  `tb_license_feature_group_item.feature_key` (soft reference สตริง ไม่มี FK) — ย้ายกลุ่มก็ครอบใบ INF ด้วย
- ลำดับ deploy: **platform migration → seed → tenant migration ทุก BU → BE → FE**
  FE ขึ้นก่อน BE = หน้า External อ่าน key ใหม่ที่ gateway ยังไม่รู้จัก
- **ยอมรับช่วงที่ใช้ไม่ได้สั้น ๆ บน dev** (ผู้ใช้ตัดสิน 2026-10-18): ระหว่าง platform migration ถึง BE ขึ้น
  gateway เก่าตรวจคีย์ที่ไม่มีแล้ว → `/api/ext/v1/*` และ `config:bu-api-key` ตอบ 403 (fail-closed)
  และหน้า External ของ FE เก่าว่าง/403 จน FE ใหม่ขึ้น — ไม่มีใครใช้ ext API บน dev อยู่ จึงใช้
  migration ชุดเดียว ไม่ทำแบบเพิ่มคีย์ใหม่ก่อน-ลบเก่าทีหลัง; ให้ deploy BE ต่อจาก migration ทันที

## สิ่งที่ตัดสินแล้ว

### FE (`carmen-inventory-frontend-react`)

- `routes/system-admin/interface/interface-registry.ts` — ถอด entry `external` ออกจาก accounting
  เพิ่มหมวด `{ key: "export", icon: <ไอคอนส่งออกของ lucide>, brands: [external], form: ... }`
  brand `external` คง `form: lazy(external-interface-form)` และ `noConnection: true` เหมือนเดิม
  `configKey: "interface_export_external"`
- `InterfaceCategoryDef.form` (ฟอร์มตั้งต้นของหมวด) เป็นฟิลด์บังคับ หมวด export ยังไม่มีฟอร์มกลาง —
  ดู "สิ่งที่เหลือให้ผู้สร้างตัดสิน"
- `external-interface-form.tsx` `CONFIG_KEY` → `interface_export_external`
- `external-api-access-section.tsx` / `external-api-docs-section.tsx`: `entitlementOf("accounting","external")`,
  `canReadConfig("accounting","external")` → `"export"`
- i18n `messages/{en,th}.json`: ย้ายก้อน `systemAdmin.interface.accounting.external` ไปเป็น
  `systemAdmin.interface.export` เพิ่ม `title` ("Export tools" / "เครื่องมือส่งออก") และ `brand.external`
  ลบ `accounting.brand.external` ทิ้ง แก้ทุก `useTranslations(...)` ที่อ้าง namespace เก่า
  รวม `ta("brand.external")` / `ta("desc")` ใน `external-interface-form.tsx` ที่อ่านจาก namespace
  `systemAdmin.interface.accounting` — `desc` ต้องเป็นคำอธิบายของหมวด export ใหม่ (`export.desc`)
  ไม่ใช่ข้อความของ Accounting
  (ระวังกับดัก ICU: ห้ามมี `{}` / `<คำ>` ในข้อความ)
- ลิงก์ใน `routes/config/chart-of-account-mapping/coam-cells.tsx:65,114` → URL ใหม่
- **redirect:** URL เดิม `/system-admin/interface/accounting/external` ต้องพาไป URL ใหม่ (`replace`)
  เพราะอาจมีคนบันทึกลิงก์ไว้ (การตัดสินใจของผม — ผู้ใช้ยอมรับในภาพรวม)
- `constant/__fixtures__/license-catalog.ts` — regenerate จาก catalog ใหม่ของ BE
  (`scripts/gen-license-fixture.ts`) ไม่แก้มือ
- อัปเดตเทสต์ที่มีอยู่ซึ่งอ้างโครงเดิม (`interface-registry.test.ts`, `interface-list.test.tsx` ฯลฯ)
  ให้ผ่าน — ไม่เขียนเทสต์ใหม่เพิ่ม (ตามกติกา user)
- เอกสาร `routes/system-admin/interface/CLAUDE.md` และ comment ที่อ้าง `interface_accounting_external`
  ให้ตรงของจริง

### BE (`carmen-turborepo-backend-v2`)

- gateway `INTERFACE_CONFIG_KEY_RE` → `^interface_(accounting|pos|pms|export)_(.+)$`
- micro-business `app-config.service.ts`:
  - `defaultFor` regex เติม `export` (คืน `{ enabled: false }` ให้ key ที่ยังไม่มีแถว)
  - `validateValue` — `interface_export_*` ใช้ schema เดียวกับที่ `interface_accounting_external`
    ใช้อยู่วันนี้ (`InterfaceAccountingSchema`) เพื่อไม่ให้พฤติกรรมเปลี่ยน ห้ามปล่อยให้ตกเป็น
    "unknown key = รับทุกอย่าง"
- `packages/prisma-shared-schema-platform/prisma/permission.route-map.ts`:
  - `LICENSE_ROUTE_OVERRIDES`: `'config:app-config/interface_accounting_external'` → `..._export_external`;
    `'config:bu-api-key'` → `'interface.export.external'`
  - `LICENSE_ONLY_RESOURCES`: เพิ่ม `interface.export` ("Export tools"), เปลี่ยน
    `interface.accounting.external` → `interface.export.external`
  - comment ที่บอกว่า "คีย์ `interface_*` ทั้งแปด" ฯลฯ ให้ตรง
- `seed.license-feature.data.ts` (generated) — regenerate; เพิ่มแถว `interface.export`
  (parent `interface`) และ `interface.export.external` (parent `interface.export`) แทนแถวเก่า
- `apps/backend-gateway/src/license/license-catalog.generated.ts` — regenerate
- `external-interface-entitlement.ts` `EXTERNAL_INTERFACE_FEATURE` → `'interface.export.external'`
  และ comment ใน `config_bu-api-key.controller.ts` / `.service.ts`
- **platform migration** ใหม่ ตามแบบ `20261014230000_move_mcp_license_under_ai`:
  1. `tb_license_feature`: rename `interface.accounting.external` → `interface.export.external`
     (คง id/state) ด้วย guard `NOT EXISTS`
  2. `tb_license_feature_group_item`: feature_key เดิม → ใหม่ ด้วย guard ต่อกลุ่ม
  3. เติม `interface.export` ให้ทุกกลุ่มที่มี `interface.export.external`
  4. soft-delete แถวคีย์เก่าที่เหลือ (กลุ่มที่มีทั้งสองคีย์อยู่ก่อน)
  4b. soft-delete `interface.accounting` ในกลุ่มที่ไม่เหลือลูก `interface.accounting.*` แล้ว
     (กลุ่มที่เคยมี External เป็น brand บัญชีตัวเดียว) — ไม่งั้นหมวด Accounting ค้างเป็นสิทธิ์ว่าง
     และหน้าแก้กลุ่มใน carmen-platform แสดงว่าเลือกไว้ *(การตัดสินใจของผม)*
  5. เขียน rollback SQL เป็น comment ท้ายไฟล์ (ต้องใช้คู่กับ gateway + seed รุ่นก่อนเสมอ)
  - ไม่สร้างแถว `interface.export` ใน `tb_license_feature` ที่นี่ — seed สร้าง (เหมือน `ai`)
- **tenant migration** ใหม่ (รันทุก BU):
  `UPDATE tb_application_config SET key = 'interface_export_external' WHERE key = 'interface_accounting_external'`
  พร้อม guard ไม่ให้ชนแถวที่มี key ใหม่อยู่แล้ว (เคารพ soft-delete ถ้าตารางมี `deleted_at`)
  และ rollback เป็น comment
- อัปเดต spec/เทสต์ที่มีอยู่ซึ่งอ้างคีย์เก่าให้ผ่าน (jest ไม่ใช่ bun test)
- `carmen-inventory-frontend-e2e/docs/test-cases/1118-interface.md` (~บรรทัด 84) บรรยายการจัดกลุ่มการ์ด
  (External ใต้ Accounting) — แก้ให้ตรงหมวดใหม่; bruno แก้ถ้าเจอคีย์เก่า
- **เอกสาร API ที่ลูกค้าเห็น** อัปเดตในงานนี้ด้วย *(การตัดสินใจของผม — ไม่งั้นหน้า API docs บอกทางเมนูผิดหลัง deploy)*:
  path เมนู "Interface → Accounting → External → API Access" และชื่อ license key ใน
  `docs/external-api/accounting-export.md`, `apps/backend-gateway/src/external-api/external-api.swagger.ts`,
  `docs/external-api/openapi.json` และสำเนาฝั่ง FE `routes/system-admin/interface/external-api-openapi.json`
  (ไม่เปลี่ยนชื่อไฟล์ — ชื่อสื่อถึงข้อมูลที่ export ไม่ใช่หมวดเมนู)

หมายเหตุ: route override `config:app-config/interface_*` ชี้ license ระดับ `interface` ทั้งก้อน
ด่านระดับ brand มีแค่ `assertInterfaceEntitled` — นี่คือเหตุผลที่ regex ต้องเติม `export` ห้ามลืม

## สิ่งที่เหลือให้ผู้สร้างตัดสิน

- ฟิลด์ `form` ระดับหมวดของ `export`: ทำให้เป็น optional ใน `InterfaceCategoryDef` แล้วจัดการ
  เคสไม่มีฟอร์มใน `interface-detail.route.tsx` หรือชี้ไปที่ `external-interface-form` ไปก่อน —
  เลือกแบบที่แก้น้อยและไม่ทำให้ brand ใหม่ในอนาคตพังเงียบ ๆ
- ไอคอนของหมวด (ตัวใดก็ได้ใน lucide ที่สื่อการส่งออก เช่น `FileOutput` / `Upload`)
- ชื่อไฟล์ migration / timestamp และวิธีเขียน redirect (route entry หรือ guard ใน detail route)
- branch: `feature/interface-export-group` ทั้งสองรีโป, PR แยกต่อรีโป, commit message ภาษาไทย

## การตรวจ (แทนเทสต์ใหม่)

- typecheck + lint ทั้งสองรีโป, เทสต์เดิมผ่านทั้งหมด
- บน dev หลัง deploy ตามลำดับ: หน้า list มีหมวด Export tools มี External; เปิดฟอร์มเห็นค่าเดิมของ BU;
  บันทึกได้; สร้าง/หมุน API key ได้; URL เก่า redirect; ลิงก์จากหน้า COA mapping ไปถูก;
  `curl` GET `/app-config/interface_export_external` ด้วย BU ที่ไม่มี license ต้องได้ 403
