# General Ledger — Journal Voucher Design

## 1. เป้าหมาย

สร้าง Journal Voucher (JV) เป็น transaction แรกของ General Ledger บน Accounting Foundation โดยรองรับการบันทึกรายการแบบ double-entry, approval, posting, scheduled posting และ automatic reversal พร้อม reuse Currency, Exchange Rate, Department, Workflow, Running Code, Activity Log และ UI infrastructure ของ Carmen Blue

เอกสารนี้เป็น functional design ยังไม่ใช่ implementation plan หรือ API contract ฉบับสุดท้าย

> Implementation note (2026-09-11): JV frontend ปัจจุบันยังใช้ mock repository แม้ backend schema/contract จะมีงานเริ่มต้นแล้ว Types/hooks ถูกแยกด้วย repository boundary เพื่อสลับเป็น HTTP adapter ในอนาคต ให้ใช้ [General Ledger — Implementation Readiness](general-ledger-implementation-readiness.md) เป็น source of truth สำหรับ integration status, subledger-generated JV และ AP-to-GL contract

> Canonical UI baseline (2026-09-11): หน้า Journal Voucher ต้อง reuse detail shell และ interaction pattern ของหน้า Template Voucher เป็นหลัก ได้แก่ toolbar, document summary card, accounting-entry grid, line-detail actions, balance summary และ responsive behavior ห้ามสร้าง JV-specific page shell คู่ขนาน ส่วนที่เพิ่มเฉพาะ JV ให้จำกัดอยู่ที่ status/workflow, schedule/auto-reverse, source trace และ capability-based actions

## 2. Reference UI

อ้างอิงพฤติกรรมและ feature จาก [Carmen 5 GL — Journal Voucher](https://carmen5-gl-jv.netlify.app/) ตรวจเมื่อ 2026-08-10

สิ่งที่พบจากหน้าต้นแบบ:

- JV directory พร้อม search, filter, status, date, description และ amount
- Toolbar: New, Copy, Template, Void, AI Suggest, Attachments, Log, Save Draft, Submit
- Header: Prefix, generated JV No., JV Date, Description, Schedule Post, Auto-Reverse, Approval, Source และ Status
- Journal lines: Department, Account Code, Comment, Currency, Rate, Debit, Credit
- Line actions: All Dimensions สำหรับเลือกค่าจาก Dimension Master; Tax/WHT อยู่นอก scope ของ JV ตาม FRD V2.14 และไม่มี Check Budget ใน JV
- Tax/WHT detail มี vendor, tax ID/branch, invoice no., base amount และ tax amount
- Budget view แยก Year Budget, Actual Posted, Pending/Draft, Current Transaction และ Remaining
- Dimensions ใน prototype มี Market, Sales, Project, Event, Location, Channel และ Guest Type
- Summary แสดง transaction/base debit-credit, variance และ balanced state
- Attachments และ Activity Log
- เมนู GL อื่นที่ต้นแบบแสดง: Template Voucher, Recurring Voucher, Allocation Voucher, Dashboard และ Financial Reports

หน้าต้นแบบใช้เป็น feature reference ไม่ใช่ canonical accounting rule การ validation, permission, posting และ audit ต้องยึด Accounting Foundation

## 3. Phase 1 scope

### Must have

- JV directory: server-side pagination, search, sort และ filters
- Create, view, edit draft และ copy JV
- Journal/Adjustment prefixes และ running number
- Multi-line debit/credit editor
- Functional-currency balancing
- Currency และ exchange-rate snapshot ต่อ line
- Department และ extensible dimensions
- Save Draft และ Submit; Approve/Return/Reject มีเฉพาะเมื่อ BU/journal type เปิด Workflow
- Schedule Post
- Auto-Reverse
- Void ก่อน post และ reversal หลัง post
- Source-document link
- Activity Log
- Optimistic concurrency ด้วย `doc_version`
- Thai/English และ BU date/number formats

### Phase 1 optional เมื่อ shared service พร้อม

- Attachments
- Tax/WHT detail
- Budget check แบบ read-only
- Apply template

### Deferred

- AI Suggest
- Template Voucher management
- Recurring Voucher
- Allocation Voucher
- Dashboard และ Financial Reports
- Excel import/bulk journal

## 4. Information architecture

### Routes ที่เสนอ

```text
/accounting
/accounting/journal-voucher
/accounting/journal-voucher/new
/accounting/journal-voucher/:id
/accounting/journal-voucher/:id?mode=edit
```

ใช้ route ภายใต้ `/accounting` ตาม router ปัจจุบันเป็น canonical frontend route ส่วน backend resource path ใช้ `/api/:bu_code/accounting/journal-vouchers`

Route ต้องอยู่ใต้ `ProtectedShell` และมี section-level `RouteErrorBoundaryAdapter` ตาม convention ของ repository

### Directory

Columns ขั้นต่ำ:

| Column                   | Sort | Filter            |
| ------------------------ | ---- | ----------------- |
| JV No.                   | yes  | prefix/range      |
| JV Date                  | yes  | date range/period |
| Description              | yes  | search            |
| Source                   | yes  | source type/no.   |
| Status                   | yes  | multi-select      |
| Total Debit (functional) | yes  | amount range      |
| Prepared By              | yes  | user              |
| Updated                  | yes  | date/user         |

Saved views/filter sheet ควร reuse framework ของ list pages เมื่อพร้อม

## 5. JV header

| Field               | Rule                                                                       |
| ------------------- | -------------------------------------------------------------------------- |
| Journal Type/Prefix | required; Phase 1 อย่างน้อย `JV` และ `AD`; config จาก running-code service |
| JV No.              | backend-generated, read-only, unique ต่อ BU/prefix/sequence policy         |
| JV Date             | required; กำหนด accounting period                                          |
| Description         | required; รองรับไทย/อังกฤษ                                                 |
| Source              | optional สำหรับ manual JV; required สำหรับ system/subledger-generated JV   |
| Schedule Post       | optional; เปิดแล้วต้องมี scheduled timestamp                               |
| Auto-Reverse        | optional; เปิดแล้วต้องมี reverse date                                      |
| Workflow/Approval   | optional; resolve toggle และ workflow ตาม BU+journal type                  |
| Status              | read-only derived state                                                    |

สำหรับ system/subledger-generated JV ต้องเก็บ `source_system`, `source_type`, `source_id`, `source_no`, `source_version`, `event_type`, `posting_rule_code`, `generated_revision` และ `posting_event_id` เพื่อ trace กลับ source และป้องกัน duplicate/revision drift

Schedule Post และ Auto-Reverse เป็นอิสระต่อกัน แต่เมื่อเปิดทั้งคู่ต้องผ่าน cross-field validation ตาม Accounting Foundation

ทั้งสองค่าเป็น JV-level controls เท่านั้น ไม่รองรับ Batch default หรือ bulk update ผู้ใช้ต้องเปิดและกำหนดค่าภายใน JV ทีละใบ

### Manual vs source-generated JV

| Behavior                     | Manual JV                    | Subledger-generated JV                                                            |
| ---------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| Edit accounting header/lines | Draft และมี permission       | ห้ามแก้ใน GL ทุกสถานะ                                                             |
| Workflow                     | GL Optional Workflow         | Source module เป็นเจ้าของ business approval; ห้ามสร้าง GL approval ซ้ำโดย default |
| Submit/Post                  | ผ่าน GL commands             | Posting Engine ทำตาม source event และ policy                |
| Copy                         | สร้าง Manual JV draft ได้    | ห้าม copy; ให้ copy/correct ที่ source                                            |
| Reverse/Correct              | GL สร้าง linked reversal ได้ | เริ่มจาก source owner แล้วส่ง reversal/correction event                           |
| Schedule/Auto-Reverse        | ตั้งใน Manual JV ทีละใบ      | ไม่รับค่าจาก subledger event โดย default                                          |

Generated JV ต้องแสดง source trace และ action `Open source`; capability ทุก action มาจาก backend

### UI composition policy

- `Template Voucher Detail` เป็น visual และ interaction reference ของ `Journal Voucher Detail`
- ใช้ toolbar ลำดับเดียวกัน: Back/New/Copy/Template/Void/AI Suggest และ Attachments/Log/Edit ตาม capability
- ใช้ document summary card เดียวกัน โดย JV เพิ่ม Schedule Post, Auto-Reverse, Workflow, Source และ Status ใน metadata row
- ใช้ accounting-entry grid, line detail, row selection/reorder และ balance summary component/pattern เดียวกัน
- Source-generated JV ซ่อน Copy/Template/Void/AI Suggest/Edit ตาม capability และเพิ่ม `Open source` กับ compact `Source-generated · Read-only` trace ใน summary card
- Loading/error/not-found ต้องเกิดก่อน render placeholder document เพื่อไม่ให้ข้อมูลตัวอย่างกระพริบระหว่างโหลด

## 6. Journal-line editor

### Columns

- Selection และ line number
- Department
- Account
- Comment
- Transaction currency
- Exchange rate
- Debit
- Credit
- Actions

### Behavior

- Add/delete/reorder lines; keyboard shortcut `Alt+A` สามารถนำจาก prototype มาใช้
- Account lookup แสดง code+name และเลือกได้เฉพาะ posting account ที่ active
- Department reuse `LookupDepartment`
- Currency reuse `LookupCurrency`; default เป็น functional currency ของ BU
- เมื่อ currency เป็น functional currency rate ต้องเป็น 1 และแก้ไม่ได้
- เมื่อเป็น foreign currency ระบบ resolve rate ตาม JV date แต่ผู้มี permission อาจ override พร้อมเหตุผล
- Debit/Credit mutually exclusive ต่อ line
- Summary recalculates ทันทีทั้ง transaction และ functional currency
- Submit/Post disabled เมื่อ base debit-credit ไม่สมดุล
- Line ที่ account กำหนด required dimensions ต้องกรอกครบ

## 7. Tax/WHT detail

เมื่อเปิดใช้ optional capability ต่อ line ต้องรองรับ:

- Tax mode: Input Tax, Output Tax หรือ WHT ตาม account/rule
- Vendor/customer reference เมื่อเกี่ยวข้อง
- Tax ID และ branch
- Invoice/document number และ date
- Tax base และ tax amount
- Tax profile และ rate
- GL account mapping

ระบบต้องแยก “ข้อมูลประกอบภาษี” ออกจาก debit/credit lines แต่ post ใน transaction เดียวกัน ห้ามให้ UI คำนวณเป็น source of truth เพียงฝั่งเดียว

## 8. Budget check

Budget check เป็น informational/control policy ต่อ line โดยส่งอย่างน้อย:

```text
bu_id, fiscal_period, account_id, department_id,
dimensions[], current_transaction_amount
```

ผลลัพธ์ควรแยก:

- Approved budget/YTD budget
- Actual posted
- Pending/submitted/draft commitment ตาม policy
- Current JV
- Remaining/over budget

BU กำหนดได้ว่าจะ warning, require acknowledgement หรือ block submit/post

## 9. Schedule Post behavior

1. ผู้ใช้เปิด Schedule Post และเลือกวันที่/เวลาใน timezone ของ BU
2. Save Draft เก็บ schedule ได้ แต่ยังไม่สร้าง ledger
3. ถ้า Workflow ปิด Submit แล้วเข้าสถานะ `scheduled` โดยตรง; ถ้าเปิดให้ Submit เข้าสู่ workflow
4. เมื่อ final approval สำเร็จ เอกสารที่เปิด Workflow จึงเข้าสถานะ `scheduled`
5. เมื่อถึงเวลา backend scheduler เรียก posting engine ด้วย idempotency key
6. หาก final approval สำเร็จหลังเวลา ระบบ post ทันทีหรือส่ง exception ตาม BU policy; Phase 1 แนะนำ post ทันทีพร้อม activity log
7. หาก validation/period lock ไม่ผ่าน เป็น `post_failed` และไม่สร้าง ledger บางส่วน
8. ผู้มี permission reschedule/retry ได้ โดยทุกครั้งต้องมี audit event

`scheduled_post_at` ไม่เปลี่ยน JV Date และไม่ย้าย accounting period

## 10. Auto-Reverse behavior

1. ผู้ใช้เปิด Auto-Reverse และเลือก `reverse_date`
2. Original JV ต้อง post สำเร็จก่อนจึงสร้าง reversal instruction
3. เมื่อถึง reverse date scheduler สร้าง JV ใหม่ที่ link กับ original
4. คัดลอก lines และ dimensions แล้วสลับ Debit/Credit
5. ใช้ currency/rate/base-amount snapshot เดิม
6. เลข reversal JV ออกโดย running-code service
7. Description ระบุ original JV number และ reversal reason
8. ถ้า reverse period ปิด ให้แจ้ง exception ไม่เลื่อนวันเอง
9. ถ้ามี manual reversal แล้ว ให้ instruction เดิมเป็น cancelled และไม่สร้างซ้ำ
10. Original และ reversal ต้องเปิดดูข้ามกันได้จาก UI

Auto-Reverse ใช้ Workflow toggle ของ reversal journal type:

- Workflow ปิด: generated reversal Submit แล้ว post/schedule ได้ตามปกติ
- Workflow เปิด: generated reversal สร้าง workflow instance และรอ final approval

## 11. Actions and status permissions

| Action                | Allowed states                           | Notes                                                                                 |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| Edit                  | draft                                    | ต้องผ่าน ownership/permission และ `doc_version`                                       |
| Copy                  | ทุกสถานะที่ดูได้                         | สร้าง draft ใหม่ ไม่ copy JV no./approval/posting IDs                                 |
| Save Draft            | draft                                    | validate shape แต่ยังไม่บังคับ balanced ครบทุกกรณี                                    |
| Submit                | draft                                    | ต้อง balanced; Workflow ปิด = post/schedule, Workflow เปิด = submitted                |
| Approve/Return/Reject | submitted                                | มีเฉพาะเมื่อ Workflow เปิด; Return/Reject ส่ง JV กลับ draft                           |
| Post/Retry Post       | posting, post_failed                     | ปกติ backend เรียกอัตโนมัติหลัง Submit/final approval; manual retry ต้องมี permission |
| Reschedule            | draft, submitted, scheduled              | ห้ามหลัง post                                                                         |
| Void                  | draft, submitted, scheduled, post_failed | เก็บ reason; ห้ามลบ audit                                                             |
| Reverse               | posted                                   | สร้าง linked reversal JV                                                              |
| Delete                | ไม่เปิดให้ผู้ใช้ทั่วไป                   | draft ใช้ void/cancel เพื่อรักษา audit                                                |

## 12. Proposed API surface

ชื่อ endpoint เป็นข้อเสนอ ต้อง align กับ backend conventions ก่อน implementation

API ด้านล่างเป็นข้อเสนอเดิม ต้องเทียบกับ OpenAPI ปัจจุบันก่อนใช้:

```text
GET    /api/:bu_code/accounting/journal-vouchers
POST   /api/:bu_code/accounting/journal-vouchers
GET    /api/:bu_code/accounting/journal-vouchers/:id
PATCH  /api/:bu_code/accounting/journal-vouchers/:id
POST   /api/:bu_code/accounting/journal-vouchers/:id/submit
POST   /api/:bu_code/accounting/journal-vouchers/:id/approve      # Manual JV + Workflow only
POST   /api/:bu_code/accounting/journal-vouchers/:id/return       # Manual JV + Workflow only
POST   /api/:bu_code/accounting/journal-vouchers/:id/reject       # Manual JV + Workflow only
POST   /api/:bu_code/accounting/journal-vouchers/:id/retry-post
POST   /api/:bu_code/accounting/journal-vouchers/:id/reschedule
POST   /api/:bu_code/accounting/journal-vouchers/:id/void
POST   /api/:bu_code/accounting/journal-vouchers/:id/reverse      # Manual JV only
GET    /api/:bu_code/accounting/journal-vouchers/:id/activity
GET    /api/:bu_code/accounting/accounts/lookup
POST   /api/:bu_code/accounting/exchange-rates/resolve
POST   /api/:bu_code/accounting/budget/check
```



Action endpoints ต้องรับ `doc_version` และ idempotency key ตามความเหมาะสม

## 13. Error cases

- 400 — unbalanced, missing dimension, invalid rate/date, debit+credit same line
- 403 — ไม่มีสิทธิ์หรือผิด workflow stage
- 409 — `doc_version` conflict, duplicate posting, period changed/locked, reversal already exists
- 422 — account inactive/non-posting, currency/rate unavailable, tax rule incomplete
- 429 — ใช้ behavior เดิมของ `httpClient`

Frontend ต้องแสดง field errors ที่ line/header และแสดง business-rule error แบบไม่ทิ้ง draft ของผู้ใช้

## 14. Acceptance criteria

- สร้าง draft JV อย่างน้อย 2 lines และ reload แล้วยังอยู่
- เลือก Currency/Department จาก master เดิมได้
- Foreign-currency line แสดง transaction และ functional amount พร้อม rate snapshot
- Submit ไม่ได้เมื่อ functional debit/credit ไม่เท่ากัน
- เมื่อ Workflow ปิด Submit แล้ว post/schedule โดยไม่สร้าง Approved/Rejected status
- เมื่อ Workflow เปิดใช้ workflow/permission จริงและ final approval จึง trigger post/schedule
- Post สร้าง ledger เพียงครั้งเดียวแม้ request retry
- Posted JV แก้ header/lines ไม่ได้
- Schedule Post ไม่ post ก่อน approval/เวลา และ retry ไม่สร้าง ledger ซ้ำ
- Auto-Reverse สร้าง linked JV เพียงใบเดียว สลับ debit/credit และหักล้าง functional amount ครบ
- Period ปิดทำให้ posting/reversal เป็น exception โดยไม่ย้ายวันที่เอง
- Copy ไม่คัดลอก identity/posting state ของต้นฉบับ
- Activity log แสดง create/update/submit/approve/reject/schedule/post/reverse/void
- UI ทำงานทั้งภาษาไทย/อังกฤษและใช้ date/amount format ของ BU

## 15. Open questions

1. Prefix `JV` และ `AD` ต่างกันด้าน workflow/posting rules หรือเป็นเพียงเลขเอกสาร
2. Scheduled timestamp ต้องละเอียดถึงเวลา หรือใช้เฉพาะวันที่และให้ scheduler post เวลาใด
3. เมื่อ approval เสร็จหลัง scheduled time จะ post ทันทีหรือให้ผู้ใช้ยืนยันใหม่
4. Auto-generated reversal ต้องผ่าน approval หรือ auto-post เป็น default
5. Tax/WHT และ Budget Check อยู่ใน Phase 1 release แรกหรือ feature flag
6. Dimension definitions มาจาก service/table ใด และ dimension ใดมีอยู่จริงใน Carmen Blue backend
7. Manual exchange-rate override ใช้ permission และ approval แบบใด
8. **Decided:** JV ที่มาจาก AP/AR/Inventory/Asset เป็น immutable projection และดูอย่างเดียวใน GL การแก้/Reverse/Correct เริ่มจาก source owner แล้วส่ง source version/event ใหม่ผ่าน posting contract
