# Price List: Void แทน Delete + Hard delete สำหรับ admin

วันที่: 2026-10-21 · รีโป: `carmen-turborepo-backend-v2` (BE) + `carmen-inventory-frontend-react` (FE)

## ทำไม

ใบ price list ได้เลขเอกสาร (`no`) ตั้งแต่สร้าง ปุ่ม "ลบ" ตอนนี้เป็น soft delete
(`price-list.service.ts` `remove()` → `status = inactive` + `deleted_at`) ซึ่งทำให้ใบหายจากทุกหน้า
เลขเอกสารขาดช่วงโดยไม่มีใครตามได้ว่าเลขนั้นไปไหน ผู้ใช้อยากให้ใบที่ยกเลิก **ยังอยู่และมองเห็นได้**
ในสถานะโมฆะ ส่วนการลบทิ้งจริงให้เป็นสิทธิ์ของ admin เท่านั้น

## เป้าหมาย

1. ใบทุกสถานะ (draft / submitted / active / inactive / expired) กด **Void** ได้ ต้องกรอกเหตุผล
2. ใบที่ void แล้วขึ้นในแท็บ **"ทั้งหมด"** เท่านั้น พร้อมป้าย **โมฆะ** (สีเทา) และไม่ขึ้นในแท็บ "ยังมีผล" / "หมดช่วงแล้ว"
3. ใบที่ void แล้ว **กู้คืนได้** และกลับเป็น **`draft` เสมอ** (ต้อง submit/activate ใหม่ก่อนเข้า compare)
4. **Admin** (BU role `admin`) hard delete ได้ ลบทั้งหัวเอกสารและบรรทัดออกจาก DB จริง
5. ใบที่เคยถูก soft delete ไปแล้ว ให้ migration แปลงเป็น `voided` กลับมาเห็นในแท็บ "ทั้งหมด"
6. `inactive` ยังอยู่ แต่เปลี่ยนความหมายเป็น **"พักใช้ชั่วคราว"** ผู้ใช้ยังตั้งได้จากฟอร์มและเปิดกลับเป็น active ได้
   ให้แก้คอมเมนต์ใน enum ให้ตรงความหมายใหม่ ส่วนใบ `inactive` ที่ไม่มี `deleted_at` **ไม่ต้องแปลง** (user เลือก)
7. Void ได้เสมอ แม้ PR/PO ดึงราคาจากใบนั้นไปใช้แล้ว เอกสารเดิมยังใช้ราคาที่คัดลอกเก็บไว้ต่อ ใบที่ void มีผลแค่ไม่ถูกดึงไปใช้ในเอกสารใหม่

## ไม่ทำ

- ไม่เพิ่ม permission key ใหม่ (คีย์ที่ยังไม่ seed จะทำให้ non-admin กดไม่ได้เงียบ ๆ)
- ไม่แตะ price list template / request price list
- ไม่ทำ bulk void

## สิ่งที่ห้ามเกิด (anti-goals)

- ใบ voided ถูกดึงเข้า compare price ของ PR/PO
- กู้คืนแล้วใบกลับเข้า compare โดยไม่ผ่านการ activate ใหม่
- hard delete ทิ้งใบที่ PR/PO อ้างอยู่ หรือขึ้น error กลาง ๆ ที่ไม่บอกเหตุผล
- non-admin hard delete ได้ด้วยการยิง API ตรง (ซ่อนปุ่มอย่างเดียวไม่พอ)

## การออกแบบ (ส่วนที่ตกลงกันแล้ว)

### ข้อมูล (BE · `prisma-shared-schema-tenant`)

- `enum_pricelist_status` เพิ่มค่า `voided // โมฆะ` ใช้คำเดียวกับ enum ของเอกสารอื่นในระบบ และแก้คอมเมนต์ `inactive` เป็น "พักใช้ชั่วคราว"
- `tb_pricelist` เพิ่มคอลัมน์ `void_reason String?`, `voided_at Timestamptz?` และ `voided_by_id Uuid?`
- migration แปลงข้อมูลเก่า: แถวที่ `deleted_at IS NOT NULL` ให้ตั้ง `status = 'voided'`, `voided_at = deleted_at`,
  `voided_by_id = deleted_by_id` (ถ้ามี ไม่งั้นใช้ `updated_by_id`), `void_reason = NULL` และ **ล้าง `deleted_at`/`deleted_by_id` เป็น NULL**
  ไม่งั้น soft-delete extension จะซ่อนแถวไว้เหมือนเดิม บน UI ใบเก่าพวกนี้จะไม่มีเหตุผล ให้ขึ้นเป็น "—"
- migration ต้องรันทุก BU (tenant schema)

### API (BE)

| Endpoint | api_name (AppIdGuard) | สิทธิ์ | ผล |
|---|---|---|---|
| `POST api/config/:bu_code/pricelists/:id/void` body `{ reason }` | `pricelist.void` (ใหม่) | `vendor_management.price_list.delete` | ทุกสถานะยกเว้น `voided` → `voided` + เก็บ reason/at/by · reason ว่าง (trim แล้ว) = 400 · void ซ้ำ = 409 |
| `POST api/config/:bu_code/pricelists/:id/restore` | `pricelist.restore` (ใหม่) | `vendor_management.price_list.delete` | `voided` → `draft` · `submitted_at` ให้ทำเหมือนตอน `update()` เปลี่ยนเป็น draft (อ่าน ~1206–1215 ก่อน อย่าเดา) · เก็บ void_* ไว้ไม่ล้าง (void ซ้ำภายหลังจะทับค่าเหล่านี้ ประวัติครบอยู่ใน activity) · ไม่ใช่ voided = 409 |
| `DELETE api/config/:bu_code/pricelists/:id` | `pricelist.remove` (เดิม) | **BU role `admin` เท่านั้น** ตรวจฝั่ง BE | เปลี่ยนความหมายเป็น **hard delete** |

- **ต้องเติม allowlist `pricelist.void` / `pricelist.restore` ทุก env ก่อน deploy FE** เพราะ api_name ที่ยังไม่อยู่ใน allowlist จะเด้ง user ออกไปหน้า login
- hard delete: ก่อนลบให้ตรวจว่ามีแถวใดใน DB อ้าง `tb_pricelist.id` หรือ `tb_pricelist_detail.id` อยู่ (schema.prisma ~461, ~2687, ~5233, ~5358, ~5392)
  ถ้ามี ให้ตอบ 409 จาก error catalog ใหม่ พร้อมบอกประเภทและเลขเอกสารที่อ้าง (อย่างน้อยเลขแรก ๆ) ถ้าไม่มี
  ให้ลบ detail และหัวใน transaction เดียว
  - *(ผู้ออกแบบตัดสินใจ)* **ของในใบเอง** ได้แก่ `tb_pricelist_comment`, `tb_pricelist_detail_comment` และบรรทัด detail ที่ถูกซ่อนไปแล้ว ให้ลบไปพร้อมกัน ไม่ถือเป็นตัวบล็อก
  - *(ผู้ออกแบบตัดสินใจ)* **เอกสารอื่นที่อ้างถึงใบนี้** (PR/PO/RFP …) จะบล็อกการลบเสมอ แม้เอกสารนั้นจะถูกซ่อนไปแล้ว (FK `NoAction` ก็บล็อกอยู่แล้ว) และใน 409 ให้ระบุว่าเอกสารไหนถูกลบไปแล้ว
- *(ผู้ออกแบบตัดสินใจ)* **การตรวจ admin** ใช้วิธีเดียวกับ `config_app-config.controller.ts` ~283 คืออ่าน `role` ของ BU นั้นจาก header `x-bu-datas`
  แล้วเทียบกับ `enum_user_business_unit_role.admin` ส่วน platform user ที่ไม่มีแถว admin ของ BU นั้นจะลบไม่ได้
- **สิทธิ์ของ endpoint ใหม่**: controller มีแค่ `AppIdGuard` ผู้ลงมือต้องหาว่าการตรวจ permission `price_list.delete` ผูกไว้ที่ไหน
  (`route-config.ts` / `app-api-catalog.generated.ts` / `license-catalog.generated.ts`) แล้วเติมให้ void/restore ครบ ห้ามปล่อยให้ใครก็เรียกได้หรือเรียกไม่ถึง
- **ห้ามให้ใบ voided หลุดเข้า compare**: query ฝั่ง compare/active-by-vendor กรองด้วย `status = active` อยู่แล้ว (~696, ~874, ~981) ให้ตรวจซ้ำว่าครบทุกจุด
- `update()` ต้องปฏิเสธการแก้ไขใบ `voided` (409) และห้ามเปลี่ยนสถานะเป็น `voided` ผ่าน PATCH ให้ทำผ่าน endpoint void เท่านั้น
- response ของ findOne/findAll เพิ่ม `void_reason`, `voided_at`, `voided_by` (ชื่อ ผ่าน enrich แบบเดียวกับ audit)
  ต้องเติมทั้ง select/serializer ของ micro-business **และ** `@Serialize` schema ของ gateway ไม่งั้น GET จะตัดฟิลด์ทิ้ง

### FE

- **list** (`routes/vendor-management/price-list/pl-component.tsx`):
  - แท็บ "ยังมีผล" และ "หมดช่วงแล้ว" เพิ่มเงื่อนไขไม่เอา `voided` ผ่าน filter `status|string:` แบบหลายค่า (paginate รองรับ `in` อยู่แล้ว)
  - แท็บ "ทั้งหมด" แสดงทุกใบ ใบ voided ใช้ป้าย "โมฆะ" สีเทา
  - status filter และ `StatusIconLabel`/`ts(status)` เพิ่ม `voided` (ตาราง การ์ด และ Excel export)
  - ปุ่มถังขยะในแถวเปลี่ยนเป็น **Void** (ใช้ `useDeleteGate` เดิม) และซ่อนเมื่อใบเป็น voided แล้ว
- **form/view** (`pl-form.tsx`):
  - toolbar มีปุ่ม **Void** (ใบไม่ใช่ voided) หรือ **Restore** (ใบ voided)
  - **Hard delete** แสดงเฉพาะ `useCan().isAdmin` dialog ใช้ถ้อยคำแรงกว่าปกติ และบอกว่าเลขเอกสารจะหายถาวร
  - ใบ voided เปิดดูได้อย่างเดียว ไม่มีปุ่ม Edit แต่มีแถบแจ้ง "โมฆะ — โดย X เมื่อ Y · เหตุผล: Z"
- **Void dialog**: มีช่องเหตุผล (textarea) ที่ต้องกรอก ปุ่มยืนยันกดไม่ได้ถ้าเหตุผลว่าง
- 409 ของ hard delete แสดงข้อความจาก catalog (เอกสารที่อ้างอยู่) ไม่ใช่ข้อความกลาง
- hooks: เพิ่ม `useVoidPriceList` / `useRestorePriceList` ใน `hooks/use-price-list.ts` และ invalidate list + detail
- i18n en/th: "Void"/"ยกเลิก (โมฆะ)", "Restore"/"กู้คืน", ป้าย "โมฆะ" และข้อความ dialog
  (ห้ามมี `{{}}` หรือ `<คำ>` ในข้อความ)
- activity sheet: void/restore ต้องอ่านออก ตรวจ `ACTION_TITLE_KEY` ให้ครอบ action ที่ BE บันทึก (ดู skill `activity-sheet`)

### ลำดับ deploy

allowlist `pricelist.void`/`pricelist.restore` → migration ทุก BU → BE → FE
(ถ้า FE ขึ้นก่อน ปุ่ม Void จะยิง endpoint ที่ยังไม่มี และถ้า BE ขึ้นก่อน FE ปุ่มเดิมจะกลายเป็น hard delete ซึ่ง non-admin จะโดน 403)
**BE กับ FE ควรขึ้นติดกัน** · mobile ยังไม่ live จึงเปลี่ยนความหมายของ DELETE ได้

## ส่วนที่ปล่อยให้ผู้ลงมือตัดสินใจ

- ชื่อและรหัสของ error catalog (void ซ้ำ, restore ใบที่ไม่ใช่ voided, แก้ใบ voided, hard delete ติดอ้างอิง)
- วิธีหาเอกสารที่อ้างอยู่ (query ต่อตาราง หรือดัก FK violation แล้วค่อยหา)
- รูปแบบแถบแจ้งโมฆะในหน้า view (ใช้ component ที่มีอยู่ใน `components/ui/` และอ่านออกทั้ง light/dark)
- ความยาวสูงสุดของ reason (แนะนำ 500)

## การตรวจสอบ

typecheck และ lint ทั้งสองรีโป และ jest ของ micro-business/gateway ต้องไม่แดงเพิ่ม
ตรวจมือบน dev ทั้ง curl และเบราว์เซอร์ให้ครบทุกเส้น: void → เห็นในแท็บ "ทั้งหมด" และไม่อยู่ในอีกสองแท็บ →
ไม่ขึ้นใน compare → restore แล้วเป็น draft → admin hard delete ใบที่ไม่มีใครอ้างได้ →
ใบที่มีคนอ้างได้ 409 พร้อมเลขเอกสาร → non-admin ยิง DELETE แล้วได้ 403 → ใบเก่าที่ soft delete ไว้กลับมาเป็น voided
