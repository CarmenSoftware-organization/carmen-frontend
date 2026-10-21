# บังคับใช้ Available Actions ของ workflow stage — Design

วันที่: 2026-10-21 · รีโป: `carmen-turborepo-backend-v2` (BE) + `carmen-inventory-frontend-react` (FE)

## ที่มา / ทำไม

หน้า `/system-admin/workflow/:id` → แท็บ Stages มี checkbox **Available Actions**
(Approve / Reject / Send back — stage แรกมี Submit) บันทึกลง
`workflow.data.stages[].available_actions.<action>.is_active` ได้ แต่ **ไม่มีผลอะไรเลย**:

- FE เลือกปุ่มบนเอกสาร (PR/PO/SR) จาก `role` ของ stage อย่างเดียว
  (`pr-footer-action.tsx:90`, `po-footer-action.tsx:127`, `sr-footer.tsx:59`)
- BE ไม่มี endpoint approve/reject/review ตัวไหนตรวจค่านี้
  `workflows.navagation.service.ts:232` คำนวณ `current_user_action` ไว้แต่ไม่มีใครอ่าน
- จุดเดียวที่ค่านี้มีผลคือหน้าตั้งค่าเอง (แท็บ Notifications ซ่อนช่องผู้รับของ action ที่ปิด)

ผลคือผู้ดูแลปิด Reject ของ stage ไว้ ผู้อนุมัติก็ยัง reject ได้ — config หลอกผู้ใช้
ผู้ใช้เลือก **บังคับจริงทั้ง FE และ BE** (ไม่ใช่แค่ซ่อนปุ่ม และไม่ใช่ถอด checkbox ทิ้ง)

## กลไกปัจจุบันที่ต้องเข้าใจ

ผู้อนุมัติไม่ได้กด approve/reject ทั้งใบตรง ๆ แต่ตัดสิน **ทีละรายการ** (approve / reject /
review) ผ่านปุ่ม bulk หรือแก้รายบรรทัด แล้วปุ่มท้ายใบเลือกตามผลรวม
(`computePurchaseAction` ใน `pr-purchase-action.ts`, `computePoAction`, `computeSrAction`):

| ผลรวมของรายการ | ปุ่มท้ายใบ | endpoint |
|---|---|---|
| มีรายการ review อย่างน้อย 1 | Send back | `PATCH …/review` |
| reject ทุกรายการ | Reject | `PATCH …/reject` |
| approve ≥ 1 ที่เหลือ reject | Approve / Purchase Approve / Issue | `PATCH …/approve` |

Purchase Approve (PR role `purchase`) และ Issue (SR role `issue`) ใช้ endpoint approve ตัวเดียวกัน

## กติกา (ผู้ใช้ตัดสิน)

ใช้กับ stage ที่ role เป็น **approve, purchase (PR) และ issue (SR)** — ทั้ง PR, PO, SR

- **Approve เปิด** → ติ๊กรายการเป็น approve ได้ และ **reject รายบรรทัดได้** ตราบที่ยังมี
  approve ≥ 1 (= ผ่านแบบตัดบางรายการ) — ตัดบางรายการได้แม้ Reject ปิด
- **Approve ปิด** → ตั้งรายการเป็น approve ไม่ได้ ปุ่ม Approve/Purchase Approve/Issue ไม่ขึ้น
- **Reject เปิด** → reject ครบทุกบรรทัด (ปัดตกทั้งใบ) ได้
- **Reject ปิด** → reject ครบทุกบรรทัดไม่ได้ ปุ่ม Reject ท้ายใบไม่ขึ้น
- **Send back ปิด** → ไม่มีตัวเลือก review ทั้ง bulk และรายบรรทัด ปุ่ม Send back ไม่ขึ้น

ตาราง action ↔ checkbox: endpoint `approve` = `approve` · `reject` = `reject` · `review` = `sendback`

หลักสำคัญ: **ต้องคุมตัวเลือกระดับรายการด้วย ไม่ใช่แค่ปุ่มท้ายใบ** — ไม่งั้นผู้อนุมัติติ๊กได้แต่ไม่มี
ปุ่มกดจบ เอกสารค้าง

## เป้าหมาย / ไม่ใช่เป้าหมาย

**เป้าหมาย**
- BE ปฏิเสธ action ที่ปิดอยู่ใน stage ปัจจุบันของเอกสาร ทุกเส้นทาง (ปกติ, swipe, my-pending)
- FE ไม่เสนอทางเลือกที่จะจบด้วย action ที่ปิด (bulk, รายบรรทัด, ปุ่มท้ายใบ)

**ไม่ใช่เป้าหมาย**
- AP invoice / AP payment — ผู้ใช้ตัดสินไม่รวม (FE ของ AP ยังเป็น mock) เปิดภายหลังเมื่อ AP ใช้ API จริง
- Submit ของ stage แรก (role create) — ไม่แตะ (ผู้ใช้กำหนดขอบเขตที่ approve/purchase/issue)
- แก้ notification dispatcher ที่ส่งตาม `recipients` โดยไม่ดู `is_active` ของ action
  (เมื่อ BE ปฏิเสธ action ที่ปิดแล้ว dispatcher ก็ไม่ถูกเรียกด้วย action นั้นอยู่ดี)
- **ช่องโหว่ `stage_role` ของ PR/SR** — PR/SR เชื่อ `stage_role` จาก client ตรง ๆ (PO มี
  `validateUserStageRole` ใน `purchase-order.logic.ts:683`) *[การตัดสินของ Claude: แยกเป็นงานถัดไป
  ผู้ใช้ยังไม่ได้ตอบ]* การตรวจในงานนี้อิง stage ของเอกสารบน server จึงไม่ถูกช่องนี้ข้าม

**Anti-goal** — สิ่งที่ถือว่าล้มเหลวแม้จะ "ทำงาน":
- เอกสารค้าง: ผู้อนุมัติตั้งสถานะรายการได้แต่ไม่มีปุ่มกดจบ
- workflow ที่ใช้อยู่จริงเสียปุ่มทันทีหลัง deploy

## การออกแบบ

### BE (`apps/micro-business`)

1. **ตรวจที่จุดเดียว** — `common/workflow/workflow-orchestrator.service.ts`
   ทุก action ของ PR/PO/SR ผ่าน `buildApproveWorkflow` (:96) / `buildRejectWorkflow` (:180) /
   `buildReviewWorkflow` (:220) อยู่แล้ว (รวม swipe และ my-pending) เพิ่ม guard ที่หา stage ตาม
   `workflow_current_stage` ของเอกสารใน `workflowData.stages` แล้วเช็ค
   `available_actions[actionKey].is_active`
   - `buildRejectWorkflow` ยังไม่โหลด workflow config — ต้องเพิ่ม (`resolveWorkflowData` :561)
   - orchestrator ไม่รู้ว่า purchase/issue = approve จึงให้ผู้เรียกส่ง action key เข้ามา หรือ
     ผูก key ตายตัวต่อ build method (approve→`approve`, reject→`reject`, review→`sendback`)
   - **ต้องเป็น opt-in** — AP invoice/payment (`ap-invoice.service.ts:654/701/746`,
     `ap-payment.service.ts:439/481/526`) เรียก build method ชุดเดียวกัน **ผู้ใช้ตัดสินว่าไม่รวม AP**
     ให้ PR/PO/SR เปิด guard เอง (เช่นส่ง option/flag) ส่วน AP เรียกแบบเดิมแล้วทำงานเหมือนเดิมทุกประการ
2. **Error** — เพิ่ม entry ใน error catalog (pattern เดียวกับ BE #835) พร้อมข้อความ en/th ฝั่ง FE
   HTTP status: *ปล่อยให้ builder เลือกให้สอดคล้อง guard อื่นใน orchestrator*
3. **ส่ง `available_actions` ให้ FE** — `resolveUserRole` (:389) เรียก `fetchStageRole` (:423)
   ซึ่งได้ stage ทั้งก้อนมาแล้วแต่เก็บแค่ `.role` ให้คืน `available_actions` ด้วย แล้วเพิ่มฟิลด์
   `available_actions` (ชื่อฟิลด์ระดับบนสุดของ detail) ใน serializer ทั้ง 3:
   `purchase-request.serializer.ts:121`, `purchase-order.serializer.ts:115`,
   `store-requisition.serializer.ts:51` และใน gateway serializer ถ้ามี
   (ดู memory "backend add-field serializer gotcha": ต้องเพิ่มทั้ง micro และ gateway)
4. **ค่าที่ไม่มี** — stage ที่ไม่มี `available_actions` หรือไม่มี key ของ action → *การตัดสินของ
   Claude: ถือว่าเปิด* (ข้อมูลเก่าไม่พัง) · หา stage ตาม `workflow_current_stage` ไม่เจอ (stage ถูก
   rename/ลบ, เอกสารจบแล้วเป็น `-`) → *การตัดสินของ Claude: ยอมผ่าน* (หลักเดียวกัน)
5. **ตรวจเฉพาะ role ที่อยู่ในขอบเขต** — guard ทำงานเมื่อ role ของ stage ปัจจุบันเป็น `approve`,
   `purchase` หรือ `issue` เท่านั้น (ตามที่ผู้ใช้กำหนด) stage create/view_only ไม่ตรวจ
   role ที่เป็นไปได้: PR = create/approve/purchase · PO = create/approve · SR = create/approve/issue
   (`getAllowedRoles` ใน `types/workflows.ts`) จึงไม่มี role อื่นที่เรียก approve
6. **ไม่ตรวจที่ path บันทึกสถานะรายการ** — *การตัดสินของ Claude:* การ save/update ที่ตั้ง
   `stage_status` ของรายการคุมฝั่ง FE อย่างเดียว BE บังคับที่ endpoint action (approve/reject/review)
   ซึ่งเป็นจุดที่เอกสารเปลี่ยน stage จริง ตั้งสถานะค้างไว้โดยไม่กด action ไม่มีผลกับ workflow

### FE

1. type detail ของ PR/PO/SR เพิ่ม `available_actions?` (shape เดียวกับ `AvailableActions` ใน
   `types/workflows.ts`)
2. helper กลาง (เช่น `lib/workflow-actions.ts`) แปลงเป็น
   `{ canApprove, canReject, canSendBack }` — **ฟิลด์ไม่มา = เปิดทั้งหมด** (BE ยังไม่ deploy ก็
   ทำงานเหมือนเดิม)
3. คุมสามระดับในแต่ละโมดูล:
   - **PR** — bulk `pr-item-fields.tsx` (:212, :402–445), รายบรรทัด `pr-item-cells/status-cell.tsx`,
     ท้ายใบ `workflow/pr-footer-action.tsx`
   - **PO** — bulk `po-item-fields.tsx` (:196, :279–323), รายบรรทัด `canResetStatus` →
     `use-po-item-table.tsx`, ท้ายใบ `po-footer-action.tsx`
   - **SR** — bulk `sr-item-fields.tsx` (:158, :194–224), รายบรรทัด `use-sr-item-table.tsx`
     (:254–262), ท้ายใบ `sr-footer.tsx`
4. กรณี Reject ปิด + Approve เปิด: ยังให้ reject รายบรรทัดได้ แต่ถ้าผลรวมกลายเป็น reject ทุก
   บรรทัด ต้องไม่มีปุ่มกดจบที่ผิดกติกา — วิธีบอกผู้ใช้ (กันไม่ให้ติ๊กบรรทัดสุดท้าย / ปุ่ม bulk
   Reject ปิด / ข้อความเตือนที่ footer) *ปล่อยให้ builder เลือก* แต่ต้องไม่เกิดสภาพ "ค้างเงียบ"
   — *การตัดสินของ Claude:* นับ "approve ≥ 1" จากค่าในฟอร์มปัจจุบัน (รวมที่ยังไม่ save) เพราะปุ่ม
   ท้ายใบก็คิดจาก `useWatch` อยู่แล้ว
5. หน้า config workflow: ไม่ต้องแก้ (validator `wf-validate.ts` บังคับให้มีอย่างน้อย 1 action อยู่แล้ว)

## ข้อมูลที่มีอยู่ / rollout

- ตรวจ dev DB BU T02 (10 workflow) เมื่อ 2026-10-21: ทุก stage ที่ใช้งานเปิด approve/reject/sendback
  ครบ ที่ปิดมีแค่ stage สุดท้าย "Completed" (ปลายทาง ไม่มี action อยู่แล้ว) → เปิดบังคับแล้วไม่มีใคร
  เสียปุ่ม · **BU อื่นยังไม่ได้ตรวจ** (บัญชีทดสอบ 403) — *การตัดสินของ Claude:* เป็นขั้นตอนก่อน
  deploy prod (query อ่านอย่างเดียวหา stage role approve/purchase/issue ที่มี action ปิด ทุก tenant)
  ไม่บล็อกการพัฒนาและ deploy dev
- ลำดับ deploy: **BE ก่อน FE** (FE ทนฟิลด์ที่ยังไม่มาได้ แต่ BE เป็นตัวบังคับจริง)
- branch: `feature/workflow-available-actions` ทั้งสองรีโป

## การตรวจ

ตามความชอบของผู้ใช้: ไม่เขียนเทสต์ใหม่ (ยกเว้นผู้ใช้ขอ) — รัน typecheck + lint, เทสต์ชุดเดิมต้องผ่าน,
ตรวจด้วย curl (ยิง action ที่ปิดแล้วต้องได้ error) และในเบราว์เซอร์ (ปิด Reject/Send back ของ stage
หนึ่งแล้วดูปุ่ม bulk/รายบรรทัด/ท้ายใบของ PR, PO, SR) — ระวัง dev DB เป็นของกลาง แก้ workflow ทดสอบ
แล้วคืนค่า

## ที่เหลือให้ builder

ชื่อ helper/ไฟล์, รูปแบบ error code, HTTP status, วิธีสื่อสารกรณี reject ครบทุกบรรทัดตามข้อ FE-4,
การแบ่ง PR/commit (แนะนำ: BE 1 PR, FE 1 PR)
