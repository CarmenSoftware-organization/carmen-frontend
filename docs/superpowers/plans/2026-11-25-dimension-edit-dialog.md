# Dimension Edit Dialog Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/config/dimension` เหลือ dialog แก้ไขตัวเดียว (โครงข้างกัน) ที่แก้ค่าย่อยในตาราง กด Save ครั้งเดียว เห็นสถานะ/ข้อผิดพลาดรายแถว และวันที่ของ dimension ใช้รูปแบบจากโปรไฟล์แทน `date_format`

**Architecture:** แยก `DimensionDialog` + logic บันทึกออกจาก `dimension-page.tsx` (1,221 บรรทัด) เป็นไฟล์ข้างกัน ตัด `DimensionValuesDialog` ทิ้ง ปุ่ม "N values" เปิด `DimensionDialog` พร้อม focus ที่ตาราง `saveDimensionWithValues` เลิก throw ตัวแรก แต่เก็บ error ลงแถว draft แล้วคืนจำนวนที่พัง

**Tech Stack:** React 19 + React Compiler, Radix Dialog (`components/ui/dialog.tsx`), Tailwind v4 container queries, Vitest + Testing Library

**Spec:** `docs/superpowers/specs/2026-11-25-dimension-edit-dialog-design.md`

## Global Constraints

- **ไม่เขียนเทสต์ใหม่ / ไม่ทำขั้น TDD** (ความชอบของผู้ใช้) — แต่เทสต์เดิม `routes/config/dimension/dimension-page.test.tsx` และ `routes/accounting/accounts-receivable/ar-line-dimension-display.test.tsx` ต้องเขียว แก้ assertion เดิมได้เฉพาะที่พฤติกรรมเปลี่ยนตาม spec
- ทุก task จบด้วย `bun run typecheck` ผ่าน + lint ไฟล์ที่แตะ (`bunx eslint <files>`)
- FE อย่างเดียว ห้ามแตะ BE / DB
- ใช้ primitive ใน `components/ui/` ห้ามตั้งสี/ขนาดใหม่ที่ call site; ข้อความใช้ `text-xs`/`text-sm` ตาม ladder (`components/ui/type-ladder.test.ts`)
- สีสถานะใช้ token ที่ register แล้ว: `warning`, `info`, `destructive` (`bg-info/10`, `bg-destructive/10`, `shadow-[inset_3px_0_var(--warning)]`) — ต้องอ่านออกทั้ง light/dark; **ห้าม** `bg-status-*`
- ห้ามลบ `grid-cols-[minmax(0,1fr)]` ของ `DialogContent` — layout สองคอลัมน์ทำใน div ข้างใน
- หน้านี้เป็น English hard-coded (ไม่ผ่าน i18n) — copy ใหม่เป็นอังกฤษตามที่ระบุ
- commit message ภาษาไทย

## Review Focus

1. **Save ซ้ำหลังพังบางแถว** — แถวที่บันทึกผ่านต้องไม่ถูก POST ซ้ำ (เทสต์เดิม "retains saved IDs…" คุมอยู่ ห้ามทำให้แดง)
2. **ลบแถวที่บันทึกแล้วแต่ DELETE พัง** — แถวต้องยังแสดงขีดฆ่าพร้อม error ไม่หายไปเงียบ ๆ และ Save รอบถัดไปลองลบอีก
3. **เปลี่ยน Data Type จาก lookup เป็นอย่างอื่นตอนมีค่าย่อย** — ส่วนตารางหายและ dialog หด แต่แถวที่ id มีอยู่แล้วไม่ถูกลบ (logic เดิม: ส่งเฉพาะ `deleted` เมื่อไม่ใช่ lookup)
4. **ผู้ใช้ไม่มีสิทธิ์แก้ (`readOnly`) กด "N values"** — เห็นตารางอ่านอย่างเดียว ไม่มี checkbox / Add / Undo / input
5. **dimension ชนิด date ที่ DB มี `date_format` เก่า** — ช่องกรอกในบรรทัด JV/AR และข้อความแสดงผลใช้รูปแบบโปรไฟล์ (`useProfile().dateFormat`) ไม่ใช่ค่าเก่า

---

### Task 1: เลิกใช้ `date_format` ของ dimension

**Files:**
- Modify: `types/accounting-master.ts:54-58` — ลบ type `DimensionDateFormat` และฟิลด์ `date_format?` ออกจาก `DimensionMaster` (ให้ tsc ชี้ทุกจุดที่ยังอ่าน)
- Modify: `lib/dimension-value.ts:51-90` — ลบ `formatYmd` + `MONTHS`; `formatDimensionValue(ref, dimension?: Pick<DimensionMaster, "data_type">, labels)`; ชนิด date คืน `labels.formatDate ? labels.formatDate(ymd) : ymd`
- Modify: `lib/dimension-value.ts` (type `DimensionValueLabels`) — เพิ่ม `formatDate?: (ymd: string) => string`
- Modify: `hooks/use-dimension-value-formatter.ts` — อ่าน `dateFormat` จาก `useProfile()` แล้วใส่ `formatDate: (ymd) => { const d = ymdToLocalDate(ymd); return d ? formatDate(d.toISOString(), dateFormat) : ymd; }` (`formatDate` จาก `lib/date-utils.ts`, `ymdToLocalDate(ymd): Date | undefined` จาก `lib/dimension-value.ts:33` — parse ไม่ได้คืน ymd ดิบ); Pick type เหลือ `"data_type"`
- Modify: `components/dimension/dimension-value-input.tsx:94-218` — `DateInput` ตัด prop `format` และไม่ส่ง `displayFormat` ให้ `DatePicker` (ใช้ของโปรไฟล์); แก้ doc comment บรรทัด 38
- Modify: `routes/config/dimension/dimension-data-types.ts` — ลบ `DIMENSION_DATE_FORMATS`
- Modify: `routes/config/dimension/dimension-page.tsx` — `DimensionTypeFields` เหลือแค่ Select Data Type (ตัด prop `dateFormat`/`onDateFormatChange`); ตัด state `dateFormat`, `date_format` ใน `getDimensionFormDefaults` และใน payload save
- Modify: `routes/config/dimension/dimension-page.test.tsx:138` — เปลี่ยนชื่อเทสต์เป็น `"shows list items only for List, and never a date format field"`; หลังเลือก Date assert `queryByRole("combobox", { name: /Date Format/ })` เป็น null
- Modify: `routes/accounting/accounts-receivable/ar-line-dimension-display.test.tsx:44` — ลบ `date_format` จาก mock (mock `useProfile` ให้ `dateFormat: "DD/MM/YYYY"` อยู่แล้ว expectation เดิมควรผ่าน)

**Interfaces:**
- Produces: `formatDimensionValue(ref: DimensionRef, dimension?: Pick<DimensionMaster, "data_type">, labels?: DimensionValueLabels): string`; `DimensionValueLabels.formatDate?: (ymd: string) => string`

- [ ] **Step 1:** แก้ไฟล์ตามรายการข้างบน แล้วตามแก้ทุก error ที่ tsc ชี้ (ผู้เรียก `useDimensionValueFormatter` 5 จุดใน `components/dimension/line-dimension-strip.tsx` ฯลฯ ไม่ควรต้องแก้ signature)
- [ ] **Step 2:** `bun run typecheck` → ไม่มี error; `grep -rn "date_format\|DimensionDateFormat\|formatYmd" routes components hooks lib types` → ไม่เหลือจุดที่เกี่ยวกับ dimension (`date_format` ของ BU config ใน `hooks/use-profile.ts` ไม่นับ)
- [ ] **Step 3:** `bun test:run routes/config/dimension routes/accounting/accounts-receivable/ar-line-dimension-display.test.tsx` → PASS
- [ ] **Step 4:** Commit

```bash
git add types/accounting-master.ts lib/dimension-value.ts hooks/use-dimension-value-formatter.ts components/dimension/dimension-value-input.tsx routes/config/dimension routes/accounting/accounts-receivable/ar-line-dimension-display.test.tsx
git commit -m "refactor(dimension): เลิกใช้ date_format ของ dimension ใช้รูปแบบวันที่จากโปรไฟล์แทน"
```

---

### Task 2: แยก dialog + บันทึกค่าย่อยแบบเก็บ error รายแถว

**Files:**
- Create: `routes/config/dimension/dimension-dialog.tsx` — ย้าย `DimensionDialog`, `DimensionTypeFields`, `getDimensionFormDefaults` มาจาก page
- Create: `routes/config/dimension/save-dimension-with-values.ts` — ย้าย `saveDimensionWithValues` + `DimensionValueDraft` มา
- Modify: `routes/config/dimension/dimension-page.tsx` — import `DimensionDialog` จากไฟล์ใหม่ ลบของที่ย้าย
- Modify: `routes/config/dimension/dimension-page.test.tsx:7` — import `DimensionDialog` จาก `"./dimension-dialog"`

**Interfaces:**
- Produces:
  - `export interface DimensionValueDraft extends DimensionValueMaster { key: string; dirty: boolean; deleted?: boolean; error?: string }`
  - `export async function saveDimensionWithValues(args: <เดิม>): Promise<{ failed: number }>` — validation (code/name ว่าง, code ซ้ำ, ไม่มี buCode) และการ save header ยัง **throw** เหมือนเดิม; ส่วนแต่ละแถว: สำเร็จ → `dirty: false, error: undefined` (ลบสำเร็จ → เอาแถวออก); พัง → คงแถวไว้ (รวม `deleted: true`) และตั้ง `error: <message>` ผ่าน `setSubValues`; คืนจำนวนแถวที่พัง
  - `export function DimensionDialog(props: { open; readOnly?; item; onOpenChange; onSave; focusValues?: boolean })` — `focusValues` ใช้ใน Task 4

- [ ] **Step 1:** ย้ายโค้ดตามรายการ (พฤติกรรม UI ยังเดิม) และเปลี่ยน `saveDimensionWithValues` ตาม Interfaces
- [ ] **Step 2:** ใน onClick Save ของ dialog: `failed === 0` → `toast.success("Dimension and sub-values saved")` + ปิด; `failed > 0` → ไม่ปิด, ตั้งข้อความสรุปที่ footer: `` `${failed} item(s) failed to save. Fix them and press Save again.` `` (ไม่มี role=alert — ใช้ `aria-live="polite"`); แสดง `error` ของแต่ละแถวเป็น `<p role="alert" className="text-destructive text-xs">` ใต้ช่องของแถวนั้น (ชั่วคราวในฟอร์มเดิม — Task 3 ย้ายเข้าตาราง)
- [ ] **Step 3:** `bun run typecheck` → ผ่าน; `bun test:run routes/config/dimension` → PASS (เทสต์ "retains saved IDs…" หา `role="alert"` ที่มีข้อความ "Second value failed" — ตอนนี้มาจากแถว)
- [ ] **Step 4:** Commit — `git commit -m "refactor(dimension): แยก DimensionDialog ออกจากหน้า list และเก็บ error การบันทึกค่าย่อยรายแถว"`

---

### Task 3: โครงข้างกัน + ตารางค่าย่อย

**Files:**
- Modify: `routes/config/dimension/dimension-dialog.tsx`
- Create: `routes/config/dimension/dimension-values-table.tsx` — แทน `DimensionSubValues` เดิม (ลบตัวเดิมทิ้ง)

**Interfaces:**
- Consumes: `DimensionValueDraft` จาก Task 2
- Produces: `export function DimensionValuesTable(props: { readOnly: boolean; savedId?: string; subValues: DimensionValueDraft[]; setSubValues: Dispatch<SetStateAction<DimensionValueDraft[]>>; tableRef?: Ref<HTMLDivElement> })`

- [ ] **Step 1: โครง dialog** — `isLookup = dataType === "lookup"`; `DialogContent` className `@container max-h-[90dvh] overflow-y-auto` + `sm:max-w-5xl` เมื่อ lookup, `sm:max-w-xl` เมื่อไม่ใช่; ข้างในเป็น div:
  - lookup: `grid gap-4 @3xl:grid-cols-[16rem_minmax(0,1fr)]` — คอลัมน์ซ้ายช่อง header เรียงแนวตั้ง (Code, Name EN, Name TH, Data Type, Status), คอลัมน์ขวา `DimensionValuesTable`
  - ไม่ใช่ lookup: ช่อง header `grid gap-4 @md:grid-cols-2` ไม่มีตาราง
  - label/id ของช่อง header คงเดิม (`dim-code`, `Dimension Code (lowercase/underscore)`, `Dimension Name (EN)` …) เทสต์อ้างอยู่
- [ ] **Step 2: หัวตาราง** — แถบบน: `List Master Items · {จำนวนแถวที่ไม่ deleted}` ซ้าย; ขวา (ซ่อนเมื่อ readOnly) ปุ่ม `Delete ({n})` variant destructive (disabled เมื่อไม่ได้เลือก, ชื่อปุ่มตอนไม่เลือกคือ `Delete`) และ `Add Value` variant outline — ชื่อปุ่มต้องตรงนี้ เทสต์อ้าง
- [ ] **Step 3: ตาราง** — `<table>` ใน div `max-h-[60dvh] overflow-auto rounded-md border` (ref = `tableRef`), `thead` sticky; คอลัมน์: checkbox (ไม่มีเมื่อ readOnly) · Code · Name (EN)* · Name (TH) · Active
  - input ในแถวใช้ `FieldInput` size เล็ก `aria-label`: `Code`, `Name (EN)`, `Name (TH)` (เทสต์ใช้ `getAllByLabelText(/^Code/)` และ `/^Name \(EN\)/`); Code disabled เมื่อมี `id`; maxLength คงเดิม 10/50/100
  - Active เป็น `Checkbox` (**ไม่ใช่ Switch** — เทสต์นับ `role="switch"` = 1) `aria-label={`Active ${code || index + 1}`}`
  - checkbox เลือก `aria-label={`Select sub-value ${index + 1}`}`
  - readOnly: แสดงข้อความแทน input
  - ว่าง: แถวเดียว `No list master items defined yet.`
- [ ] **Step 4: สถานะแถว** (className บน `<tr>`)
  - `dirty && id` → `shadow-[inset_3px_0_var(--warning)]`
  - ไม่มี `id` → `bg-info/10`
  - `deleted` → แสดงเป็นข้อความ (ไม่มี input) `text-muted-foreground line-through`; ช่อง checkbox เปลี่ยนเป็นปุ่ม ghost icon `Undo2` `aria-label={`Undo delete ${code}`}` ที่ตั้ง `deleted: false` (ซ่อนเมื่อ readOnly)
  - มี `error` → `bg-destructive/10` + `<p role="alert" className="text-destructive text-xs">{error}</p>` ใต้ Name (EN)
  - ใต้ตาราง legend เล็ก `text-muted-foreground text-xs`: Edited · New · Will be deleted / Failed (แสดงเฉพาะเมื่อมีแถวใน state นั้นอย่างน้อยหนึ่ง)
- [ ] **Step 5:** `bun run typecheck` → ผ่าน; `bun test:run routes/config/dimension` → PASS (เทสต์ "deletes a selected saved value…" ต้องการว่าแถวที่ลบไม่เหลือ input ค่า "First" — ตรงกับการแสดงเป็นข้อความ)
- [ ] **Step 6:** Commit — `git commit -m "feat(dimension): dialog แบบสองคอลัมน์ ตารางค่าย่อยแก้ในแถว มีคอลัมน์ Active และสีสถานะแถว"`

---

### Task 4: ปุ่ม "N values" ใช้ dialog เดียว + ตัด `DimensionValuesDialog`

**Files:**
- Modify: `routes/config/dimension/dimension-page.tsx`

**Interfaces:**
- Consumes: `DimensionDialog` prop `focusValues`, `DimensionValuesTable` prop `tableRef` (Task 2–3)

- [ ] **Step 1:** state `editing` เปลี่ยนเป็น `{ item: DimensionMaster | null; focusValues: boolean } | undefined`; คลิก Code/Name → `focusValues: false`, ปุ่ม "N values" → `{ item: row.original, focusValues: true }`, ปุ่มเพิ่ม → `{ item: null, focusValues: false }`; `readOnly={!!editing.item && !canEdit}` เหมือนเดิม
- [ ] **Step 2:** ใน `DimensionDialog` เมื่อ `focusValues`: `DialogContent onOpenAutoFocus={(e) => { e.preventDefault(); tableRef.current?.querySelector<HTMLElement>("input:not([disabled]),button:not([disabled])")?.focus() ?? tableRef.current?.scrollIntoView() }}`
- [ ] **Step 3:** ลบ `DimensionValuesDialog`, state `viewingValuesId`/`viewingValues`, `mutateValue` และ import ที่ไม่ใช้แล้ว (`DeleteDialog` ยังใช้กับการลบ dimension — อย่าลบ)
- [ ] **Step 4:** `bun run typecheck` → ผ่าน; `bunx eslint routes/config/dimension` → ไม่มี error; `bun test:run routes/config/dimension` → PASS
- [ ] **Step 5: ตรวจมือในเบราว์เซอร์** `http://localhost:3000/config/dimension` (ผู้ใช้ตรวจเอง หรือขออนุญาตก่อนใช้ Chrome) — ทั้ง light/dark, จอ 1366 และ mobile:
  - เปิดจาก Code และจาก "N values" (focus อยู่ในตาราง)
  - เพิ่ม/แก้/ลบ+Undo/ติ๊ก Active แล้ว Save; ใส่ code ซ้ำกับของที่มีใน DB เพื่อดูแถวแดง แล้วแก้ + Save ซ้ำ
  - สลับ Data Type เป็น Date → dialog หด ไม่มี Date Format; บรรทัด JV ที่มี dimension date แสดงตามรูปแบบโปรไฟล์
  - ผู้ใช้ไม่มีสิทธิ์ → อ่านอย่างเดียว
- [ ] **Step 6:** Commit — `git commit -m "feat(dimension): ปุ่มจำนวนค่าย่อยเปิด dialog แก้ dimension ตัวเดียวกัน และตัด dialog รายการค่าย่อยเดิม"`
