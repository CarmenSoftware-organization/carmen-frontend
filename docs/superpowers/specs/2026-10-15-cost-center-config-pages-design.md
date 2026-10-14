# Cost Center / Cost Center Group config pages — design

วันที่: 2026-10-15 · รีโป: `carmen-inventory-frontend-react` (FE) + `carmen-turborepo-backend-v2` (BE)

## ปัญหา

หน้า `/config` ไม่มีเมนู Cost Center ทั้งที่ backend มี CRUD ครบ (`api/config/:bu_code/cost-centers`,
`cost-center-groups`) และ FE ใช้ cost center อยู่แล้ว (location form/table, JV, accounting document)
ผ่าน `hooks/use-cost-center.ts` + `components/lookup/lookup-cost-center.tsx` — ผู้ใช้เลือก cost center
ใน location ได้ แต่ไม่มีที่ให้สร้าง/แก้

## เป้าหมาย / ไม่ใช่เป้าหมาย

- **ทำ:** หน้า Cost Center Group และหน้า Cost Center (list + dialog เพิ่ม/แก้/ลบ, filter, export)
- **ทำ:** กัน backend ไม่ให้ลบ cost center ที่ยังถูกอ้างถึง (409 `COST_CENTER_IN_USE`)
- **ไม่ทำ:** ผูกบัญชีกับ cost center (`setAccounts` / `tb_cost_center_account`), ฟิลด์ `dimension`,
  ฟิลด์ `color_tag` ของ group (ยังไม่มีใครอ่าน — YAGNI)

## ข้อเท็จจริงจาก backend

- `tb_cost_center.cost_center_group_id` **บังคับ** → ต้องมี group ก่อนสร้าง cost center
- code ห้ามซ้ำ (case-insensitive) ทั้งสองตาราง — backend ตอบ `*_DUPLICATE_CODE`
- ลบ group ที่ยังมี cost center → 409 `COST_CENTER_GROUP_IN_USE` (มีอยู่แล้ว)
- ลบ cost center **ไม่เช็กการอ้างถึง** (`tb_location`, `tb_account_mapping`) → แก้ในงานนี้
- update เป็น PATCH ต้องส่ง `doc_version`; allow-list บัญชีอยู่ตารางแยก — PATCH ไม่ล้าง
- gateway map license `config:cost-centers` → `configuration.cost_center`,
  `config:cost-center-groups` → `configuration.cost_center_group` (API ถูก gate อยู่แล้ว)
- permission `configuration.cost_center` / `configuration.cost_center_group` มีใน `seed.permission.data.ts` ครบ 4 action

## ส่วนที่ 1 — เมนูและสิทธิ์ (FE)

- `constant/permissions.ts` → `PERMISSIONS.configuration`:
  `cost_center: crud("configuration.cost_center")`, `cost_center_group: crud("configuration.cost_center_group")`
- `constant/module-list.ts` → 2 leaf ต่อจาก `dimension` (Group ก่อน เพราะต้องสร้างก่อน):

  | name | path | licenseFeature | permission |
  |---|---|---|---|
  | `costCenterGroup` | `/config/cost-center-group` | `configuration.cost_center_group` | `PERMISSIONS.configuration.cost_center_group.view` |
  | `costCenter` | `/config/cost-center` | `configuration.cost_center` | `PERMISSIONS.configuration.cost_center.view` |

- `routes/router.tsx` → 2 route ใต้ config
- i18n `messages/{en,th}.json`: ชื่อเมนู + entity — "Cost Center" / "ศูนย์ต้นทุน",
  "Cost Center Group" / "กลุ่มศูนย์ต้นทุน" (ตรงกับคำที่ location form ใช้)
- ผูก licenseFeature ไม่เพิ่มความเสี่ยง: API ถูก gate ด้วยคีย์เดียวกันอยู่แล้ว — FE แค่แสดงหน้าล็อกแทนหน้า 403

## ส่วนที่ 2 — หน้า Cost Center Group (`/config/cost-center-group`)

แบบ `routes/config/credit-term/` (ConfigListTemplate + dialog) — ไฟล์ใน `routes/config/cost-center-group/`:
`cost-center-group.route.tsx`, `-component.tsx`, `-dialog.tsx`, `-form-schema.ts`, `-filter-fields.ts`,
`-card.tsx`, `use-cost-center-group-table.tsx`

ข้อมูล:
- `API_ENDPOINTS.GL_COST_CENTER_GROUPS` → `/api/proxy/api/config/${buCode}/cost-center-groups`
- `QUERY_KEYS.COST_CENTER_GROUPS`
- `types/cost-center-group.ts` (`CostCenterGroup`, `CreateCostCenterGroupDto`) — ใน `types/` ตามที่ `types/cost-center.ts` อยู่
- hook `routes/config/shared/use-cost-center-group.ts` (`createConfigCrud`, `updateMethod: "PATCH"`) —
  ใช้สองหน้าในโมดูล config เดียว จึงอยู่ `shared/` ไม่ใช่ `hooks/`

UI:
- ตาราง: code · name · description · active (+ card สำหรับ grid)
- filter: ค้น code/name · สถานะ
- export: code, name, description, active
- dialog: code (บังคับ, แก้ได้ทั้งตอนสร้างและแก้ — backend เช็กซ้ำให้แล้ว), name (บังคับ), description, is_active, note
- ลบ: 409 จาก backend ขึ้นเป็น toast ผ่าน `MutationCache` กลางใน `components/providers.tsx`

## ส่วนที่ 3 — หน้า Cost Center (`/config/cost-center`)

โครงไฟล์เดียวกันใน `routes/config/cost-center/`; ใช้ `hooks/use-cost-center.ts` เดิม (อยู่ `hooks/`
เพราะถูกใช้ข้ามโมดูล — ไม่ย้าย)

- ตาราง: code · name · group (`cost_center_group_code · cost_center_group_name` จาก list response) · description · active
- filter: ค้น code/name · group · สถานะ — filter group ส่งผ่าน `filter` object ของ `QueryParams`
  (ยังไม่ได้ยืนยันว่า `cost_center_group_id` ผ่าน where ได้ — ถ้าไม่ได้ ตัด filter group ออก ไม่แก้ BE เพิ่ม)
- dialog: code (บังคับ), name (บังคับ), group (บังคับ, dropdown เฉพาะ active จาก `use-cost-center-group`),
  description, is_active, note
- ไม่มี group เลย → dropdown ว่าง + ข้อความใต้ช่องพร้อมลิงก์ไป `/config/cost-center-group`
- ไม่ส่ง `accounts` / `dimension` — PATCH เฉพาะฟิลด์ในฟอร์ม

## ส่วนที่ 4 — Backend: กันลบ cost center ที่ยังถูกใช้

- `packages/error-catalog/src/catalog.ts`: `COST_CENTER_IN_USE`, `makeId(MODULE.COST_CENTER, 4)`, http 409,
  EN "Cost center is still referenced by locations or account mappings",
  TH "ศูนย์ต้นทุนยังถูกใช้โดยสถานที่หรือการผูกบัญชี"
- `apps/micro-business/src/master/cost-center/cost-center.service.ts` `delete()`: ก่อน transaction นับ
  `tb_location` และ `tb_account_mapping` ที่ `cost_center_id = id` และ `deleted_at: null` → ถ้ารวม > 0 คืน
  `Result.errorFromCatalog(COST_CENTER_IN_USE, { locations, account_mappings })` — แบบเดียวกับ group
- gateway ไม่แก้ (ส่ง http status ตาม catalog อยู่แล้ว) — ยืนยันด้วย curl

## Rollout

1. merge + deploy **BE ก่อน** (ไม่งั้นปุ่มลบใน FE ทำ location ชี้ cost center ที่ถูกลบ)
2. ก่อน deploy FE: curl ยืนยัน `cost-center-groups.*` อยู่ใน x-app-id allowlist ของแอป inventory —
   api_name ที่ไม่อยู่ใน allowlist = user โดนเด้งไป login
3. ให้ role ที่ใช้จริงได้ permission `configuration.cost_center*` และ BU ได้ license feature ทั้งสองคีย์
4. deploy FE

## การตรวจ

ไม่เขียนเทสต์ใหม่ (preference ของ user) — แต่ต้องผ่าน:
- FE: `bun run typecheck` · `bun run lint` · `bun test:run` (รวม `module-list.permission.test.ts`,
  `module-list.license-feature.test.ts` ที่ตรวจคีย์ใหม่)
- BE: tsc + jest ของ micro-business ที่มีอยู่
- curl: ลบ cost center ที่ location ใช้ → 409 `COST_CENTER_IN_USE`
- เบราว์เซอร์ (localhost:3000 → backend :4000 = **dev DB ใช้ร่วม**; ใช้ code ขึ้นต้น `ZZ-TEST-` และลบทิ้งหลังตรวจ):
  สร้าง group → สร้าง cost center → แก้ → ลบ group ที่มีลูก (toast 409) → ลบ cost center ที่ location ใช้ (toast 409)
  → ลบ cost center ที่ไม่มีใครใช้ (สำเร็จ)
