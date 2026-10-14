# Chart of Account Mapping — แก้หลายแถวพร้อมกัน (batch edit) — design

วันที่: 2026-10-15 · รีโป: `carmen-inventory-frontend-react` (FE) + `carmen-turborepo-backend-v2` (BE)

## ปัญหา

หน้า `/config/chart-of-account-mapping` แก้ account / cost center ได้ทีละแถว (sheet + `PATCH :id`)
งาน **ข้อยกเว้น** — เช่น "location นี้ เฉพาะ movement CN ให้ลง cost center อื่น" — ต้องเปิด sheet
ซ้ำทีละแถว และการล้าง override ที่ค้างหลังไปแก้ค่าเริ่มต้นที่ต้นทางแล้วก็ต้องกดทีละแถวเช่นกัน

## เป้าหมาย / ไม่ใช่เป้าหมาย

- **ทำ:** เลือกแถวด้วย checkbox ในหน้าปัจจุบัน (≤100) แล้วตั้ง / คืนค่าเริ่มต้นของ account และ/หรือ
  cost center ให้ทุกแถวในครั้งเดียว
- **ไม่ทำ:** เลือก "ทุกแถวที่ตรงตัวกรอง" ข้ามหน้า (ตัดสินใจแล้ว — sort + filter รวบแถวมาหน้าเดียวได้พอ)
- **ไม่ทำ:** inline edit ในตาราง
- **ไม่ใช่ทางหลักของการเติมช่องว่าง:** แถวที่ว่างเพราะต้นทางยังไม่ตั้ง (location ไม่มี cost center,
  category ไม่มีบัญชี) ควรแก้ที่ต้นทาง — ป้ายเตือนในตารางลิงก์ไปหน้านั้นแล้ว (branch
  `feature/coam-column-sort`) batch edit สร้าง **override** ซึ่งไม่ตามค่าต้นทางที่เปลี่ยนทีหลัง

## การตัดสินใจ

| เรื่อง | เลือก | เหตุผล |
|---|---|---|
| ขอบเขตแถว | เฉพาะแถวที่ติ๊กในหน้าปัจจุบัน | งานข้อยกเว้นมีไม่กี่แถว; ผลคาดเดาได้; ใช้ checkbox เดิม |
| `doc_version` ชนบางแถว | บันทึกเท่าที่ได้ + ตอบรายชื่อที่ชน | ไม่ต้องให้ผู้ใช้ทำทั้งชุดใหม่เพราะแถวเดียว |
| ค่าที่ตั้งได้ | ต่อช่อง: ไม่เปลี่ยน / ตั้งเป็น / คืนค่าเริ่มต้น | คืนค่าเริ่มต้นหลายแถว = คู่ของการแก้ที่ต้นทาง |
| วิธีทำ | endpoint ใหม่ใน BE (ไม่ใช่ FE วน `PATCH`) | request เดียว · ตรวจค่าครั้งเดียว (422 ทั้งก้อน) |

## ส่วนที่ 1 — API + BE

### สัญญา

`POST /api/:bu_code/account-mapping/batch-update`

- guard: `AppIdGuard('account-mapping.batchUpdate')` + `@Permission({ [RESOURCE]: ['update'] })`
  (`RESOURCE` = `configuration.chart_of_account_mapping` เหมือน `PATCH` / `review`)

```jsonc
// request
{
  "items": [{ "id": "<uuid>", "doc_version": 3 }],  // 1–100 รายการ, id ห้ามซ้ำ
  "account_code": "1110010",   // ไม่ส่ง = ไม่เปลี่ยน · null = คืนค่าเริ่มต้น (ล้าง override)
  "cost_center_id": "<uuid>"   // ไม่ส่ง = ไม่เปลี่ยน · null = คืนค่าเริ่มต้น
}

// 200
{
  "updated":   [{ "id": "<uuid>", "doc_version": 4 }],
  "conflicts": ["<uuid>"],   // doc_version ไม่ตรง — มีคนแก้ไปก่อน
  "not_found": ["<uuid>"]    // ถูกลบ / ไม่มีในแท็บนี้แล้ว
}
```

| สถานะ | เมื่อ |
|---|---|
| 400 | schema ผิด · `items` ว่างหรือเกิน 100 · id ซ้ำ · ไม่ส่งทั้ง `account_code` และ `cost_center_id` |
| 422 | `account_code` ไม่อยู่ในผังบัญชี (active) → `ACCOUNT_MAPPING_ACCOUNT_INVALID` · `cost_center_id` ไม่ active → `ACCOUNT_MAPPING_COST_CENTER_INVALID` — **ไม่แตะสักแถว** |
| 200 | ทุกกรณีที่ผ่านการตรวจค่า แม้ทุกแถวจะชน (`updated` ว่าง) |

ความหมายของ "ไม่ส่ง" กับ `null` ตรงกับ `PATCH :id` เดิม

### micro-business `batchUpdate(payload)`

1. `AccountMappingBatchUpdateSchema.parse` (refine: id ไม่ซ้ำ, มีอย่างน้อยหนึ่งใน `account_code` / `cost_center_id`)
2. ตรวจ `account_code` / `cost_center_id` **ครั้งเดียว** ด้วยเงื่อนไขเดียวกับ `update()` (active = `is_active` true หรือ null)
   — ไม่ผ่าน → `Result.errorFromCatalog(...)` ทั้งก้อน
3. วนทีละ item (ลำดับตาม request) — แต่ละรายการเป็น `tb_account_mapping.update` ของตัวเอง
   **ไม่ห่อ transaction ใหญ่** (บันทึกเท่าที่ได้):
   - `where: { id, doc_version }` → client extension ตรวจ+บวกเวอร์ชัน โยน `OptimisticLockError` ถ้าไม่ตรง → `conflicts`
   - หาแถวไม่เจอ (Prisma `P2025` / ไม่มีแถว) → `not_found`
   - error อื่น → โยนต่อ (500 ผ่าน `@TryCatch`) — แถวที่บันทึกไปก่อนหน้า **ค้างอยู่** (ยอมรับ: ตรงกับนโยบายบันทึกเท่าที่ได้)
   - `data`: ช่องที่ส่งมา + `is_reviewed: true`, `updated_by_id`, `updated_at` (เหมือน `update()`)
4. ตอบ `{ updated, conflicts, not_found }` — ไม่ hydrate แถว (FE refetch ตารางเอง)

ต้องแยก "ไม่เจอ" กับ "เวอร์ชันชน" ให้ได้: อ่าน `id, doc_version` ของทุก item ด้วย `findMany` ครั้งเดียวก่อนวน
— ไม่มีในผล = `not_found`, เวอร์ชันไม่ตรง = `conflicts` (ไม่ต้องยิง update) ส่วน `OptimisticLockError`
ระหว่างวนยังจับเป็น `conflicts` สำหรับกรณีชนกันระหว่างอ่านกับเขียน

### ไฟล์ที่แตะ (BE)

- `packages/rpc-contract/src/contracts/account-mapping.ts` — เพิ่ม `batchUpdate` ผ่าน `bun run gen:rpc-contract`
  (ทำตาม 3 ขั้นในหัวไฟล์: literal ชั่วคราว → gen → แทนด้วย reference)
- micro-business: `dto/account-mapping.dto.ts` (schema), `account-mapping.controller.ts` (`@MessagePattern`),
  `account-mapping.service.ts` (`batchUpdate`)
- gateway: `common/dto/account-mapping/account-mapping.dto.ts` (schema + DTO), `application/account-mapping/`
  controller + service + swagger response
- `app-api-catalog.generated.ts` — regenerate (`bun run scripts/generate-app-api-catalog/run.ts`)

## ส่วนที่ 2 — FE

- แถบที่ขึ้นเมื่อติ๊กแถว (ข้างปุ่ม "ยืนยันว่าตรวจแล้ว") เพิ่มปุ่ม **"แก้ N แถว"** — หน้านี้ยังไม่มีการเช็กสิทธิ์
  ฝั่ง FE เลย (ปุ่ม "ยืนยันว่าตรวจแล้ว" และ sheet แก้ทีละแถวขึ้นให้ทุกคน แล้ว BE ตอบ 403) ปุ่มใหม่ทำแบบเดียวกัน
  — การซ่อนตามสิทธิ์ทั้งหน้าเป็นงานแยก ไม่อยู่ในขอบเขตนี้
- `routes/config/chart-of-account-mapping/coam-batch-edit-sheet.tsx` (ใหม่)
  - หัว: "แก้ N แถว" + สรุปสั้น ๆ ว่าครอบ location / movement ใดบ้าง (นับจากแถวที่เลือก)
  - ช่อง Cost center และ Account: radio 3 ตัว — ไม่เปลี่ยน (ค่าเริ่ม) / ตั้งเป็น [lookup] / คืนค่าเริ่มต้น
    lookup ตัวเดียวกับ `coam-edit-sheet.tsx` (`LookupCostCenter`, `LookupChartOfAccount`)
  - ปุ่มบันทึก disable จนกว่าอย่างน้อยหนึ่งช่องไม่ใช่ "ไม่เปลี่ยน" และช่อง "ตั้งเป็น" ต้องเลือกค่าแล้ว
- `use-account-mapping.ts` — `useBatchUpdateAccountMapping()` บน `useAccountMappingMutation` เดิม
  (`skipGlobalErrorToast: true` ให้ sheet แสดง 422 เอง; `onSettled` invalidate `ACCOUNT_MAPPING` อยู่แล้ว)
- หลังได้ 200:
  - ตารางโหลดใหม่ (invalidate)
  - การเลือกแถว: เหลือเฉพาะ `conflicts` + `not_found` ที่ยังอยู่ในหน้า (ต้องไม่โดน `scopeKey`
    effect ล้างทิ้ง — การ refetch ไม่เปลี่ยน scope จึงไม่ล้าง)
  - toast: ทั้งหมดสำเร็จ → "บันทึก N แถว"; มีชน → "บันทึก X แถว · Y แถวถูกแก้ไปก่อน ตรวจแล้วลองอีกครั้ง"
    (warning); `not_found` แจ้งรวมใน toast เดียวกัน
  - ปิด sheet เมื่อไม่มีแถวค้าง; มีแถวค้าง → ปิด sheet แต่คงการเลือกไว้
- 422 → แสดงใต้ช่องที่ผิดใน sheet เหมือน `coam-edit-sheet.tsx` ไม่ปิด sheet
- i18n `messages/{en,th}.json` ใต้ `config.chartOfAccountMapping` (ห้ามมี `{{` `}}` ในข้อความ)

## Deploy

ลำดับบังคับ:

1. เติม app-id allowlist `account-mapping.batchUpdate` ทุก app ที่ใช้หน้านี้ — **ไม่เติม = 401 แล้ว user
   ถูกเด้งออกหน้า login** ไม่ใช่แค่ปุ่มไม่ทำงาน
2. deploy BE
3. deploy FE

rollback FE อย่างเดียวได้ (BE ไม่มีอะไรพังถ้า FE เก่า); rollback BE ต้องถอย FE ด้วย

## การตรวจ

ตาม CLAUDE.md ของ user — ไม่เขียนเทสต์ใหม่ รัน typecheck + lint ทั้งสองรีโป และ suite เดิมต้องเขียว แล้วตรวจมือ:

- curl (T02, local backend :4000 — **เป็น DB dev ที่ใช้ร่วมกัน** เลือกแถวทดสอบแล้วคืนค่าทุกครั้ง):
  - สำเร็จ 2–3 แถว (ตั้งค่า แล้วคืนค่าเริ่มต้น)
  - ส่ง `doc_version` เก่า 1 แถว → แถวนั้นอยู่ใน `conflicts` แถวอื่นบันทึก
  - id ที่ไม่มี → `not_found`
  - `account_code` ที่ไม่มีในผังบัญชี → 422 และไม่มีแถวไหนเปลี่ยน
  - payload ไม่มีทั้งสองช่อง / id ซ้ำ / 101 รายการ → 400
- เบราว์เซอร์: ติ๊ก 3 แถว → ตั้ง cost center → ตารางแสดง Overridden; ติ๊กอีกครั้ง → คืนค่าเริ่มต้น → กลับเป็น Default
