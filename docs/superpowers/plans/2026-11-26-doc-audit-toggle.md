# Doc Audit Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** สวิตช์ราย BU สองตัวในหน้า Default Setting คุมการแสดงแถว audit (สร้างโดย/แก้ไขล่าสุดโดย) และช่อง rev.x ในการ์ดหัวเอกสาร — ค่าเริ่มต้นเปิดทั้งคู่

**Architecture:** คีย์ใหม่สองตัวใน registry `CONFIG_SECTIONS` (section `general`) — Default Setting เรนเดอร์ Switch ให้เอง · ฟังก์ชัน pure ใน `lib/` แปลง BU config → `{ showAudit, showRevision }` · hook ใน `hooks/` อ่าน BU ที่ใช้งาน · `DocAuditLine`/`DocAuditButton` เคารพค่า ครอบ 15 หน้าโดยไม่แตะ call site

**Tech Stack:** React 19, TanStack Query (`useBusinessUnit`), use-intl, Vitest

**Spec:** `docs/superpowers/specs/2026-11-26-doc-audit-toggle-design.md`

## Global Constraints

- คีย์: `general.show-doc-audit` และ `general.show-doc-revision` · datatype `boolean` · `defaultValue: "true"`
- ค่าที่ไม่ใช่สตริง `"false"` (รวม undefined / ยังโหลดไม่เสร็จ / ไม่เคยตั้ง) = แสดง
- ไม่แตะ call site ทั้ง 15 จุด, list audit columns, Excel export, activity sheet, backend
- ข้อความในโค้ด/คอมเมนต์ภาษาไทยได้ · commit message ภาษาไทย
- **ไม่เขียนเทสต์ใหม่** (ตามความต้องการของผู้ใช้) — แต่ suite เดิมต้องเขียว + typecheck + lint

## Review Focus

- BU ที่ไม่เคยเปิดหน้า Default Setting (config ไม่มีคีย์) → ต้องเห็นตารางเหมือนเดิมทุกประการ
- ปิด audit + เปิด rev. ในโหมดสร้างใบใหม่ (ไม่มี `audit`) → ไม่ render อะไรเลย (คง guard เดิม)
- ปิด audit + เปิด rev. ในหน้าที่ไม่ส่ง `docVersion` (เช่น Cuisine/Equipment) → ไม่ render กล่องเปล่า
- ปิดทั้งคู่บนมือถือ → ปุ่ม Info ต้องหาย ไม่ใช่เปิด popover ว่าง
- กด Save ที่ Default Setting แล้วกลับไปหน้าเอกสาร → ค่าใหม่มีผลโดยไม่ต้อง reload (query `BUSINESS_UNIT_DETAIL` ถูก invalidate หลัง save — ตรวจใน Task 4 ถ้าไม่ invalidate ให้รายงาน ไม่ต้องแก้เอง)

---

### Task 1: ค่าคงที่ + ฟังก์ชันอ่านค่า + hook

**Files:**
- Create: `lib/doc-audit-visibility.ts`
- Create: `hooks/use-doc-audit-visibility.ts`

**Interfaces:**
- Consumes: `resolveBuConfigValue(config, key): string | undefined` จาก `@/lib/print-form-config` · `useProfile().defaultBu` · `useBusinessUnit(buId)` จาก `@/hooks/use-business-unit`
- Produces:
  - `export const DOC_AUDIT_SHOW_KEY = "general.show-doc-audit"`
  - `export const DOC_REVISION_SHOW_KEY = "general.show-doc-revision"`
  - `export interface DocAuditVisibility { readonly showAudit: boolean; readonly showRevision: boolean }`
  - `export function resolveDocAuditVisibility(config: BusinessUnitDetail["config"] | undefined): DocAuditVisibility`
  - `export function useDocAuditVisibility(): DocAuditVisibility` (ใน `hooks/use-doc-audit-visibility.ts`)

- [ ] **Step 1:** เขียน `lib/doc-audit-visibility.ts` — แต่ละค่า = `resolveBuConfigValue(config, key) !== "false"` · JSDoc ชี้ไปที่ registry (แบบหัวไฟล์ `lib/bu-price-rates.ts`)
- [ ] **Step 2:** เขียน hook ตามรูป `routes/operation-plan/recipe/use-recipe-price-rates.ts`: `useBusinessUnit(useProfile().defaultBu?.id)` → `resolveDocAuditVisibility(data?.config)`
- [ ] **Step 3:** `bun run typecheck` → 0 errors
- [ ] **Step 4:** Commit `feat: ฟังก์ชันอ่านสวิตช์แสดง audit/rev. ของ BU`

### Task 2: สวิตช์ในหน้า Default Setting

**Files:**
- Modify: `routes/system-admin/company-profile/company-profile-config-registry.ts` (section `id: "general"` ~L185–211)
- Modify: `messages/en.json`, `messages/th.json` (ถัดจาก `defaultSetting.config.generalDefaultServiceRate` ~L243)

**Interfaces:**
- Consumes: `DOC_AUDIT_SHOW_KEY`, `DOC_REVISION_SHOW_KEY` จาก Task 1

- [ ] **Step 1:** ต่อท้าย `items` ของ section `general` สองรายการ (ลำดับนี้):

| key | label (EN, persisted) | labelKey |
|---|---|---|
| `DOC_AUDIT_SHOW_KEY` | `Show created/updated by on documents` | `config.generalShowDocAudit` |
| `DOC_REVISION_SHOW_KEY` | `Show revision number (rev.) on documents` | `config.generalShowDocRevision` |

ทั้งคู่ `datatype: "boolean"`, `defaultValue: "true"`
- [ ] **Step 2:** i18n — en: ข้อความเดียวกับ `label` · th: `generalShowDocAudit` = `"แสดงผู้สร้าง/ผู้แก้ไขล่าสุดในหัวเอกสาร"`, `generalShowDocRevision` = `"แสดงเลขรุ่น (rev.) ในหัวเอกสาร"` — ห้ามมี `{}` หรือ `<คำ>` ในข้อความ (ICU)
- [ ] **Step 3:** `bun run typecheck` และ `bun test:run routes/system-admin/company-profile/` → ผ่าน (ไม่เพิ่มเทสต์ใหม่)
- [ ] **Step 4:** Commit `feat: เพิ่มสวิตช์แสดง audit และ rev. ในการ์ด General ของ Default Setting`

### Task 3: `DocAuditLine` / `DocAuditButton` เคารพสวิตช์

**Files:**
- Modify: `components/share/doc-audit-line.tsx` (`DocAuditLine` L34–85, `DocAuditButton` L124–171, JSDoc หัวไฟล์)

**Interfaces:**
- Consumes: `useDocAuditVisibility()` จาก Task 1
- Produces: props ของทั้งสองคอมโพเนนต์ไม่เปลี่ยน

- [ ] **Step 1:** `DocAuditLine` — คง guard เดิม (`!audit?.created?.at && !audit?.updated?.at` → null) ไว้ก่อน แล้ว:
  - `showRev = showRevision && docVersion != null`
  - `showAudit && rows.length > 0` → ตารางเดิม; ช่อง rev. (`revCell`) ใส่เมื่อ `showRev` เท่านั้น
  - `!showAudit && showRev` → `<table>` คลาสเดียวกัน (มี `<caption className="sr-only">`) แถวเดียว `<td>` เดียว ข้อความ `{tfl("revision")} {docVersion}` คลาส padding/`tabular-nums`/`whitespace-nowrap` แบบ `revCell` แต่ไม่มี `border-s`
  - ไม่เหลืออะไรให้แสดง → `null`
- [ ] **Step 2:** `DocAuditButton` — คำนวณเงื่อนไข "มีอะไรให้แสดง" ชุดเดียวกับ Step 1 (แยกเป็น helper pure ในไฟล์เดียวกัน `hasDocAuditContent(audit, docVersion, visibility): boolean` แล้วให้ทั้งสองคอมโพเนนต์ใช้) → `false` = `return null` · hook ต้องเรียกก่อน early return ทุกตัว (rules of hooks)
- [ ] **Step 3:** อัปเดต JSDoc หัวไฟล์หนึ่งบรรทัด: สองส่วนนี้ปิดได้ราย BU ที่ Default Setting (คีย์ทั้งสอง)
- [ ] **Step 4:** `bun run typecheck` · `bun run lint` · `bun test:run` (ทั้ง suite — header characterization tests ของ PR/PO/GRN/CN/SR/PL/PLT/RFP เรนเดอร์คอมโพเนนต์นี้; ถ้าแดงเพราะไม่มี QueryClient ให้รายงานพร้อม output ก่อนแก้)
- [ ] **Step 5:** Commit `feat: ซ่อนแถว audit / ช่อง rev. ในหัวเอกสารตามสวิตช์ของ BU`

### Task 4: ตรวจในเบราว์เซอร์ (มือ — ไม่ใช่เทสต์)

- [ ] **Step 1:** `bun dev` → `/system-admin/default-setting` เห็นสวิตช์สองตัวในการ์ด General เป็น Yes ทั้งคู่ (BU ที่ไม่เคยตั้ง)
- [ ] **Step 2:** เปิด PR ใบหนึ่ง (มี rev.) ไล่ 4 สถานะตามตารางใน spec ที่จอกว้าง และสถานะ "ปิดทั้งคู่" ที่จอมือถือ (ปุ่ม Info หาย) — ทั้ง light/dark
- [ ] **Step 3:** เปิด Cuisine (ไม่มี `docVersion`) สถานะ ปิด audit/เปิด rev. → ไม่มีกล่องเปล่า
- [ ] **Step 4:** หลังทดสอบ **คืนค่าทั้งสองเป็นเปิด** (dev DB ใช้ร่วมกัน) และรายงานผลข้อ Review Focus ข้อสุดท้าย (ต้อง reload หรือไม่)
