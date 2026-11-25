# JV workflow — ออกแบบใหม่ให้ตรงกับ AP/AR + ขอบเขตแบบลำดับชั้น

วันที่: 2026-11-25 · รีโป: `carmen-turborepo-backend` (micro-business + backend-gateway), `carmen-frontend`
แทนที่บางส่วนของ `2026-11-04-jv-workflow-by-type-design.md` (เฉพาะกติกาขอบเขตและ action ของผู้อนุมัติ)

## เจตนา

1. **กติกาเดียวกับ AP/AR** — JV เป็นเอกสารบัญชีตัวเดียวที่ยังใช้กติกาชุดเก่า (reject = กลับ draft,
   ไม่มี send back, ผู้สร้างอนุมัติเองได้, ได้เลขจริงตั้งแต่สร้าง) ผู้ใช้ต้องเจอกติกาชุดเดียวทั้งโมดูลบัญชี
2. **แก้ปัญหาที่เจอตอนใช้งาน** — workflow ที่ไม่ระบุ prefix ถูกตีความว่าครอบทุกใบ จึงชนกับ workflow อื่น
   ทุกตัวภายใต้กฎ "ห้ามขอบเขตทับกัน" ทำให้ BU เพิ่ม workflow ตัวที่สองไม่ได้อีก
3. **ยังต้องแยกผู้อนุมัติตามประเภทใบ** (prefix และที่มา) — user ยืนยัน 2026-11-25

## เป้าหมาย

1. ขอบเขต workflow `gl_jv` แบบ **ลำดับชั้น 4 ระดับ** — ระดับที่แคบกว่าชนะ, ห้ามทับกันเฉพาะในระดับเดียวกัน
   ตัวกลาง (ไม่ระบุอะไรเลย) มีได้ตัวเดียวต่อ BU และรับใบที่ไม่เข้าตัวอื่น
2. action ของผู้อนุมัติ 3 อย่าง บังคับฝั่ง server ด้วย stage role + `available_actions` ของ stage — เหมือน AP Invoice:
   - **Approve** — ไปขั้นถัดไป; ขั้นสุดท้าย post หรือ schedule ตาม `post_at` (พฤติกรรมเดิม)
     ผู้สร้างอนุมัติใบตัวเองไม่ได้ เว้นแต่ BU เปิดคีย์ `gl.jv.allow-creator-approve`
   - **Reject** — **void ทั้งใบ** จบสถานะ เปิดใหม่ไม่ได้ ต้องใส่เหตุผล
   - **Send back** — ผู้อนุมัติเลือกขั้นก่อนหน้า; ปลายทาง = ขั้นแรก → `draft` ผู้สร้างแก้แล้ว submit ใหม่;
     ปลายทาง = ขั้นอนุมัติ → ยัง `in_review` ที่ขั้นนั้น
3. **เลขร่าง `DRAFT-%08d`** — ใบ JV ที่สร้างเป็น draft ถือเลขร่าง ได้เลขจริงเมื่อออกจาก draft ครั้งแรก
4. หน้า JV detail ใช้ action bar / dialog ชุดเดียวกับ AP (อนุมัติ · ปฏิเสธพร้อมเหตุผลบังคับ · ส่งกลับเลือกขั้น)

## ไม่ทำ (non-goals)

- ใบจาก AP / AR / inventory / asset / interface ยัง **ไม่เข้า workflow** (เหตุผลเดิม: subledger posting
  คาดว่าใบ post แล้ว และเอกสารต้นทางมี workflow ของตัวเอง) — ชุด 6 ที่มาที่เข้า workflow ได้คงเดิม:
  `manual`, `recurring`, `allocation`, `amortize`, `reversal`, `closing`
- auto-reverse ตามเวลาที่ตั้งไว้ยังไม่ผ่าน workflow (คงเดิม)
- คิว "รออนุมัติของฉัน" / อนุมัติหลายใบพร้อมกัน
- ให้ผู้สร้างเลือก workflow เอง
- แก้ปัญหาแก้บรรทัดของใบ draft จาก template แล้วถูกทิ้งเงียบ ๆ (follow-up แยก)

## Anti-goals

- ใบหนึ่งเข้าได้กับ workflow มากกว่าหนึ่งตัว **ในระดับที่ชนะ** → ไม่มีใครเดาได้ว่าใบไปทางไหน
- มีทางใดที่ใบใน 6 ที่มาถึง `posted` โดยไม่ผ่าน workflow ทั้งที่มี workflow ที่ครอบใบนั้นอยู่
- BU ที่ไม่เคยตั้ง workflow JV เปลี่ยนพฤติกรรม (ยัง post ทันทีตอน submit — แต่เลขเปลี่ยนเป็นออกตอน submit)
- ใบที่ถูก reject ทิ้งร่องรอยค้าง (เช่นใบ reversal ที่ถูก reject ทำให้ใบต้นทางถูกมองว่า reverse แล้ว)
- เลขจริงในชุดเลข JV มีรูโหว่จากใบที่ถูกลบ

## สภาพปัจจุบัน (ตรวจ 2026-11-25)

Backend `apps/micro-business/src/`:
- `gl/gl-jv/workflow/gl-jv-workflow-scope.ts` — `JvScope { prefix_ids, sources }` เก็บใน
  `tb_workflow.data.jv_scope`; `scopeMatches()` = ตรงทั้งสองมิติ (ว่าง = ทุกค่า); `resolveJvWorkflowId()` และ
  ตัวตรวจทับกันอยู่ในไฟล์นี้และ `master/workflows/workflows.service.ts`
- `gl/gl-jv/gl-jv.service.ts` — `submit` (L542) resolve workflow → `in_review` หรือ post ทันที; `approve` (L646)
  ขั้นสุดท้าย post ใน `runAtomic`; `reject` (L727) **กลับเป็น draft** + เขียนเหตุผลทับ `note`;
  ตรวจสิทธิ์ผ่าน `refuseUnlessStageApprover` (L834) — ไม่มีกฎผู้สร้าง; `delete` (L498) ลบ draft ได้ทุกใบ;
  `unschedule` (L787) กลับ draft
- เลข JV: `gl/gl-jv/gl-jv.running-code.ts` `generateJvNo` — ชุดเลขแยกต่อ `prefix_code` และต่อเดือนของ `jv_date`,
  `jv_no` เก็บโดยไม่มี prefix · เรียกจาก `createInternal` (gl-jv.service L192 — manual + template run),
  `gl-posting.service.ts` L960 (`createReversalDraft`) และ L1290 (ใบปิดงวด สร้าง header เอง ไม่ผ่าน `createInternal`)
- `GlPostingService.voidJv` (gl-posting.service.ts ~L649) ทำงานกับใบ `posted` เท่านั้นและถอนยอดออกจาก `tb_gl_balance`
  — ใช้ void ใบที่ยังไม่ post ไม่ได้
- `tb_gl_jv_template_run` มี unique `(template_id, gl_period_id)`; `delete()` ลบ run row เพื่อให้ generate งวดนั้นใหม่ได้
- helper กลางของเอกสารบัญชี `common/workflow/accounting-doc-workflow.ts`: `assertCanActOnDocument`
  (stage + กฎผู้สร้าง), `computeAllowedActionsFor`, `planSendBack` (ตรวจขั้นก่อนหน้า + toDraft),
  `realDocNoPatch`, `withRejectReason`, `allowsCreatorApprove`; `common/helpers/draft-running-no.helper.ts`
  `nextDraftNo` / `isDraftNo`
- AP Invoice ออกเลขจริงตอนเข้า review (`withRealDocNo` ใน `ap-invoice.service.ts` ~L1280) — ใน transaction
  เดียวกับที่เปลี่ยนสถานะ หลังล็อกสำเร็จ
- `enum_jv_status` มี `void` อยู่แล้ว; มี trigger `gl_jv_posted_guard` ป้องกันการแก้ใบ posted/void

Frontend:
- ฟอร์มขอบเขต: `routes/system-admin/workflow/wf-jv-scope.tsx`, `wf-scope-line.tsx`, `wf-form-schema.ts`, `wf-detail.tsx`
- หน้า JV: `routes/accounting/documents/accounting-document-detail.tsx` + `jv-reject-dialog.tsx`
- UI send back ของ AP: `routes/accounting/accounts-payable/shared/ap-send-back-fields.tsx`, AR มี `ar-doc-actions.ts`
- `lib/draft-doc-no.ts` `isDraftDocNo`

## แนวทางที่พิจารณา

- **ก. ใช้ helper กลางของ AP/AR (เลือก)** — `gl-jv.service` เรียก helper ใน `accounting-doc-workflow.ts`,
  เขียน resolver/ตัวตรวจทับของขอบเขตใหม่เป็นแบบลำดับชั้น, FE ใช้ action bar ชุดเดียวกับ AP
  กติกาอยู่ที่เดียว แก้ครั้งเดียวมีผลทุกโมดูล
- **ข. เขียน reject-void / send back ใน JV เอง** — แตะไฟล์น้อยกว่า แต่กติกาสองชุดจะ drift ซึ่งคือต้นเหตุของงานนี้ — ตัดทิ้ง
- **ขอบเขต: prefix อย่างเดียว** (ที่มาใช้แค่ตัดสินว่าเข้า workflow) — เรียบง่ายกว่า แต่ user ต้องการแยกผู้อนุมัติ
  ตามที่มาภายใน prefix เดียวกันได้ — ตัดทิ้ง
- **ขอบเขต: workflow เดียวต่อ BU แบบ AP** — ตรงกับ AP ที่สุดแต่แยกผู้อนุมัติตามประเภทไม่ได้ — ตัดทิ้ง

## กติกาขอบเขต (ตกลงกับ user)

ขอบเขตยังเป็น `{ prefix_ids, sources }` เดิม (ว่าง = ทุกค่า) แต่จัด **ระดับ** ตามมิติที่ระบุ:

| ระดับ | prefix_ids | sources | ความหมาย |
|---|---|---|---|
| 1 | ระบุ | ระบุ | prefix นี้ + ที่มานี้ |
| 2 | ระบุ | ว่าง | prefix นี้ ทุกที่มา |
| 3 | ว่าง | ระบุ | ที่มานี้ ทุก prefix |
| 4 | ว่าง | ว่าง | ตัวกลาง |

- **resolve:** หา workflow `gl_jv` ที่ active และ `scopeMatches` ทั้งหมด แล้วเลือกตัวที่ระดับเลขน้อยที่สุด
  ไม่มีตัวใดตรง → post ทันที (เดิม) · source ไม่อยู่ใน 6 ที่มา → ไม่เข้า workflow เสมอ
- **ห้ามทับเฉพาะในระดับเดียวกัน** ระหว่าง workflow `gl_jv` ที่ active ใน BU เดียวกัน:
  - ระดับ 1: ทับเมื่อ prefix ตัดกัน **และ** source ตัดกัน
  - ระดับ 2: ทับเมื่อ prefix ตัดกัน
  - ระดับ 3: ทับเมื่อ source ตัดกัน
  - ระดับ 4: มีได้ตัวเดียว
  backend ปฏิเสธการบันทึก (create / update / เปิด active) ที่ทำให้ทับ พร้อมบอกชื่อ workflow ที่ชน (คง error เดิม)
- **ลำดับระดับ 2 เหนือ 3** — การตัดสินของผู้เขียน (prefix คือสิ่งที่ฝ่ายบัญชีใช้แยกประเภทใบ) ไม่ได้เก็บลง DB
  อยู่แค่ใน resolve จึงสลับภายหลังได้โดยไม่ต้อง migration (มีผลกับใบที่ submit หลังจากสลับเท่านั้น)
- ใบ reversal ยังจับขอบเขตด้วย **prefix ของใบต้นทาง** + source `reversal` (คงเดิม)
- ใบที่อยู่ `in_review` เดินต่อตาม `workflow_id` ที่ผูกไว้; ส่งกลับถึง draft แล้ว submit ใหม่ → resolve ใหม่ (คงเดิม)
- **ข้อมูลเดิม:** กติกาใหม่หลวมกว่าเดิม workflow ที่บันทึกผ่านกติกาเดิมได้จึงผ่านกติกาใหม่ทั้งหมด — ไม่ต้อง migration ขอบเขต

FE: ฟอร์มขอบเขตแสดงระดับที่ workflow นี้อยู่ (เช่น "ตัวกลาง — รับใบที่ไม่เข้า workflow อื่น") และคำอธิบายสั้นว่า
workflow ที่แคบกว่าชนะ — ถ้อยคำและตำแหน่งเป็นของ builder ตาม `docs/DESIGN.md`

## Action ของผู้อนุมัติ

ใช้ helper กลางทั้งหมด ด้วย `creatorApproveKey = 'gl.jv.allow-creator-approve'`:
- `approve` — `assertCanActOnDocument(…, 'approve')` แทน `refuseUnlessStageApprover`; ส่วน post/schedule คงเดิม
- `reject` — เหตุผลบังคับ (gateway + MB); `jv_status = void` พร้อม void_at/by/reason ตามคอลัมน์ที่ JV มี;
  เหตุผลแปะลงประวัติด้วย `withRejectReason` (**เลิกเขียนทับ `note`**)
- `send back` (endpoint ใหม่ เช่น `PATCH …/gl-jv/:id/review` ตามรูปแบบ AP) — `planSendBack`; toDraft → `draft`
- `computeAllowedActionsFor` คืน `allowed_actions` ใน `findOne` ให้ FE ซ่อน/แสดงปุ่ม
- คีย์ `gl.jv.allow-creator-approve` เพิ่มใน `/system-admin/default-setting` แบบเดียวกับคีย์ของ AP/AR (default ปิด)

**กรณีเฉพาะของ JV ที่ต้องดูแล:**
- **reject ใบ reversal** — ใบต้นทางต้องยังไม่ถูกมองว่า reverse แล้ว (`reversed_by_jv_id` เขียนเฉพาะใน postReversal
  อยู่แล้ว ต้องยืนยันว่าไม่มีธงอื่นค้าง) และ reverse ใหม่ได้
- **reject ใบจาก template (recurring/allocation/amortize)** — void ใบแล้ว **ลบ run row** ใน transaction เดียวกัน
  ให้ generate งวดนั้นใหม่ได้ เหมือน `delete()` วันนี้ (user ตัดสิน 2026-11-25) ใบที่ void ยังเก็บไว้เป็นประวัติ
  — ใช้กับ void ใบร่างที่มีเลขจริงจาก template ด้วย (เส้นทาง `voidUnposted` เดียวกัน)
- **unschedule** — กลับ `draft` (คงเดิม) เลขจริงที่ได้แล้วคงอยู่

## เลขร่าง `DRAFT-`

- ใบที่สร้างเป็น `draft` (manual, template run, closing, manual reversal draft) ได้ `nextDraftNo(tx, <JV draft key>)`
  ใบที่ระบบ post ทันที (subledger, auto-reverse) ได้เลขจริงตอนสร้างเหมือนเดิม
- **ออกเลขจริงเมื่อออกจาก draft ครั้งแรก** — ตอน submit (ทั้งทางเข้า `in_review` และทาง post ทันที) ใช้
  `realDocNoPatch` + `generateJvNo` (ต่อ prefix ต่อเดือนของ `jv_date` ณ ตอนนั้น) ใน transaction ที่เปลี่ยนสถานะ
  หลังล็อกสำเร็จ — แบบเดียวกับ `withRealDocNo` ของ AP
- ส่งกลับถึง draft / unschedule → **คงเลขจริง**; submit ซ้ำไม่ออกเลขใหม่ (`isDraftNo` เป็น false)
- **ลบ:** soft-delete ได้เฉพาะ draft ที่ยังถือ `DRAFT-`; draft ที่มีเลขจริงแล้วต้อง void (ไม่ให้ชุดเลขมีรู)
  — ต้องมีทาง void ใบ draft ที่มีเลขจริง (มี `jv-void-dialog.tsx` อยู่แล้ว builder ตรวจว่ารองรับ draft หรือไม่)
- `jv_no` เก็บโดยไม่มี prefix — **การแสดงผลของใบร่างต้องไม่ต่อ prefix หน้า `DRAFT-`** (เช่นไม่ให้เป็น `GJDRAFT-00000001`)
  ทั้งในตาราง, detail, export, print, activity log
- ใบ draft เดิมที่ถือเลขจริงอยู่แล้ว: คงเลขไว้ ไม่ migrate (การตัดสินของผู้เขียน — ไม่มีรูเพิ่ม และไม่กระทบใคร)
- ตรวจจุดที่ใช้ `jv_no` ตัดสินอะไร (ค้นหา, sort, unique index ต่อ prefix) ให้รองรับ `DRAFT-` — period-end
  `NUMBERED_DOC` ไม่ได้ใช้กับ JV (reviewer ตรวจแล้ว)
- **เส้นทางสร้างที่ได้ `DRAFT-`** (การตัดสินของผู้เขียน): manual และ template run (`createInternal`), ใบปิดงวด
  (gl-posting ~L1290), manual reversal draft (`createReversalDraft`) — builder ไล่ยืนยันว่าเส้นทาง subledger /
  auto-reverse ที่ post ทันทีไม่ผ่านจุดเหล่านี้
- **เลขจริงตาม `jv_date` ณ ตอน submit** — ถ้าแก้วันที่ระหว่างเป็นร่าง เลขตามเดือนใหม่ (เหมือน AP; การตัดสินของผู้เขียน)
- FE แสดง **ปุ่มลบ** เมื่อ `isDraftDocNo(jv_no)` และ **ปุ่ม void** เมื่อเป็น draft ที่มีเลขจริงแล้ว

## Void ที่ไม่มีผลต่อ ledger (การตัดสินของผู้เขียน)

สร้างเส้นทางเดียวใน `GlJvService` เช่น `voidUnposted(tx, header, reason)` สำหรับใบ `draft` / `in_review`:
ตั้ง `jv_status = void` + void_at/by/reason, ไม่แตะ `tb_gl_balance` · ใช้ร่วมกันโดย reject และ void draft ที่มีเลขจริง
· `voidJv` ของใบ posted คงเดิม · `findOne` คืน `allowed_actions` เสมอ (ว่างเมื่อไม่อยู่ใน review) และ `can_void`
ตามเส้นทางนี้ · ตรวจว่า trigger `gl_jv_posted_guard` ยอมให้เขียน void บนใบที่ไม่เคย post

## Deploy

ไม่มี migration ขอบเขต; เลขร่างอาจต้องเพิ่ม running-code key ของ JV draft (ตามที่ `nextDraftNo` ต้องการ)
ลำดับ: BE (MB + gateway พร้อมกัน, rebuild error-catalog ถ้ามี error ใหม่) → allowlist endpoint send back ใหม่ทุก env →
FE `vercel --prod` · BE ใหม่ + FE เก่า = reject ผ่าน dialog เดิมที่เหตุผลไม่บังคับ → 400 ควรขึ้นใกล้กัน

## ที่เหลือให้ builder

- ชื่อ endpoint / DTO ของ send back, ชื่อ running-code key, error code ใหม่ (ถ้าต้อง)
- ย้าย UI send back ของ AP ไป `routes/accounting/shared/` ถ้าใช้ร่วมกับหน้า JV (กฎ "hook อยู่ scope เล็กสุด")
- ถ้อยคำ i18n และการแสดงระดับในฟอร์มขอบเขต
