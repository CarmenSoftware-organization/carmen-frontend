# บังคับใช้ Hide Fields ของ workflow stage — Design

วันที่: 2026-10-21 · รีโป: `carmen-turborepo-backend-v2` (BE) + `carmen-inventory-frontend-react` (FE)

## ที่มา / ทำไม

หน้า `/system-admin/workflow/:id` → แท็บ Stages มี checkbox **Hide Fields**
(`price_per_unit`, `total_price`) บันทึกลง `workflow.data.stages[].hide_fields` ได้
(`wf-stage-general.tsx:399-418`) แต่ **ไม่มีผลอะไรเลย**:

- BE แค่ส่งผ่าน — `buildStageInfo()` (`workflows.navagation.service.ts:457`) ใส่ไว้ใน
  `current_stage_info`/`next_stage_info` แต่ไม่มีโค้ดตรงไหนอ่าน `.hide_fields`
- FE ไม่มีหน้าเอกสาร (PR/PO/SR) ตัวไหนอ่านค่านี้ — ที่เดียวที่ใช้คือนับใน insights
  (`wf-insights-utils.ts:139`)
- mobile / micro-report / report-render ไม่อ้างถึงเลย

ผลคือผู้ดูแลติ๊กซ่อนราคาที่ stage HOD แล้ว HOD ยังเห็นราคาครบ — config หลอกผู้ใช้
ผู้ใช้เลือก **บังคับจริง โดย BE เป็นคนตัดข้อมูลออก** (ไม่ใช่แค่ซ่อนบนจอ — ซ่อนแค่ FE
ยังเปิด network tab ดูได้)

## กติกา (ผู้ใช้ตัดสิน)

- ซ่อนเมื่อ **ทั้งสองข้อเป็นจริง**: เอกสารค้างอยู่ใน stage ที่ติ๊ก hide_fields ไว้ **และ**
  ผู้ใช้ที่เรียกเป็นคนของ stage นั้น
- คนอื่น (จัดซื้อ, ผู้สร้าง, ผู้ดูทั่วไป) เปิดเอกสารใบเดียวกันในเวลาเดียวกัน → **เห็นราคาครบ**
- เอกสารออกจาก stage นั้นแล้ว → คนเดิมก็เห็นราคาตามปกติ (ไม่ซ่อนย้อนหลัง/ตลอดไป)
- ซ่อน **ทุกช่องทาง** ที่ราคาออกไปหาผู้ใช้: รายละเอียด, list, my-pending / my-approve
  (รวม unified list), print / print-viewer, export, history ของรายการ, activity log
- บนจอ **คอลัมน์ราคายังอยู่** แต่แสดงว่า "ถูกซ่อน" — ต้องไม่ดูเหมือนราคาเป็น 0 หรือว่าง

## เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย**
- PR และ PO: response ทุก endpoint ที่ผู้ใช้อ่านได้ไม่มีค่าราคาในช่องที่ถูกซ่อน สำหรับคนใน stage
- การ approve / save จาก stage ที่ถูกซ่อน ต้องไม่ทำให้ราคาใน DB เปลี่ยน
- FE แสดงป้าย "ถูกซ่อน" แทนตัวเลขทุกจุดที่ BE ส่ง null มาเพราะการซ่อน

**ไม่ใช่เป้าหมาย**
- **SR** — เอกสาร SR ไม่มีฟิลด์ราคา (ราคาโผล่แค่ `stock-movements` ซึ่งเป็นต้นทุนสต็อก
  ไม่ใช่ราคาเอกสาร) → ไม่ enforce แต่ **ซ่อน checkbox Hide Fields ในหน้าตั้งค่า workflow
  ชนิด SR** (ค่าเดิมที่บันทึกไว้ปล่อยทิ้ง ไม่ต้อง migrate)
- workflow ชนิดอื่น (gl_jv, ap_invoice, ap_payment, ar_invoice) — ไม่มี hide_fields ใน UI
- **รายงานทั่วไปของ micro-report ที่ query DB ตรง** (เช่น `Purchase_Request_List_Report`)
  ไม่รู้ว่าใครเปิด → ไม่ถูกซ่อนในงานนี้ เป็นช่องโหว่ที่รู้แล้ว ทำแยกถ้าต้องการ
- แอป mobile — ยังไม่ live
- comment ของเอกสาร — ข้อความที่ผู้ใช้พิมพ์เอง ไม่ใช่ฟิลด์ราคา
- dashboard / widget ที่รวมยอด PR/PO — นอกขอบเขต (ตัดสินโดย Claude)
- **sort / filter ตามคอลัมน์ราคาใน list ยังเปิดไว้** — คนใน stage เดาราคาคร่าว ๆ จากลำดับได้
  รับเป็นช่องโหว่ที่รู้แล้ว เพราะแถวต่าง stage ปนกันในหน้าเดียว การปิดเฉพาะแถวซับซ้อนเกินคุ้ม
  (ตัดสินโดย Claude)

## ใครคือ "คนใน stage" (ตัดสินโดย Claude)

ใช้เกณฑ์เดียวกับคนที่กด action ได้ใน stage ปัจจุบัน: `user_id` อยู่ใน
`user_action.execute` ของเอกสาร (สร้างโดย `WorkflowOrchestratorService.buildUserAction`
`workflow-orchestrator.service.ts:326` จาก assigned_users / is_hod / creator_access)
— logic เดียวกับ `resolveUserRole` (`:396`) ที่ตอบ role ≠ `view_only`

ดังนั้นคนที่เป็นทั้งจัดซื้อและอยู่ใน stage HOD → ถูกซ่อน (เพราะอยู่ใน execute)
ไม่มีข้อยกเว้นสำหรับ admin / god mode — อยู่ใน execute ก็ถูกซ่อน (ตัดสินโดย Claude)

**stage แรก (role `create`) ไม่ใช้ Hide Fields** (ผู้ใช้ตัดสิน) — PO ส่วนใหญ่จัดซื้อเป็นคน
สร้างและพิมพ์ราคาเอง ถ้าซ่อนที่ stage แรกจะสร้างเอกสารที่มีราคาไม่ได้ ดังนั้น:
- helper ตอบ "ไม่ซ่อน" เสมอเมื่อเอกสารเป็น draft / ยังไม่มี stage / stage ปัจจุบัน role = `create`
  — แม้ค่าใน DB จะติ๊กไว้ (ข้อมูลเก่าที่ติ๊กค้างไว้ไม่ต้อง migrate)
- หน้าตั้งค่า workflow ซ่อนบล็อก Hide Fields ใน stage ที่ role = `create`

**config ที่ใช้:** อ่าน `hide_fields` จาก workflow ปัจจุบัน ของ stage ที่ตรงกับ
`workflow_current_stage` — ไม่ snapshot ตอนเอกสารเข้า stage (admin แก้ config แล้วมีผลทันที
กับเอกสารที่ค้างอยู่) (ตัดสินโดย Claude)

## ฟิลด์ที่ซ่อนต่อ checkbox (ตัดสินโดย Claude)

| checkbox | PR | PO |
|---|---|---|
| `price_per_unit` | รายบรรทัด: `pricelist_price`, `last_price` (ทั้ง object), `pricelist_no`, ผล pricelist compare | รายบรรทัด: `price`, `unit_price`; `pr_details` ที่ซ้อนอยู่ถ้ามีราคา |
| `total_price` | รายบรรทัด: `sub_total_price`, `net_amount`, `total_price`, `tax_amount`, `discount_amount`, `base_*` · list: `base_net_amount`, `base_total_amount` | รายบรรทัด: `sub_total_price`, `net_amount`, `total_price`, `tax_amount`, `discount_amount`, `base_*` · หัว: `sub_total`, `discount_amount`, `tax_amount`, `total_amount` · list: `total_price`, `total_tax`, `net_amount`, `total_amount`, `base_*` |

**ไม่ซ่อน:** `tax_rate`, `discount_rate`, `exchange_rate`, สกุลเงิน, จำนวน — ไม่ใช่ราคา
(ผู้อนุมัติยังต้องเห็นจำนวน) · ถ้า builder เจอฟิลด์ราคาอื่นที่ตารางนี้ไม่ได้ระบุ ให้จัดเข้ากลุ่ม
ตามความหมาย (ต่อหน่วย vs ยอดเงิน) แล้วจดไว้ใน PR

## รูปแบบ response (ตัดสินโดย Claude)

- ฟิลด์ที่ถูกซ่อนส่งเป็น `null` (ไม่ลบ key — FE/Zod ฝั่ง client จะได้ไม่พัง)
- แนบ `hidden_fields: ("price_per_unit" | "total_price")[]` ที่ระดับเอกสาร (detail) และ
  ระดับแถว (list / my-pending) — ว่าง = ไม่ซ่อน · FE ใช้ตัวนี้ตัดสินว่าจะแสดงป้าย "ถูกซ่อน"
  **ห้าม** อนุมานจาก `null` เอง (null ที่แท้จริงยังมีได้ เช่นยังไม่ใส่ราคา)
- **ตัดที่ขอบ handler/controller ของ micro-business ไม่ใช่ใน `findById`** — logic ภายใน
  (approve routing อ่าน `total_amount` ที่ `purchase-request.logic.ts:619-634`) ต้องได้ราคาจริง
- ทำเป็น helper กลางตัวเดียว (เช่น `resolveHiddenPriceFields(doc, userId, workflow)` +
  ตัว mask ต่อชนิดเอกสาร) ใช้ซ้ำทุก endpoint — อย่าเขียนเงื่อนไขซ้ำทีละจุด

## ช่องทางที่ต้องครอบ

| ช่องทาง | PR | PO | หมายเหตุ |
|---|---|---|---|
| detail | ✓ | ✓ (+ `:id/details`, `details/:detail_id`) | |
| list | ✓ | ✓ | ต้องตัดสินต่อแถว — PR list มี role ต่อแถวแล้ว (`service.ts:406-440`), PO list ยังไม่มี ต้องเพิ่ม |
| my-pending detail/list + my-approve | ✓ | ✓ | |
| unified my-pending (`sys_v_my_pending`) | ✓ | ✓ | แถวใน my-pending แทบทั้งหมดคือ "ผู้ใช้อยู่ใน stage" → ตัดสินจาก stage ของแถว |
| print / print-viewer | ✓ | ✓ (+ send-email ที่แนบ PDF) | payload ไป micro-report มาจาก micro-business (`purchase-request.service.ts:3333`, `purchase-order.service.ts:6727`) → mask ก่อนส่ง แสดงเป็น `***` |
| export | ✓ | ✓ | เซลล์ว่าง |
| history ของรายการ / calculate / for-po | ✓ | — | `detail/:id/history`, `detail/:id/calculate`, `for-po` — builder ตรวจว่าใครเรียกได้ แล้ว mask ตามกติกา |
| activity log | ✓ | ✓ | ตัดฟิลด์ราคาออกจาก `old_data`, `new_data` และรายการ `changes` เมื่อ entity เป็น PR/PO ที่ผู้เรียกถูกซ่อน *ณ ตอนที่เปิดดู* (ไม่ใช่ตอนที่ log ถูกเขียน) · log ของ entity รายบรรทัด (`pr_detail`/`po_detail`) หาเอกสารแม่เพื่อดู stage (โหลดเป็นชุดต่อหน้า ไม่ N+1) (ตัดสินโดย Claude) |
| PO GRN endpoints | — | ตรวจ | ถ้าคืนราคาจาก PO ให้ใช้กติกาเดียวกัน |

## การเขียนกลับ (กับดักหลัก)

**PR — เสี่ยงสูง:** ตอน approve / save ใน stage อนุมัติ FE ส่งราคาทุกบรรทัด
(`prepareApproveDetails` `pr-form-schema.ts:559-595`, ใช้ที่ `use-pr-form-actions.ts:246,558`)
และ BE เขียนตรงลง `tb_purchase_request_detail` (`purchase-request.service.ts:1981-2003`,
`logic:272-290`) — ถ้า GET ส่ง null แล้ว FE ส่งกลับเป็น 0/NaN ราคาหายและ routing ตาม
`total_amount` เพี้ยน

ผู้อนุมัติ PR **แก้จำนวนได้** (`approved_qty`, `approved_unit_id`, `foc_qty`) — ถ้าแค่ทิ้งยอดเงิน
ยอดใน DB จะค้างเป็นค่าเก่าและ routing ตาม `total_amount` เพี้ยน ผู้ใช้เลือก
**ให้ BE คำนวณยอดใหม่เอง** (ไม่ล็อกจำนวน — HOD ยังตัดจำนวนได้ตามปกติ):

กติกา **ฝั่ง BE** เมื่อผู้เรียกถูกซ่อน ณ stage ปัจจุบัน (approve / save / reject / review ของ PR):
1. **ทิ้ง key ราคาทุกตัว** (ทั้งสองกลุ่ม ไม่ว่าติ๊กช่องไหน) และ **ทิ้ง key ที่เปลี่ยนแหล่งราคา**:
   `vendor_id`, `pricelist_detail_id`, `pricelist_no`, `pricelist_type`, `currency_id`,
   `tax_profile_id`, `tax_rate`, `discount_rate`, `is_tax_adjustment`, `is_discount_adjustment`
   — เลือก vendor/pricelist โดยไม่เห็นราคาไม่ได้อยู่แล้ว (ไม่ error — ผู้ใช้ไม่ได้ทำอะไรผิด)
2. ถ้าจำนวนเปลี่ยน → **คำนวณยอดรายบรรทัดใหม่ฝั่ง BE** จากราคาต่อหน่วยใน DB × จำนวนใหม่
   ด้วยภาษี/ส่วนลด (rate) เดิมของบรรทัด แล้วคำนวณยอดหัวเอกสารใหม่ — ต้องเกิด **ก่อน**
   routing อ่าน `total_amount` · ใช้ logic เดียวกับ `detail/:id/calculate` ที่มีอยู่
   (builder ตรวจว่าครอบ tax-inclusive / adjustment / base_* ด้วยอัตราแลกเปลี่ยนเดิมครบ)
3. ผลลัพธ์ต้องตรงกับที่ FE คำนวณเดิมเมื่อ input เท่ากัน (ห้ามสูตรคนละชุดกับ FE)

**ฝั่ง FE** stage ที่ถูกซ่อน: ช่องจำนวนยังแก้ได้ · ช่อง vendor / pricelist / ภาษี / ส่วนลด
เป็น read-only · ไม่ส่ง key ที่ BE จะทิ้ง (กันซ้ำสองชั้น) · ไม่คำนวณยอดจากช่องที่เป็น null
ยอดใหม่ไปเห็นหลังเอกสารออกจาก stage (คนใน stage ไม่ต้องเห็นอยู่แล้ว)

**PO — เสี่ยงต่ำ:** approve ส่งแค่สถานะ (`use-po-form-handlers.ts:105-110`) และ save ของ
non-creator เก็บแค่สถานะ (`purchase-order.logic.ts:344-358`) — stage create ไม่ใช้ Hide Fields
แล้ว จึงไม่มีเส้นทางเขียนราคาจากคนที่ถูกซ่อน ใส่กติกาทิ้ง key ไว้ที่ save/approve ของ PO
ด้วยเพื่อความสม่ำเสมอ

## FE

- ทุกจุดที่แสดงราคาของ PR/PO (ฟอร์มรายละเอียด, cell ในตาราง, list, my-pending card,
  swipe card, ยอดรวมท้ายใบ) อ่าน `hidden_fields` → แสดงป้ายเดียวกันทั้งแอป
  (ข้อความ i18n "ซ่อน"/"Hidden" + ไอคอนกุญแจ/ตา) แทนตัวเลข และ input ราคาเป็น read-only
- ทำเป็น component กลางตัวเดียวใน `components/` ใช้ token ที่มีอยู่ อ่านออกทั้ง light/dark
- ปุ่ม pricelist compare / last price ที่ผูกกับช่องราคาต่อหน่วย → ซ่อนปุ่มเมื่อ `price_per_unit` ถูกซ่อน
- หน้าตั้งค่า workflow: ซ่อนบล็อก Hide Fields เมื่อ workflow type = store_requisition
  **หรือ** stage role = `create` (ทั้งโหมดแก้และโหมดดู `wf-stage-general.tsx:110-167`,
  `:399-418`) · insights (`wf-insights-utils.ts:139`) ไม่นับ stage ที่ไม่มีผล

## Deploy

BE ก่อน FE เหมือนทุกครั้ง — BE ใหม่ + FE เก่า: FE เก่าจะเห็นราคาเป็น null ที่ stage ที่ติ๊กไว้
(แสดงว่าง/0 ไม่สวยแต่ไม่พัง และ BE ทิ้ง key ราคาตอน approve จึงไม่ wipe ข้อมูล)
ก่อนขึ้น prod ให้ตรวจว่ามี tenant ไหนติ๊ก hide_fields ไว้อยู่แล้วบ้าง — พอ deploy จะมีผลทันที
กับ workflow ที่ติ๊กค้างไว้โดยไม่รู้ว่ามันไม่ทำงาน

## เหลือให้ builder ตัดสิน

- ชื่อ/ที่อยู่ของ helper กลางใน micro-business และวิธีเสียบเข้าแต่ละ endpoint
- รูปแบบป้าย "ถูกซ่อน" (ไอคอน, tooltip อธิบายว่าซ่อนตาม workflow)
- วิธีคำนวณ hidden ต่อแถวใน list โดยไม่ N+1 (โหลด workflow ที่เกี่ยวข้องครั้งเดียวต่อ request)
