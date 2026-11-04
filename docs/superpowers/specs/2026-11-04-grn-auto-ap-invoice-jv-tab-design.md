# GRN สร้าง AP Invoice อัตโนมัติ + แท็บ Journal Voucher — design

วันที่: 2026-11-04 · รีโป: `carmen-turborepo-backend` (micro-business + gateway) และ `carmen-frontend`
(โปรเจกต์ที่ 1 จาก 2 — โปรเจกต์ที่ 2 "ต่อหน้า AP invoice/payment เข้า backend จริง" แยกคุยภายหลัง)

## เจตนา

ฝ่ายบัญชีไม่อยากสร้าง AP invoice เอง เมื่อรับของ (GRN) ที่เป็นเจ้าหนี้แล้ว ระบบต้องตั้งหนี้และลงบัญชี
ให้เองทันที ฝ่ายบัญชีเหลืองานเดียวคือ **ทำจ่าย (AP payment)** AP invoice จึงแยกเป็นสองแบบ:

- **manual** — คนสร้างเองในหน้า AP invoice แก้/void ได้ตามปกติ
- **auto from GRN** — ระบบสร้างจาก GRN **แก้หรือ void จากฝั่ง AP ไม่ได้** ความจริงของใบนี้อยู่ที่ GRN

หน้า GRN ต้องมีแท็บ **"Journal Voucher"** ให้เห็น JV (prefix AP) ที่เกิดจากใบนั้น

## สิ่งที่มีอยู่แล้ว (ตรวจ 2026-11-04)

ทุก path ฝั่ง backend อ้างจาก `apps/micro-business/src` เว้นแต่ระบุ

- GRN commit/approve → `GoodReceivedNoteLogic.commit` / approve (`inventory/good-received-note/good-received-note.logic.ts:170`, ~300)
  เรียก `postReceipt` (~268-290) ซึ่งลงแค่ stock (`createInventoryTransactions`) + ยอดรับของ PO
  **ไม่แตะ AP/GL เลย** · มีเคส `alreadyPosted` / `held` (held until brought forward) ที่ข้ามการลง stock
- `tb_good_received_note.post_type` = `ap | consignment | cash` (schema:149)
- `tb_ap_invoice.doc_source` = `enum_ap_invoice_source` `manual | grn | copy | excel | ai | interface` (schema:315) — ใช้แยก manual/auto ได้เลย **ไม่ต้องเพิ่มคอลัมน์**
- ลิงก์บรรทัด: `tb_ap_invoice_detail_source` (schema:7423) — `good_received_note_id`, `good_received_note_detail_item_id`, `matched_qty`, ...
- `ApInvoiceService.createFromGrn` (`ap/ap-invoice/ap-invoice.service.ts:423`) สร้าง **draft** `doc_source = grn` จาก `grn_item_ids`
  (บัญชี Dr จาก product account mapping → item group) แต่เรียก `createDraft` ซึ่งเปิด transaction ของตัวเอง
- `ApInvoicePosting.postInTx` (`ap/ap-invoice/ap-invoice.posting.ts:278`) post ภายใน tx ที่ส่งเข้ามา → `GlSubledgerPostingService.postFromSource`
  (`source = ap`, `source_ref_type = 'ap_invoice'`) แล้วเขียน `gl_jv_id/gl_jv_no` กลับลง invoice
  · prefix ของ JV: `input.prefix_id` → GL setting `ap_jv_prefix_id` → `auto_jv_prefix_id` (`gl/gl-subledger-posting/gl-subledger-posting.service.ts:29-35,131`)
  · seed ไม่มี prefix "AP" — ต้องตั้งใน GL setting
- `ApInvoicePosting.voidPostedInTx` (posting.ts:339) — ตรวจ `AP_INVOICE_HAS_PAYMENT`, `AP_INVOICE_IS_REFERENCED`, `GL_PERIOD_NOT_OPEN` แล้วสร้าง JV กลับรายการ (`void_gl_jv_id`) และปลดลิงก์ GRN
- `ApInvoicePosting.checkGrnSources` (~153) — ต้องเป็น GRN ที่ยัง live, committed, `post_type = ap`
- GRN update guard `checkGrnUpdateAllowed` (`inventory/good-received-note/good-received-note.ap-link.ts`)
  - saved: แก้ได้ทุกช่อง ยกเว้น vendor / grn_date
  - **committed: แก้ได้แค่หัวใบ** (`HEADER_EDITABLE_KEYS`: post_type, credit_term_*, invoice_no, invoice_date, payment_due_date, description, note) — บรรทัด/ราคา/จำนวนแก้ไม่ได้อยู่แล้ว
  - committed + มี AP invoice ที่ยังไม่ void → `GRN_AP_LINKED_NOT_EDITABLE` (ล็อกทั้งใบ)
  - GET GRN detail คืน `ap_invoices: { id, doc_no, doc_status }[]` (`good-received-note.service.ts:359`)
- ยังไม่มีโค้ดใดทำให้ GRN ไปถึง `voided`
- AP payment post JV ของตัวเอง (`ap/ap-payment/ap-payment.posting.ts:226`) — ไม่เกี่ยวกับงานนี้
- FE: แท็บของ GRN อยู่ที่ `routes/procurement/goods-receive-note/grn-form.tsx:261` (Items / Extra cost / Stock)
  · GL JV API ต่อไว้แล้ว: `API_ENDPOINTS.GL_JV_DETAIL` + `journal-voucher-http-repository.ts:298 get()`
  · หน้า AP invoice/payment ใน FE **ยังเป็น mock** (`routes/accounting/accounts-payable/shared/ap-mock-repository.ts`) — ไม่อยู่ในโปรเจกต์นี้

## เป้าหมาย

1. GRN `post_type = ap` commit (หรือ approve) แล้ว ระบบสร้าง AP invoice (`doc_source = grn`) **และ post ทันที** ใน transaction เดียวกับการลง stock → เกิด JV prefix AP พร้อมกัน
2. ปุ่ม **"Create AP Invoice"** บน GRN committed ที่ยังไม่มี AP invoice live (ใบเก่าก่อนฟีเจอร์นี้ / ใบที่เพิ่งเปลี่ยน post type เป็น ap) — ทำแบบเดียวกับข้อ 1
3. แก้หัวใบ GRN committed ที่มี AP auto **และยังไม่มี payment** ได้ ระบบ void ใบเดิม (JV กลับรายการ) + สร้างใบใหม่ + post ให้เอง
4. AP invoice `doc_source = grn` แก้/void/ลบ ผ่าน API ของ AP ไม่ได้ (backend เป็นด่าน)
5. แท็บ "Journal Voucher" ในหน้า GRN แสดง JV ของ AP invoice ที่ผูกกับใบ

## Non-goals

- ต่อหน้า AP invoice / AP payment ใน FE เข้า backend จริง, ป้าย "From GRN", หน้า detail อ่านอย่างเดียว → โปรเจกต์ 2
- void GRN ทั้งใบ (ระบบยังไม่มีอยู่แล้ว)
- แก้ราคา/จำนวนของ GRN หลัง commit — วันนี้ทำไม่ได้อยู่แล้ว ทางแก้คือ credit/debit note manual ที่ AP
- สร้าง JV ฝั่ง inventory (`source = inventory`) จาก GRN — JV เดียวที่เกิดคือ JV ของ AP invoice
- GRN `consignment` / `cash` — ไม่สร้าง AP invoice (เหมือนเดิม)

## Anti-goals (ถ้าเกิดแบบนี้ถือว่าล้ม แม้จะทำงานได้)

- stock เข้าแล้วแต่หนี้ไม่ขึ้น (หรือกลับกัน) — ต้อง all-or-nothing
- แก้ตัวเลขทับบน AP invoice / JV ที่ post แล้ว — ต้อง void + สร้างใหม่ ให้เห็นร่องรอยกลับรายการ
- AP invoice ใบเดียวกันถูกสร้างซ้ำจาก GRN เดียว (กดปุ่มซ้ำ / retry commit)
- ผู้ใช้แก้ AP invoice auto ได้ผ่านทางใดทางหนึ่ง

## พฤติกรรมที่ตกลงกัน

### 0. สวิตช์ต่อ BU (user ตัดสิน)

ฟีเจอร์ทั้งหมด (ข้อ 1–4) ทำงานเฉพาะ BU ที่เปิดสวิตช์ **"สร้าง AP invoice อัตโนมัติจาก GRN"** ใน GL/AP setting
(คีย์ใหม่ เช่น `ap_auto_from_grn` — ชื่อจริงผู้สร้างเลือก) **ค่าเริ่มต้นปิด**

- ปิด: GRN ทำงานเหมือนเดิมทุกอย่าง (ไม่สร้าง AP, ไม่มีปุ่ม, ไม่ void/สร้างใหม่ตอนแก้หัวใบ) — deploy แล้วไม่มี BU ไหนติด
- เปิด: ทำตามเอกสารนี้ ตั้งค่าบัญชีไม่ครบ → commit ไม่ผ่าน
- ตอนกดเปิด backend ตรวจก่อนว่า `ap_jv_prefix_id` และบัญชีคุมเจ้าหนี้ถูกตั้งแล้ว ไม่ครบ → ปฏิเสธการเปิดพร้อมบอกสิ่งที่ขาด
- ปิดสวิตช์ทีหลัง: ใบ auto ที่เกิดไปแล้วยังล็อกอยู่ (ล็อกผูกกับ `doc_source = grn` ไม่ใช่สวิตช์); แก้หัว GRN ที่มีใบ auto ขณะสวิตช์ปิด → ล็อกแบบเดิม (`GRN_AP_LINKED_NOT_EDITABLE`) (*การตัดสินใจของผู้ออกแบบ*)
- FE: สวิตช์อยู่ในหน้า GL/AP setting ที่มีอยู่; แท็บ Journal Voucher แสดงเสมอ แต่ปุ่ม "Create AP Invoice" ขึ้นเฉพาะเมื่อสวิตช์เปิด (ส่งสถานะสวิตช์มากับ GET GRN detail หรืออ่านจาก setting — ผู้สร้างเลือก)

### 1. ตอน commit / approve

เงื่อนไข: สวิตช์เปิด + `post_type = ap`

**ยอดต้องตรง (การตัดสินใจของผู้ออกแบบ):** ยอดรวม AP invoice (รวมส่วนลด ภาษี และ rounding) ต้องเท่ายอดสุทธิของ GRN —
ถ้า `grnLines` ยังไม่ครอบส่วนลด/ภาษีระดับหัวใบ ต้องเพิ่ม และมีด่านเทียบยอดก่อน post ไม่ตรง → commit ไม่ผ่าน

**ใบ `held` / `alreadyPosted` (การตัดสินใจของผู้ออกแบบ):** ใบ held ยังสร้าง AP ตาม `grn_date` (งวด GL ไม่เปิด → commit ไม่ผ่าน);
commit ซ้ำ/`alreadyPosted` ที่มีใบ AP live อยู่แล้ว → ข้ามเงียบ ไม่ error

ใน transaction เดียวกับ `postReceipt`:
1. ลง stock (เดิม)
2. สร้าง AP invoice จาก **ทุก** `grn_item_id` ของใบ ผ่าน logic เดียวกับ `createFromGrn` — header ใช้ `invoice_no`, `invoice_date`, `credit_term_days`, `payment_due_date`, currency/rate, vendor จาก GRN; `doc_date` = `grn_date` (*การตัดสินใจของผู้ออกแบบ* — ให้ JV อยู่งวดเดียวกับ stock)
3. post ทันทีด้วย `postInTx` (**ข้าม workflow ของ AP invoice** — user เลือก "post ทันที")

ขั้นไหนพัง → commit ล้มทั้งใบ แจ้ง error จาก catalog ที่บอกสาเหตุชัด เช่น บัญชีสินค้ายังไม่ map, ไม่มี AP prefix/AP control account, งวดบัญชีปิด

### 2. ปุ่ม "Create AP Invoice"

แสดงเมื่อ GRN `committed` + `post_type = ap` + ไม่มี AP invoice live ผูกอยู่ · ทำข้อ 1 ขั้นที่ 2–3 ใน transaction เดียว
endpoint ใหม่ฝั่ง GRN (เช่น `POST /api/:bu/good-received-note/:id/ap-invoice`) idempotent: ถ้ามี AP invoice live อยู่แล้ว ตอบ error/คืนใบเดิม ไม่สร้างซ้ำ
สิทธิ์: เท่ากับสิทธิ์ commit GRN (*การตัดสินใจของผู้ออกแบบ*)
ใบเก่าที่มี AP invoice **manual** ผูกไว้บางบรรทัด → ปุ่มยังขึ้นถ้ายังมีบรรทัดค้าง และสร้างเฉพาะส่วนที่เหลือ (`remaining = received − matched` ตาม `grnLines`) (*การตัดสินใจของผู้ออกแบบ*)
ไม่มี fallback ฝั่ง FE กรณี api_name ยังไม่ allowlist — พึ่งลำดับ deploy

### 3. แก้ GRN committed ที่มี AP auto

| สถานการณ์ | ผล |
|---|---|
| มี AP payment (ไม่ void, **นับ draft ด้วย**) อ้าง invoice | ล็อกทั้งใบ — `GRN_AP_LINKED_NOT_EDITABLE` ข้อความบอกให้ออก CN/DN ที่ AP |
| แก้แค่ `description` / `note` | บันทึก GRN เฉย ๆ ไม่แตะ AP |
| แก้ invoice_no / invoice_date / credit term / due date | void ใบเดิม (`voidPostedInTx`, JV กลับรายการ) → สร้างใบใหม่ → post ใน tx เดียวกับ update |
| เปลี่ยน `post_type` ap → cash/consignment | void ใบเดิม ไม่สร้างใหม่ |
| เปลี่ยน `post_type` อื่น → ap | สร้างใบใหม่ + post |
| AP invoice ที่ผูกเป็น **manual** (ใบที่คนสร้างจาก GRN ก่อนฟีเจอร์นี้) | ล็อกเหมือนเดิม — ไม่ void ใบที่คนสร้างให้อัตโนมัติ |

void ใบเดิมไม่ผ่าน (เช่น `AP_INVOICE_IS_REFERENCED`, งวดปิด) → update ล้มทั้งก้อน

### 4. ล็อก AP invoice auto ฝั่ง AP

`update`, `void`, `delete`, `submit`, `approve`, `review`, `reject` ของ AP invoice ที่ `doc_source = grn` → error ใหม่ใน catalog (เช่น `AP_INVOICE_FROM_GRN_LOCKED`) **เว้นแต่**ถูกเรียกจาก flow ของ GRN ภายใน (เรียก service ตรงใน tx ไม่ผ่าน RPC handler)
ด่านอยู่ที่ RPC handler/controller ของ AP; service เรียกตรงได้จาก flow ของ GRN (*การตัดสินใจของผู้ออกแบบ*) —
ผู้สร้างต้องไล่ caller อื่นของ AP invoice service (import excel/ai/interface, bulk delete ของ document trace) ว่าต้องเคารพล็อกด้วย
void แล้วสร้างใหม่ ใบใหม่ได้ `doc_no` ใหม่ ไม่ reuse
ปิดทาง `POST ap-invoice/from-grn` จาก gateway (ไม่ให้คนสร้างใบจาก GRN ด้วยมือในฝั่ง AP อีก) — `grn-candidates` ปิดตามได้
การจ่าย (AP payment) อ้างใบ auto ได้ตามปกติ

### 5. แท็บ "Journal Voucher" ในหน้า GRN (FE)

- ต่อจาก Stock ใน `grn-form.tsx`
- backend เพิ่ม `doc_source`, `gl_jv_id`, `gl_jv_no`, `void_gl_jv_id` ใน `ap_invoices[]` ของ GET GRN detail (อย่าลืม serializer ทั้ง micro และ gateway)
- FE ดึง JV ด้วย `GL_JV_DETAIL` ของแต่ละ id — แสดงหัว JV (เลข, วันที่, สถานะ, AP invoice ต้นทาง) + ตารางบรรทัด Dr/Cr อ่านอย่างเดียว ลิงก์ไปหน้า JV
- JV ที่ใช้อยู่ไว้บน; JV ของใบที่ void แล้ว และ JV กลับรายการ อยู่ล่างพร้อมป้าย "Reversed"
- ยังไม่ commit → empty state "JV จะถูกสร้างเมื่อ commit"
- committed + ap + ยังไม่มี invoice → empty state + ปุ่ม "Create AP Invoice"
- post_type ไม่ใช่ ap → ข้อความว่าใบนี้ไม่ตั้งหนี้
- ข้อความผ่าน i18n (en/th) ตามแบบเดิมของโมดูล; ดูได้ทั้ง light/dark

## ข้อจำกัด / การ deploy

- ลำดับ: backend (+error-catalog) → (BU ที่จะใช้) ตั้ง GL setting `ap_jv_prefix_id` เป็น prefix "AP" ต่อ BU (สร้าง prefix ถ้ายังไม่มี) → allowlist api_name ของ endpoint ใหม่ → FE → เปิดสวิตช์ทีละ BU
- ห้ามโยน error ใน logic layer (throw = 503) ต้อง return `Result`; ใน tx ใช้ `abortWith` ตามแบบของ posting
- `postInTx` ต้องการ header ที่ถูกล็อกแล้วใน tx — การสร้างต้องทำใน tx เดียวกัน จึงต้องแยก `createDraft` ให้รับ `tx` ได้
- หน้า AP ใน FE ยังเป็น mock — ใบ auto จะไม่โผล่ในหน้า AP ของ FE จนกว่าโปรเจกต์ 2 เสร็จ (ยอมรับได้)

## ปล่อยให้ผู้สร้างตัดสิน

- จะ hook ที่ `postReceipt` หรือที่ commit/approve แยกกัน และพฤติกรรมเมื่อ `alreadyPosted`/`held` (แนะนำ: สร้าง AP ทุกครั้งที่ใบกลายเป็น committed แม้ stock ถูก hold — หนี้เกิดเมื่อรับของ)
- รูปของ error catalog ใหม่ และ i18n key
- extra cost ของ GRN ต้องเข้า AP invoice ด้วยหรือไม่ — ตรวจว่า `grnLines` รวมอยู่แล้วหรือไม่ แล้วรายงาน
- โครง component ของแท็บ (ใช้ primitive จาก `components/ui/` และ design system)
