# Cost Center — ดึงจาก Carmen GL

วันที่: 2026-10-22 · รีโป: `carmen-turborepo-backend-v2` (gateway + micro-business + error-catalog) และ `carmen-inventory-frontend-react`

## เจตนา

ให้ cost center ในหน้า `/config/cost-center` ตรงกับ department ใน Carmen 4 (Carmen Account GL)
โดยไม่ต้องคีย์เองทีละตัว ทำแบบเดียวกับปุ่ม "ดึงจาก Carmen GL" ของผังบัญชีที่มีอยู่แล้ว
(`routes/config/chart-of-accounts/coa-import-carmen-gl-button.tsx` ↔ `ChartOfAccountsService.importFromInterfaceCarmenGl`)

## เป้าหมาย

- ปุ่ม "ดึงจาก Carmen GL" บนหน้า list cost center กดแล้ว backend ดึง `department_path` ของคอนฟิก
  `interface_accounting_carmen_gl` แล้ว sync ลง `tb_cost_center` ใน transaction เดียว
- ใช้ `sync_policy` **ชุดเดียวกับผังบัญชี** (user ตัดสิน) — ไม่มีคอนฟิกแยก
- รหัสที่ Carmen GL ไม่มีแล้วและ policy = `delete`: **ลบเฉพาะตัวที่ไม่มีใครใช้ ตัวที่ยังถูกใช้ให้ข้ามแล้วแจ้งรหัส** (user ตัดสิน)

## ไม่ทำ

- ไม่ทำ cost center group จาก Carmen GL (payload ไม่มีกลุ่ม)
- ไม่นำ `DefaultAccount` มาผูก allow-list บัญชี (`tb_cost_center_account`) — ตัวอย่างจริงเป็น `"[]"` ทุกแถว
- ไม่ทำ vendor (`vendor_path`) ในงานนี้
- ไม่ทำการรันตามกำหนดเวลา (แต่ endpoint ต้องไม่รับพารามิเตอร์ เพื่อให้ต่อ scheduler ได้ภายหลังเหมือนผังบัญชี)
- ไม่ทำ import จากไฟล์

## สิ่งที่ถือว่าล้มเหลวแม้โค้ดจะทำงาน

- ลบ cost center ที่ location / account mapping / รายการบัญชียังอ้างอยู่
- ทับกลุ่ม คำอธิบาย หมายเหตุ หรือ allow-list ที่ผู้ใช้ตั้งไว้เอง (`name` / `is_active` ทับได้เฉพาะตอน `upsert`)
- token ถอดรหัสแล้วหลุดเข้า log / RPC / response
- เขียนไปครึ่งเดียวแล้วพัง (ต้อง all-or-nothing)

## ข้อมูลต้นทาง (ตัวอย่างจริงจาก user)

`GET {api_server}/{department_path}` (ค่า default `api/interface/department`) header `Authorization: <token ทั้งก้อน>`

```json
{ "Data": [ { "UserModified": "admin", "LastModified": "2020-12-17T19:15:47+07:00",
              "Id": 1, "DeptCode": "GEN", "Description": "GENERAL DEPARTMENT", "DefaultAccount": "[]" } ],
  "Paging": { "Page": 1, "Limit": 27, "PageCount": 1, "TotalRecordCount": 27, "Next": null, "Prev": null } }
```

### การจับคู่ฟิลด์

| Carmen 4 | tb_cost_center | หมายเหตุ |
|---|---|---|
| `DeptCode` | `code` | คีย์จับคู่ ไม่สนตัวพิมพ์ (unique index `costcenter_code_live_u` เป็นแบบ live เท่านั้น) · trim · ว่าง = แถวผิด |
| `Description` | `name` | trim · ว่าง = แถวผิด |
| — | `is_active` | แถวใหม่ = `true` · แถวเดิมเมื่อ `upsert` = `true` (Carmen GL ยังมี = ใช้งาน — user ตัดสิน "ให้เหมือน Carmen GL") · `skip` = ไม่แตะ |
| — | `cost_center_group_id`, `description`, `note`, `dimension`, allow-list | แถวใหม่ = null/ค่า default · แถวเดิม: ไม่แตะ |
| `Id`, `UserModified`, `LastModified`, `DefaultAccount` | — | ไม่ใช้ |

รหัสซ้ำกันในชุดที่ดึงมา = แถวผิด (แบบเดียวกับ `AccCode` ซ้ำของผังบัญชี)

เพดาน *(การตัดสินใจของผม)*: ใช้ `MAX_IMPORT_ROWS` (2000), `MAX_CODE_LENGTH` (50) และ `MAX_SUMMARY_ERRORS` (100)
ชุดเดียวกับผังบัญชี (`chart-of-accounts.import.ts`) · `code` ยาวเกิน = แถวผิด · `name` ไม่มีเพดาน (คอลัมน์เป็น
`VarChar` ไม่จำกัดความยาว)

รหัสที่เคยถูก soft delete แล้ว Carmen GL ส่งกลับมาอีก → สร้างแถวใหม่ ไม่ชนกัน (unique index เป็นแบบ live
เท่านั้น) ไม่ต้องกู้แถวเก่า

## พฤติกรรม sync (ตาม `sync_policy`)

- `on_duplicate` (รหัสมีทั้งสองฝั่ง):
  - `skip` — ไม่แตะ นับเป็น skipped
  - `upsert` — อัปเดต `name` และตั้ง `is_active = true` · ถ้าทั้งสองค่าตรงอยู่แล้ว = ไม่เขียน นับเป็น skipped *(การตัดสินใจของผม: ตัวเลข updated จะได้มีความหมาย)*
  - `error` — ทั้งชุดไม่เขียน ตอบ 400 พร้อมรายการแถว เหมือนผังบัญชี
- `on_local_only` (มีแค่ฝั่งเรา):
  - `keep` — ไม่แตะ
  - `delete` — ทุกแถว live ที่รหัสไม่อยู่ในชุดที่ดึงมา: ถ้า **ไม่มีการอ้างอิง** → soft delete
    (`deleted_at`, `deleted_by_id`, `is_active=false`) พร้อม soft delete แถว `tb_cost_center_account`
    ของมัน แบบเดียวกับ `CostCenterService.delete`; ถ้า **มีการอ้างอิง** → ข้าม แล้วใส่รหัสไว้ใน `in_use_codes`
  - "มีการอ้างอิง" = นิยามเดียวกับ `CostCenterService.countReferences` (location, account mapping,
    GL JV/template/budget/balance, AP payment expense, AP/AR invoice detail) — **ใช้ฟังก์ชันเดียวกัน
    ห้ามเขียนรายการตารางซ้ำ** ต้องปรับให้นับเป็น batch (หลาย id ทีเดียว) ไม่ใช่วนยิงทีละ id
    โดยคงตัวกรองของแต่ละตารางไว้ตามเดิมทุกตัว (ตารางที่ไม่มี `deleted_at` นับทุกแถว) และ `delete()` เดิมต้องได้ผลเหมือนเดิม
  - "แถว live" = `deleted_at IS NULL` ไม่ว่าจะ `is_active` เป็นอะไร — ตัวที่ปิดใช้งานแล้วก็ถูกลบได้ถ้าไม่มีใครใช้
- ทั้งหมดอยู่ใน `$transaction` เดียว · มีแถวผิดแม้แถวเดียว = ไม่เขียนอะไรเลย (400 + `errors`)

## สัญญา API

**Gateway:** `POST /api/config/:bu_code/cost-centers/import-from-interface/carmen-gl`
`AppIdGuard('cost-centers.import-from-interface.carmen-gl')` · ตอบ 201 · ไม่มี body · Swagger ครบแบบ endpoint ผังบัญชี

**Response `data`:**

```ts
{
  summary: { total_rows, created, updated, skipped, deleted, in_use, errors },
  errors: { row: number; column?: string; message: string }[],   // ตัดที่ MAX_SUMMARY_ERRORS
  deleted_codes: string[],                                          // ตัดที่ MAX_SUMMARY_ERRORS
  in_use_codes: string[],                                           // ตัดที่ MAX_SUMMARY_ERRORS
}
```

**Error:** เคสเดียวกับผังบัญชีทุกตัว — คอนฟิกปิด (`enabled !== true`), ตั้งค่าไม่ครบ (ไม่มี `api_server`
/ `department_path` / `authorize_token`), ถอด token ไม่ได้, เรียกต้นทางพัง (502 พร้อม `{status}` ไม่แนบ body),
ต้นทางตอบหลายหน้า (`PageCount > 1`), ไม่มีแถว, เกินเพดานแถว, แถวผิด (400 + `errors`), P2002 แข่งกัน → duplicate code
เพิ่ม error code ชุด `COST_CENTER_INTERFACE_*` / `COST_CENTER_IMPORT_*` ใน `packages/error-catalog`
คู่ขนานกับของผังบัญชี *(การตัดสินใจของผม: ไม่ยืมรหัส `CHART_OF_ACCOUNTS_*` เพราะข้อความจะพูดถึงผังบัญชีผิดหน้า)*
ต้องตรงกับ i18n ฝั่ง FE ตามระบบ error catalog ที่มีอยู่

## โครงสร้างโค้ด backend

- ตรรกะ "อ่านคอนฟิก Carmen GL → ตรวจ enabled/ครบ → ถอด token → fetch + timeout → ตรวจ Paging/ว่าง/เพดาน"
  ตอนนี้อยู่ใน `ChartOfAccountsService.importFromInterfaceCarmenGl` **แยกออกเป็น helper กลาง** ที่รับ
  path key (`account_code_path` / `department_path`) และชุด error code แล้วให้ทั้งสอง service เรียก
  (`department_path` อยู่ในฟอร์มคอนฟิก Carmen GL แล้ว ค่าเริ่มต้น `api/interface/department` — helper ไม่ต้องเติม default
  เอง ถ้าคอนฟิกไม่มีค่า = "ตั้งค่าไม่ครบ")
  — การจัดการ secret ต้องมีที่เดียว พฤติกรรมของผังบัญชีต้องไม่เปลี่ยน (เทสเดิมต้องผ่าน)
- `CostCenterService.importFromInterfaceCarmenGl()` + `MessagePattern` ใน micro-business
- gateway controller/service ใน `config_cost-centers` + RPC pattern ใหม่

## Frontend

- `API_ENDPOINTS.GL_COST_CENTERS_IMPORT_CARMEN_GL(buCode)`
- hook `useImportCostCenterFromCarmenGl` ใน `routes/config/cost-center/use-cost-center-import.ts` (หรือไฟล์ที่เหมาะใน
  feature นี้) — `invalidateKeys` ของ cost center list, `meta.skipGlobalErrorToast: true`
- `CostCenterImportCarmenGlButton` วางใน `extraActions` ของ `ConfigListTemplate` ใน `cost-center-component.tsx`
  เงื่อนไขแสดงผลเหมือนผังบัญชี: `entitlementOf("accounting", "carmen_gl") === "entitled"` และ `canWrite`
  ไม่เช็ก `enabled` ฝั่ง FE (backend ตอบ 400 พร้อมข้อความ)
- toast สำเร็จแสดง created/updated/skipped/deleted และ **ถ้า `in_use > 0` ต้องบอกว่าข้ามกี่ตัวและรหัสอะไร**
  (สูงสุด 5 รหัสแล้ว `… +n` เหมือน `rowErrorsOf`) — ถ้า toast อ่านยาก ให้ใช้ dialog ผลลัพธ์แทนได้ (ช่างตัดสิน)
- error: แสดงรายการแถวผิด / ข้อความ 502 ของ `COST_CENTER_INTERFACE_REQUEST_FAILED` แบบเดียวกับผังบัญชี
- ปุ่มสองตัวหน้าตาเหมือนกันเกือบทั้งหมด — ถ้าจะแยก component กลางให้ทั้งคู่ใช้ ต้องอยู่ใน `components/` หรือ
  `routes/config/shared/` (กฎ module boundary) ช่างตัดสินว่าคุ้มไหม
- i18n `config.costCenter.importCarmenGl.*` ทั้ง `th.json` / `en.json` — ห้ามมี `{{}}` หรือ `<คำ>` ในข้อความ
- แก้ `syncPolicyDesc` ในหน้าคอนฟิก Carmen GL (th/en) ให้บอกว่ามีผลกับทั้งผังบัญชีและ cost center
  และบอกว่า cost center ที่ยังถูกใช้จะไม่ถูกลบ

## ลำดับ deploy

1. BE (gateway + micro-business + error-catalog) → **เติม api_name `cost-centers.import-from-interface.carmen-gl`
   ใน app allowlist ทุก env** (เว้นแต่แถว application ตั้ง `allow_all: true`) — ถ้าลืม ผู้ใช้ที่กดปุ่มจะ**ถูกเด้งไป
   หน้า login** ไม่ใช่แค่ปุ่มไม่ทำงาน ต้องเขียนเตือนไว้ทั้งใน PR BE และ PR FE
2. FE

ไม่มี migration · ไม่มี license feature key ใหม่ (ใช้ entitlement interface `carmen_gl` เดิม)

## ตรวจด้วยมือ

- dev BU ที่ตั้ง Carmen GL ไว้: กดปุ่ม → ได้ 27 แถวตามตัวอย่าง · กดซ้ำด้วย `skip` → skipped ทั้งหมด
- ตั้ง `upsert` แล้วแก้ชื่อฝั่งเราหนึ่งตัว และปิดใช้งานอีกตัว → กดแล้วชื่อกลับ ตัวที่ปิดกลับมาใช้งาน กลุ่ม/หมายเหตุไม่หาย
- ตั้ง `delete` + สร้าง cost center ที่ไม่มีใน Carmen GL สองตัว (ตัวหนึ่งผูก location) → ตัวที่ไม่ผูกถูกลบ ตัวที่ผูกถูกข้ามและแจ้งรหัส
- BU ที่ไม่มีสิทธิ์ `carmen_gl` → ไม่เห็นปุ่ม
- ตรวจทั้งธีมสว่าง/มืด และหน้าจอมือถือ
