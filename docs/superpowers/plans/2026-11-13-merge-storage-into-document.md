# Merge Storage into Document Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/system-admin/document` แสดงโควตาพื้นที่ (ไฟล์แนบ + database) เหนือรายการไฟล์ และหน้า `/system-admin/storage` หายไป

**Architecture:** แถบใหม่ `DocumentStorageBar` ในโฟลเดอร์ Document รวมแถบโควตา (ข้อมูลจาก `useStorageUsage`) กับบรรทัดแจกแจงตามชนิด (ข้อมูลจาก `useDocumentSummary`) ไว้ในกล่องเดียว แทน `DocumentSummaryBar` ปุ่ม "วัดใหม่" ย้ายไปอยู่ข้างปุ่ม Upload จากนั้นลบโฟลเดอร์ `routes/system-admin/storage/` และทุกจุดที่ชี้ไปหา

**Tech Stack:** React 19 + React Router 7, TanStack Query, use-intl, Tailwind v4 (container queries), Vitest

**Spec:** `docs/superpowers/specs/2026-11-13-merge-storage-into-document-design.md`

## Global Constraints

- Frontend อย่างเดียว: ไม่แก้ backend, endpoint, license feature, permission
- **ไม่เขียนเทสต์ใหม่ และข้ามขั้น TDD ทั้งหมด** (คำสั่งของผู้ใช้) — แก้เฉพาะเทสต์เดิมที่แดงจากการลบ · ยังต้องรัน `bun run typecheck`, `bun run lint`, `bun test:run`
- ปุ่ม "วัดใหม่" เห็นเฉพาะ `can(PERMISSIONS.system_admin.view)`
- endpoint โควตาหรือ endpoint สรุปโหลดไม่ได้ = ส่วนนั้นหายไปเงียบ ๆ ห้ามมี error state
- ข้อความสถานะใช้ `text-*-ink` ไม่ใช่ `text-success` / `text-warning` · ห้ามใช้ขนาดตัวอักษรนอก ladder · ต้องอ่านออกทั้งธีมสว่างและมืด
- `routes/system-admin/` ห้าม import จาก `routes/<โมดูลอื่น>/`
- commit message ภาษาไทย · ทำงานบน branch `feature/merge-storage-into-document` (มีอยู่แล้ว)

## Review Focus

ไม่มีเทสต์อัตโนมัติรองรับ ทั้งห้าข้อตรวจด้วยมือใน Task 3:

1. api_name ของโควตายังไม่อยู่ใน allowlist (โหลดไม่ได้) → หน้าเหลือบรรทัดแจกแจงเหมือนก่อนแก้ ไม่มี error
2. BU ที่ยังไม่มีไฟล์เลย (`summary.total_count === 0`) → ยังเห็นแถบโควตา และตารางว่างแสดงปกติ
3. ผู้ใช้ที่มี `system_admin.document.view` แต่ไม่มี `system_admin.view` → เห็นแถบโควตา ไม่เห็นปุ่มวัดใหม่
4. กด "วัดใหม่" ซ้ำภายใน 10 นาที (429) → ปุ่มปิด มี tooltip ไม่มี toast error
5. สลับ BU ขณะ Sheet "ดูทั้งหมด" เปิดอยู่ → Sheet ปิด และไม่เด้งเปิดเองใน BU ใหม่ (พฤติกรรมเดิมต้องไม่หาย)

---

### Task 1: แถบโควตาในหน้า Document

**Files:**
- Create: `routes/system-admin/document/document-storage-bar.tsx`
- Create: `routes/system-admin/document/document-measure-button.tsx`
- Delete: `routes/system-admin/document/document-summary-bar.tsx`
- Modify: `routes/system-admin/document/document-component.tsx` (บรรทัด ~26, ~93–103, ~306–332, ~394–406)

**Interfaces:**
- Consumes: `useStorageUsage()`, `useMeasureStorage()` จาก `@/hooks/use-storage-usage` · `useDocumentSummary()` จาก `./use-document` · `BuStorageUsage`, `StorageKindUsage` จาก `@/types/storage-usage` · `DocumentSummary` จาก `@/types/document`
- Produces:

```ts
// document-storage-bar.tsx
interface DocumentStorageBarProps {
  readonly usage: BuStorageUsage | undefined;
  readonly isUsageLoading: boolean;
  readonly summary: DocumentSummary | undefined;
  readonly isSummaryLoading: boolean;
  readonly onViewAll: () => void;
}
export default function DocumentStorageBar(props: DocumentStorageBarProps): JSX.Element | null;

// document-measure-button.tsx — ไม่มี props, ไม่เช็คสิทธิ์เอง (ผู้เรียกเช็ค)
export function DocumentMeasureButton(): JSX.Element;
```

- [ ] **Step 1: สร้าง `DocumentStorageBar`**

กล่องเดียว (`bg-muted/40 rounded-md border px-3 py-2`, ห่อด้วย `@container`) มีสองแถว:

- แถวโควตา: แสดงเมื่อ `usage?.kinds.length > 0` — หนึ่งช่องต่อ kind ในกริด `grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))] gap-x-8 gap-y-2` แต่ละช่องคือชื่อ kind + `usedOfQuota` บรรทัดเดียวชิดซ้าย แล้ว `Progress` ข้างล่าง ยก logic `pct` และ `variant` จาก `UsageBar` ใน `routes/system-admin/storage/storage-usage-card.tsx:26-62` มาทั้งก้อน **ยกเว้น** บรรทัด `measuredAt` ใต้แถบ
- แถวแจกแจง: `measuredAt` ครั้งเดียว (ใช้ `measured_at` ของ kind `attachment` ถ้าไม่มีใช้ตัวแรก แสดงเมื่อมีแถวโควตา) ตามด้วยเนื้อหาเดิมของ `DocumentSummaryBar` (ยอดรวม + จำนวนไฟล์ + 3 ชนิดแรก + ปุ่ม "ดูทั้งหมด") ซึ่งแสดงเมื่อ `summary && summary.total_count > 0`
- namespace: `storageQuota` สำหรับ `kind.*`, `usedOfQuota`, `measuredAt` · `systemAdmin.document.summary` สำหรับ `fileCount`, `directUpload`, `viewAll` · `modules` สำหรับ `documentReferenceLabel`
- loading: ถ้า `isUsageLoading || isSummaryLoading` และยังไม่มีข้อมูลฝั่งใดเลย คืน `Skeleton` สูงเท่ากล่องสองแถว (ไม่ใช่ `h-9` เดิม)
- ไม่มีทั้งแถวโควตาและเนื้อหาแจกแจง และไม่ได้โหลดอยู่ → คืน `null`

- [ ] **Step 2: สร้าง `DocumentMeasureButton`**

ย้าย `measureButton` + กิ่ง `rateLimited` (Tooltip ครอบ `span tabIndex={0}`) จาก `storage-usage-card.tsx:71-124` มาทั้งก้อน พฤติกรรมเหมือนเดิมทุกอย่าง: `variant="outline" size="sm"`, ปิดเมื่อ `isPending || rateLimited`, toast `measureFailed` เฉพาะ error ที่ไม่ใช่ 429

- [ ] **Step 3: ต่อเข้า `document-component.tsx`**

- เรียก `const { data: usage, isLoading: isUsageLoading } = useStorageUsage();` และ `const { can } = useCan();`
- `actions`: ใส่ `{can(PERMISSIONS.system_admin.view) && <DocumentMeasureButton />}` **ก่อน** ปุ่ม Upload (Upload เป็นปุ่มหลัก อยู่ขวาสุด)
- `toolbar`: แทน `<DocumentSummaryBar …/>` ด้วย `<DocumentStorageBar usage={usage} isUsageLoading={isUsageLoading} summary={summary} isSummaryLoading={isSummaryLoading} onViewAll={() => setSummarySheetOpen(true)} />`
- เปลี่ยนชื่อ `summarySlotVisible` เป็น `storageSlotVisible` = `hasSummary || isSummaryLoading || isUsageLoading || !!usage?.kinds.length` — `hasSummary` และการรีเซ็ต `summarySheetOpen` ระหว่าง render คงไว้ตามเดิม
- ลบ `document-summary-bar.tsx`

- [ ] **Step 4: ปรับ `max-h` ของตาราง**

รัน `bun dev` เปิด `/system-admin/document` (BU T02) วัดความสูงกล่องสองแถวที่จอ 1366 แล้วแก้ค่าในกิ่ง `storageSlotVisible` (`max-h-[calc(100vh-17rem-3rem)]` / `max-h-[calc(100vh-14rem-3rem)]` ที่บรรทัด ~402–404) ให้เพิ่มขึ้นเท่าส่วนสูงที่เพิ่มจากแถบเดิม ใช้ค่าเดียวสำหรับ "กล่องมีของ" (เผื่อเต็มสองแถวเสมอ แม้เหลือแถวเดียว) เพื่อไม่ให้ตารางกระตุกตอน skeleton สลับเป็นของจริง อัปเดตคอมเมนต์ "แถบสรุปสูงประมาณ 4rem" ให้ตรงค่าใหม่

ผ่านเมื่อ: หน้าไม่มี scrollbar ของ `body` ที่ 1366×768 ทั้งตอนมีและไม่มี active filter

- [ ] **Step 5: ตรวจ static**

Run: `bun run typecheck && bun run lint`
Expected: ผ่านทั้งคู่ (หน้า Storage เดิมยังอยู่และยังทำงาน — ลบใน Task 2)

- [ ] **Step 6: Commit**

```bash
git add routes/system-admin/document
git commit -m "feat(document): แสดงโควตาพื้นที่และปุ่มวัดใหม่ในหน้า Document"
```

---

### Task 2: ลบหน้า Storage และจุดที่ชี้ไปหา

**Files:**
- Delete: `routes/system-admin/storage/` (ทั้งโฟลเดอร์)
- Modify: `routes/router.tsx:771-774`
- Modify: `constant/module-list.ts:948-956` (+ import `HardDrive` ถ้าไม่มีผู้ใช้อื่น)
- Modify: `routes/system-admin/landing-types.ts:41,52,176-186`
- Modify: `routes/system-admin/landing-visuals.tsx:48-49,466+` (`StorageViz`)
- Modify: `components/ui/type-ladder.test.ts:186`
- Modify: `components/storage-quota-banner.tsx:41,150`
- Modify: `hooks/use-storage-usage.ts:11-12` (คอมเมนต์)
- Modify: `messages/en.json`, `messages/th.json`

**Interfaces:**
- Consumes: หน้า Document จาก Task 1 แสดงโควตาแล้ว
- Produces: ไม่มี

- [ ] **Step 1: Router**

แทน route `storage` ด้วย redirect ตามแบบที่ไฟล์ใช้อยู่ (ดู `routes/router.tsx:751`):

```tsx
{
  path: "storage",
  element: <Navigate to="/system-admin/document" replace />,
},
```

แล้วลบโฟลเดอร์ `routes/system-admin/storage/`

- [ ] **Step 2: เมนูและ landing**

- ลบ entry `name: "storage"` ใน `constant/module-list.ts`
- `landing-types.ts`: ลบกลุ่ม `key: "data"` ทั้งกลุ่ม, ลบ `"storage"` จาก union ของ visual key และ `"data"` จาก union ของ group key
- `landing-visuals.tsx`: ลบ `case "storage"` และฟังก์ชัน `StorageViz`
- `rg -n '"data"|\.data\b' routes/system-admin/system-admin-landing.tsx routes/system-admin/shared` แล้วลบสิ่งที่อ้างกลุ่ม data โดยเฉพาะ

- [ ] **Step 3: แบนเนอร์เตือนโควตา**

`components/storage-quota-banner.tsx:150`: `to="/system-admin/storage"` → `to="/system-admin/document"` และแก้คอมเมนต์บรรทัด 41 · ชื่อ prop `canOpenStorage` คงเดิม · แก้คอมเมนต์ใน `hooks/use-storage-usage.ts` ที่อ้าง `/system-admin/storage`

- [ ] **Step 4: ข้อความแปล (en + th)**

- `storageQuota.openStoragePage`: en `"Open Documents"` · th ใช้คำเดียวกับชื่อเมนูหน้า Document ในไฟล์ th ขึ้นต้นด้วย "เปิดหน้า"
- ลบจาก `storageQuota`: `pageTitle`, `pageDesc`, `loadFailed`, `notMeasured`, `usageTitle`, `breakdownTitle`, `breakdownDesc`, `openDocuments`, `breakdownEmpty` และ `fileCount`, `directUpload` **ถ้า** `rg "storageQuota" -l` ยืนยันว่าไม่มีผู้ใช้เหลือ
- ลบชื่อเมนู `storage` (en บรรทัด ~7344) และข้อความการ์ด landing `storage` (en บรรทัด ~2916) รวมถึงหัวกลุ่ม `data` ของ landing ถ้ามี
- ทำซ้ำกับ `messages/th.json` ที่คีย์เดียวกัน

- [ ] **Step 5: เทสต์เดิม**

Run: `bun test:run`
`components/ui/type-ladder.test.ts:186` จะแดงเพราะจำนวนข้อยกเว้นของ `landing-visuals.tsx` ลดลงหลังลบ `StorageViz` — แก้ตัวเลข `6` เป็นจำนวนที่เทสต์รายงาน เทสต์อื่นที่แดงเพราะอ้าง storage ให้ลบเฉพาะส่วนที่อ้างหน้านั้น
Expected: ผ่านทั้งหมด ยกเว้นเทสต์แดงเดิม 1 ตัวที่มีอยู่ก่อนบน `main` (เทียบด้วย `git stash; bun test:run` ถ้าไม่แน่ใจ)

- [ ] **Step 6: ตรวจ static + ของค้าง**

Run: `bun run typecheck && bun run lint && rg -n "system-admin/storage|StorageUsageCard|StorageViz" --glob '!docs/**' --glob '!.trail/**' --glob '!.remember/**' .`
Expected: typecheck/lint ผ่าน · rg เหลือบรรทัดเดียวคือ redirect ใน `routes/router.tsx`

- [ ] **Step 7: Commit**

```bash
git add -A routes constant components hooks messages
git commit -m "refactor(system-admin): ลบหน้า Storage ให้เหลือหน้า Document หน้าเดียว"
```

---

### Task 3: ตรวจหน้าจริง

**Files:** ไม่มี (แก้เฉพาะสิ่งที่ตรวจเจอ)

- [ ] **Step 1: ห้าขนาดจอ สองธีม**

`VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` ล็อกอิน admin (BU T02) เปิด `/system-admin/document` ที่ 390 / 768 / 1366 / 1920 / 3840 ทั้งธีมสว่างและมืด
ผ่านเมื่อ: ไม่มีข้อความทับกันหรือล้นกล่อง, แถบโควตาเรียงลงเมื่อกล่องแคบ, ปุ่มวัดใหม่กับ Upload อยู่บรรทัดเดียวบนมือถือ, ตารางไม่กระตุกตอนโหลด, ไม่มี scrollbar ซ้อน

- [ ] **Step 2: Review Focus ทั้งห้าข้อ**

1. บล็อก request `storage-usage` ใน DevTools → เหลือบรรทัดแจกแจง ไม่มี error
2. BU ที่ไม่มีไฟล์ → เห็นแถบโควตา ตารางว่างปกติ
3. บัญชีที่ไม่มี `system_admin.view` → ไม่มีปุ่มวัดใหม่
4. กดวัดใหม่สองครั้งติด → ปุ่มปิด มี tooltip `measureTooSoon` ไม่มี toast
5. เปิด Sheet "ดูทั้งหมด" แล้วสลับ BU → Sheet ปิด ไม่เด้งเอง

- [ ] **Step 3: ทางเข้าเก่า**

- เปิด `/system-admin/storage` ตรง ๆ → ไปหน้า Document, กด Back ไม่วนกลับ
- เมนูซ้ายและ landing ของ System Admin ไม่มี Storage และไม่มีหัวกลุ่ม Data ว่าง
- ลิงก์ในแบนเนอร์เตือนโควตา (ถ้า BU ทดสอบมีแบนเนอร์) พาไปหน้า Document

- [ ] **Step 4: Commit สิ่งที่แก้จากการตรวจ (ถ้ามี) แล้วรัน `trail check`**
