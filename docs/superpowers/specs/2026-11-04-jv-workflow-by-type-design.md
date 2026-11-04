# JV ผ่าน workflow ตามประเภท — design

วันที่: 2026-11-04 · รีโป: `carmen-turborepo-backend` (micro-business + gateway) และ `carmen-frontend`

## เจตนา

JV บางใบต้องให้คนอื่นตรวจก่อน post BU ต้องตั้งได้เองว่า **ใบประเภทไหน** ต้องผ่าน workflow
และ **ผ่านใคร** — ประเภทต่างกันไปหาคนอนุมัติคนละชุดได้ (เช่น AJ ไปถึง CFO, GJ หัวหน้าบัญชีพอ)

## สิ่งที่มีอยู่แล้ว (ตรวจ 2026-11-04)

- `enum_workflow_type.gl_jv` มีแล้ว; stage role ของ `gl_jv` = `create` / `approve`
  (`apps/micro-business/src/master/workflows/workflow-stage-role.helper.ts:44`)
- `tb_gl_jv_header` มีคอลัมน์ workflow ครบ (`workflow_id`, `workflow_*_stage`, `workflow_history`,
  `user_action`, `last_action*`) และ `enum_jv_status.in_review`
- `GlJvService.submit / approve / reject` (`apps/micro-business/src/gl/gl-jv/gl-jv.service.ts:406/497/554`)
  ใช้ `WorkflowOrchestratorService` ตัวเดียวกับ PR/PO/SR; อนุมัติขั้นสุดท้าย = post หรือ schedule;
  reject = กลับเป็น draft; วงเงินเดินขั้นด้วย `total_debit` (`gl-jv-workflow.mapper.ts`)
- **ช่องโหว่หลัก:** `resolveJvWorkflowId()` (`gl-jv.service.ts:381`) หยิบ workflow `gl_jv` ตัวแรกที่ active
  แล้วใช้กับทุกใบ — ไม่มีการแยกตามประเภท
- ใบจาก template (recurring/allocation/amortize) generate ออกมาเป็น draft; closing เป็น draft;
  **reversal post ทันทีถ้าผู้กดมีสิทธิ์ post** (`gl-posting.service.ts:757`)
- FE: `types/workflows.ts` รู้จักแค่ PR/PO/SR → สร้าง workflow ของ JV จาก UI ไม่ได้;
  repository ของ JV มี action submit/approve/reject แล้ว; แถบขั้นอนุมัติในหน้า JV detail
  (`routes/accounting/documents/accounting-document-detail.tsx` ~L1740) เป็นของ hardcode

## เป้าหมาย

1. หน้า `/system-admin/workflow` สร้าง/แก้ workflow ชนิด **Journal Voucher** ได้ ใช้ stage, ผู้อนุมัติ,
   วงเงิน, SLA, การแจ้งเตือน ของเดิมทั้งหมด
2. workflow JV แต่ละตัวมี **ขอบเขต** = ชุด prefix (`tb_gl_jv_prefix`) + ชุดที่มา (`source`)
   แทนการผูกสินค้าแบบ PR
3. ตอน submit ระบบเลือก workflow ให้เองจาก prefix + source ของใบ ผู้สร้างไม่ต้องเลือก
4. ใบที่ไม่เข้าขอบเขตของ workflow ใดเลย → post ทันที (พฤติกรรมเดิมของ BU ที่ไม่มี workflow)
5. หน้า JV แสดงขั้นจริง และมีปุ่มอนุมัติ / ตีกลับ ให้คนที่อยู่ในขั้นนั้น
6. ใบ reversal ที่เข้าขอบเขต workflow ต้องรออนุมัติ ไม่ post ทันที

## ไม่ทำ (non-goals)

- ใบจาก AP / AR / inventory / asset / interface **ไม่เข้า workflow** — ยัง post ตรงเหมือนเดิม
  (เอกสารต้นทางมี workflow ของตัวเอง: `ap_invoice`, `ap_payment`, `ar_invoice`)
  ฟอร์มขอบเขตเลือกได้เฉพาะ 6 ที่มา: `manual`, `recurring`, `allocation`, `amortize`, `reversal`, `closing`
- ไม่ให้ผู้สร้างเลือก workflow เอง
- ไม่มีการจัดลำดับความสำคัญระหว่าง workflow

## Anti-goals (ทำงานได้แต่ถือว่าล้มเหลว)

- ใบหนึ่งเข้าได้กับ workflow มากกว่าหนึ่งตัว → ไม่มีใครเดาได้ว่าใบไปทางไหน
- ใบ AP/inventory ค้างรออนุมัติ ทำให้ subledger posting พัง
- BU ที่ไม่เคยตั้ง workflow JV เปลี่ยนพฤติกรรมหลัง deploy

## กติกาขอบเขต (ตกลงกับ user)

- ขอบเขตของ workflow = **prefix ∈ ชุด prefix AND source ∈ ชุดที่มา**
- ชุดที่ว่าง = ทุกค่าของมิตินั้น (สำหรับ source คือทุกค่าใน 6 ที่มาที่อนุญาต)
- **ห้ามขอบเขตทับกัน** ระหว่าง workflow `gl_jv` ที่ active ใน BU เดียวกัน: workflow A กับ B ทับกันเมื่อ
  (prefix ทับกัน หรือฝั่งใดว่าง) **และ** (source ทับกัน หรือฝั่งใดว่าง). backend ปฏิเสธการบันทึก
  (create / update / เปิด active) ที่ทำให้ทับ พร้อมบอกชื่อ workflow ที่ชน; FE แสดงข้อความนั้น
- ใบหนึ่งจึงเข้าได้ ≤ 1 workflow เสมอ

## ส่วนที่ user ตัดสินใจแล้ว

- แยกได้ทั้ง prefix และที่มา; workflow แยกต่อประเภท; ระบบเลือกให้อัตโนมัติ; ไม่เข้าขอบเขต = post ทันที;
  ขอบเขตห้ามทับ; เฉพาะใบที่คนสร้าง/มาจาก template (6 ที่มา); reversal ต้องผ่าน workflow ด้วย
- **ใบ reversal จับขอบเขตด้วย prefix ของใบต้นทาง** (ไม่ใช่ `reversal_prefix_id` จาก GL settings ที่ใบ reversal
  ใช้เป็นเลขที่) เพื่อให้ไปหาผู้อนุมัติชุดเดียวกับใบเดิม; source ที่ใช้จับ = `reversal`
- **auto-reverse ที่ระบบสร้างตามเวลาที่ตั้งไว้ไม่ผ่าน workflow** — ถือว่าอนุมัติไปแล้วพร้อมใบต้นทาง
  พฤติกรรมคงเดิม; เฉพาะการกด reverse ด้วยมือที่ผ่าน workflow

## การตัดสินใจของผู้เขียน (ยังไม่ได้ถาม user — ทักได้)

- **ที่เก็บขอบเขต:** `tb_workflow.data.jv_scope = { prefix_ids: uuid[], sources: enum_gl_jv_source[] }`
  ใน JSON `data` เดิม ไม่เพิ่มคอลัมน์/ตาราง (แบบเดียวกับ `data.products` ของ PR) — ไม่ต้อง migration
- **workflow `gl_jv` ที่มีอยู่ก่อน** (ไม่มี `jv_scope`) = ขอบเขตว่างทั้งสองมิติ = ครอบทุกใบใน 6 ที่มา
  ตรงกับพฤติกรรมปัจจุบัน; ถ้า BU มีหลายตัวที่ไม่มี scope อยู่แล้ว ตัวเหล่านั้นทับกัน — resolve ยังใช้ตัวที่
  `created_at` เก่าสุดเหมือนเดิม และการบันทึกครั้งถัดไปจะโดนกฎห้ามทับ (ตามเอกสาร stage-role helper
  ยังไม่มี tenant ไหนตั้ง workflow `gl_jv` จริง จึงคาดว่าไม่เกิด)
- **resolve:** `resolveJvWorkflowId(header)` รับ `prefix_id` + `source`; ถ้า source ไม่อยู่ใน 6 ที่มา → null เสมอ
- **ใบที่อยู่ใน `in_review` แล้ว** เดินต่อตาม `workflow_id` ที่ผูกไว้ตอน submit แม้ภายหลังจะแก้ขอบเขต
  (resolve ทำครั้งเดียวตอน submit — ถ้าใบถูก reject กลับ draft แล้ว submit ใหม่ ให้ resolve ใหม่)
- **reversal (กดด้วยมือ):** ใน `gl-posting.service.ts` เส้นทาง reverse — ถ้าใบ reversal เข้าขอบเขต workflow
  ให้คืนเป็น draft (เหมือนกิ่ง `!canPost` ที่มีอยู่) แล้วผู้ใช้กด submit เอง; ไม่เข้าขอบเขต = พฤติกรรมเดิม
- **closing:** ออกมาเป็น draft อยู่แล้ว ใช้ submit ตามปกติ
- **action ที่มีใน v1:** submit / approve / reject (กลับ draft) ตามที่ backend มี — **ไม่เพิ่ม send back
  ไปขั้นก่อนหน้า** ในรอบนี้
- **ฟอร์ม workflow ฝั่ง FE:** เมื่อชนิด = JV ซ่อนแท็บสินค้า/routing ตามสินค้า แสดงแท็บ "ขอบเขต"
  (multi-select prefix จาก lookup ของ `config_gl-jv-prefixes` + checkbox 6 ที่มา) และ role ใน stage
  เลือกได้แค่ create/approve (backend บังคับอยู่แล้ว)
- **ชนิด workflow อื่นใน enum** (`ap_invoice`, `ap_payment`, `ar_invoice`) ยังไม่เปิดใน FE รอบนี้

- **reversal ที่รออนุมัติ — กันกลับรายการซ้ำ:** ตอนนี้ `reversed_by_jv_id` ของใบต้นทางเขียนเฉพาะใน
  `postReversal` หลัง post. เมื่อ reversal ไปทาง workflow: ตอนสร้าง draft reversal ต้องกันไม่ให้ใบต้นทางถูก
  reverse ซ้ำขณะที่ใบแรกยังเป็น draft/`in_review` (เช่นเช็ค `reversal_of_jv_id` ที่ยังไม่ void) และตอน
  `approve` ขั้นสุดท้ายที่ post ใบ reversal ต้องเขียน `reversed_by_jv_id` ของใบต้นทาง + ตรวจซ้ำว่ายังไม่ถูก
  reverse — ใน transaction เดียวกับการ post
- **ตรวจห้ามทับ:** ทำตอน create / update / เปิด active / restore / duplicate; ทำใน transaction
  (lock แถว workflow `gl_jv` ของ BU ด้วย `SELECT … FOR UPDATE` หรือ advisory lock) กันสอง save พร้อมกัน
- **prefix ใน scope ที่ถูกปิด/ลบภายหลัง:** ไม่ทำให้พัง — ถูกข้ามตอน resolve และตอนตรวจทับ;
  ฟอร์มแสดงว่าเป็น prefix ที่ไม่ active
- **ผู้ submit อนุมัติใบตัวเองได้ไหม:** ใช้พฤติกรรมของ orchestrator เดิมเหมือน PR/PO ไม่เพิ่มกฎแยกหน้าที่รอบนี้
- **ใครเห็นปุ่มอนุมัติ/ตีกลับ:** ใช้ข้อมูลที่ API ส่งมา (`user_action` / capabilities ของใบ) แบบเดียวกับ PR;
  ถ้า JV detail ยังไม่ส่ง ให้เพิ่มฝั่ง backend — FE ไม่คำนวณสิทธิ์เอง

## สิ่งที่เหลือให้ builder

- ตำแหน่ง validate ห้ามทับ (micro-business workflows service ฝั่ง create/update) และรูปแบบ error
  (ใช้ error catalog ที่มีอยู่)
- schema validation ของ `data.jv_scope` ใน gateway DTO
- หน้าตา UI ของแท็บขอบเขต, แถบขั้นจริง (ใช้ `WorkflowTrack` + ข้อมูล `workflow_*_stage`/history จาก API),
  ปุ่มอนุมัติ/ตีกลับ — ตาม `docs/DESIGN.md` และกฎปุ่มหลักตัวเดียวต่อหน้า
- ตรวจว่า approval queue ("My pending") และ `workflows.service` ส่วนนับ/หาใบค้างของ `gl_jv`
  (`workflows.service.ts:783/923`) แสดง JV ถูกต้อง
- ถอด `JournalVoucherStatus` ชุดเก่าที่ไม่ตรง backend ในจุดที่แตะ (ดู learning 2026-11-04 เรื่อง jv_status)

## ข้อจำกัด / deploy

- BE ต้องขึ้นก่อน FE (FE ส่ง `data.jv_scope` ที่ backend เก่าไม่ validate/ไม่ใช้)
- allowlist api_name ใหม่ (ถ้ามี) ต้องเติมทุก env ก่อน FE — api_name ที่ยังไม่อยู่ใน allowlist เด้ง user ออก
- ไม่มี migration (เก็บใน JSON เดิม)
