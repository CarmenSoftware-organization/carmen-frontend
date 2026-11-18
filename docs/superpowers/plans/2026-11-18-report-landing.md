# Report landing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** หน้า `/report` เป็น landing แบบเดียวกับ System Admin: หัวกะทัดรัด + การ์ด 3 ใบ ตัวเลขจาก API สิทธิ์จาก `useVisibleModules`

**Architecture:** ย้ายการ์ด หัวหน้า และตัวช่วยวาดเส้นของ System Admin ไป `components/share/landing/` ให้รับเนื้อหาเป็น props · System Admin ห่อบาง ๆ ใช้ชุดกลาง · `routes/report/report-landing.tsx` เขียนใหม่บนชุดกลาง

**Tech Stack:** React 19 + React Router 7 + TanStack Query + use-intl + Tailwind v4 (container queries)

**Spec:** `docs/superpowers/specs/2026-11-18-report-landing-design.md`

## Global Constraints

- ห้ามสร้างไฟล์ test ใหม่ (ความชอบของผู้ใช้) — แต่เทสต์ที่มีอยู่ต้องผ่าน และรัน `bun run typecheck` + `bunx eslint` ทุก task
- ห้าม import `routes/<A>/` → `routes/<B>/` (ESLint) — ของที่สองโมดูลใช้ร่วมอยู่ `components/share/landing/`
- ตัวเลขบนการ์ดมาจาก API เท่านั้น · โหลดอยู่/error = ไม่แสดงตัวเลข (ไม่ใช่ 0)
- สี/ขนาดจาก token เท่านั้น อ่านออกทั้ง light/dark · ห้ามขนาดตัวอักษรนอก ladder
- คำอธิบายการ์ด = `report.desc` · `reportSchedule.desc` · `reportHistory.desc` · ชื่อการ์ด = `modules.reportList|reportSchedule|reportHistory`
- กริดการ์ด: `grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]`

## Review Focus

- บัญชีที่ไม่มีสิทธิ์ History: การ์ดจาง กดแล้วเด้ง dialog และ **ไม่ยิง** `/reports/history` (ยิงแล้วได้ 403 ใน console) — Task 3 ส่ง `enabled: !blocked` ให้ hook ตัวเลข
- BU ที่ license `report.list` ถูก hide: ไม่มีการ์ดเลย หน้าต้องไม่ว่างเปล่าเงียบ ๆ → แสดง `EmptyComponent` ข้อความเดียว — Task 3
- schedules endpoint error (เช่น 500): การ์ดยังกดได้ แค่ไม่มีตัวเลข — Task 3
- System Admin หลังย้ายโค้ด: คอลัมน์ 1/2/3/4/6 ที่ 390/768/1366/1920/3840 เท่าเดิม และการ์ดล็อกยังเด้ง dialog — Task 2
- ภาษาไทย ICU plural: "{count, plural, other {# รายงาน}}" ไม่มี `{{}}` หรือ `<คำ>` (ไฟล์แปลพังทั้งหน้า) — Task 3

---

### Task 1: ชุด landing กลาง

**Files:**
- Create: `components/share/landing/landing-card.tsx`
- Create: `components/share/landing/landing-hero.tsx`
- Create: `components/share/landing/landing-viz.tsx`

**Interfaces:**
- Produces:
  - `LandingCard({ href: string; title: string; description: string; icon: LucideIcon; visual: ReactNode; stat?: ReactNode; access?: ModuleWithAccess }): JSX` — โครงจาก `routes/system-admin/landing-module-card.tsx` เดิมทั้งหมด (CARD class, ปุ่มจาง + `dispatchPermissionDenied`, Lock/ArrowRight) · `stat` แสดงใต้คำอธิบายเป็น `text-muted-foreground text-xs tabular-nums`
  - `LandingHero({ title: string; kicker?: string; lede: string }): JSX` — โครงจาก `routes/system-admin/landing-hero.tsx`
  - `landing-viz.tsx` export: `VIZ_WRAP` (string), `VIZ_ACCENT = "var(--primary)"`, `Line({ w, strong? })`, `ListViz({ rows, dot? })` — ย้ายตรงจาก `routes/system-admin/landing-visuals.tsx`
  - `type LucideIcon` export จาก `landing-card.tsx` (ย้ายจาก `landing-types.ts`)

- [ ] **Step 1:** สร้างสามไฟล์ตาม Interfaces (ย้ายโค้ด ไม่เปลี่ยน class)
- [ ] **Step 2:** `bun run typecheck` → ผ่าน (ยังไม่มีผู้ใช้ ก็ต้องคอมไพล์ได้)

### Task 2: System Admin ใช้ชุดกลาง

**Files:**
- Modify: `routes/system-admin/landing-module-card.tsx` — เหลือตัวห่อ: แปล `t(\`modules.${key}.name|one\`)` + `<ModuleVisual>` แล้วส่งให้ `LandingCard`
- Modify: `routes/system-admin/landing-hero.tsx` — ลบ; `system-admin-landing.tsx` เรียก `LandingHero` กลางด้วย `t("title")`, `t("kicker")`, `t("lede")`
- Modify: `routes/system-admin/landing-visuals.tsx` — ลบ `Line`/`ListViz`/`VIZ_WRAP`/`ACCENT` ในไฟล์ แล้ว import จาก `@/components/share/landing/landing-viz`
- Modify: `routes/system-admin/landing-types.ts` — `LucideIcon` re-export หรือ import จากกลาง
- Modify: `components/ui/type-ladder.test.ts` — `ALLOWED_SUB_10PX`: ลดค่า `routes/system-admin/landing-visuals.tsx` ตามจำนวนที่ย้ายออก · เพิ่ม `components/share/landing/landing-viz.tsx` ด้วยจำนวนที่ย้ายเข้า · ต่อหมายเหตุประวัติในคอมเมนต์

**Interfaces:**
- Consumes: Task 1 ทั้งหมด

- [ ] **Step 1:** แก้ไฟล์ตามรายการ
- [ ] **Step 2:** `bun test:run components/ui/type-ladder.test.ts routes/system-admin` → PASS
- [ ] **Step 3:** `bun run typecheck && bunx eslint routes/system-admin components/share/landing` → ไม่มี error
- [ ] **Step 4:** เบราว์เซอร์ `/system-admin`: จำนวนคอลัมน์ (ค่า `left` ที่ต่างกันของ section) = 1/2/3/4/6 ที่ 390/768/1366/1920/3840 และหน้าตาการ์ดเหมือนก่อนแก้
- [ ] **Step 5:** Commit `refactor(landing): ย้ายการ์ด หัวหน้า และตัวช่วยวาดเส้นของ landing ไป components/share/landing`

### Task 3: Report landing ใหม่

**Files:**
- Modify (เขียนใหม่ทั้งไฟล์): `routes/report/report-landing.tsx`
- Create: `routes/report/report-landing-visuals.tsx` — `ReportListViz`, `ReportScheduleViz`, `ReportHistoryViz` (เส้นล้วน ใช้ `Line`/`ListViz`/`VIZ_WRAP`; ป้ายในภาพมีได้เฉพาะคำที่อยู่บนหน้าจริง เช่นชื่อวัน, ห้ามชื่อ/เลข/เวลาแต่ง)
- Modify: `messages/en.json`, `messages/th.json` — ลบ `report.intro` ทั้งก้อน · เพิ่ม `report.landing`: `kicker`, `lede`, `countReports`, `countSchedules`, `countRuns` (ICU plural), `noAccess`
- Modify: `components/ui/type-ladder.test.ts` — ลบบรรทัด `"routes/report/report-landing.tsx": 1`

**Interfaces:**
- Consumes: `LandingCard`, `LandingHero` (Task 1) · `useVisibleModules(subModules)` จาก `@/hooks/use-visible-modules` · `useReportTemplates({ page: 1, perpage: 1 })` (`@/routes/report/shared/use-report` → import แบบ relative `./shared/use-report`) · `useReportSchedules()` (`./schedules/use-report-schedule`) · `useReportHistory({ page: 1, perpage: 1 }, { enabled })` (`./history/use-report-history`)

- [ ] **Step 1:** เพิ่ม option `enabled` ให้ `useReportTemplates` (options) และ `useReportSchedules(options?: { enabled?: boolean })` แบบเดียวกับ `useReportHistory` — default true ผู้เรียกเดิมไม่กระทบ
- [ ] **Step 2:** เขียน `report-landing.tsx`:
  - `REPORT_SUBS = moduleList.find(m => m.path === "/report")?.subModules ?? []` → `useVisibleModules(REPORT_SUBS)` → map path→access · การ์ดที่ path ไม่อยู่ในรายการที่มองเห็น = ไม่แสดง
  - การ์ดละหนึ่ง `CardStat` component ภายในที่เรียก hook ของตัวเองด้วย `enabled: !blocked` · คืน `null` ระหว่างโหลด/error
  - ไม่มีการ์ดเลย → `EmptyComponent` + `t("landing.noAccess")`
  - root `<div className="w-full">` ไม่มี padding ของตัวเอง (gutter มาจาก shell)
- [ ] **Step 3:** ไฟล์แปล en/th — ไทย: "{count, plural, other {# รายงาน}}", "{count, plural, other {# กำหนดการ}}", "{count, plural, other {# ครั้งที่รัน}}"
- [ ] **Step 4:** `bun test:run components/ui/type-ladder.test.ts routes/report` → PASS · `bun run typecheck && bunx eslint routes/report components/share/landing` → ไม่มี error · `grep -rn "report.intro" routes components messages` → ว่าง
- [ ] **Step 5:** เบราว์เซอร์ตาม `verify.md` §Landing pages: 390/768/1366/1920/3840 · การ์ดกว้าง 280–400px · ไม่ล้น · ไทย · dark · ตัวเลขตรงกับ total บนหน้า list/schedules/history จริง · network ไม่มี request ที่ 403
- [ ] **Step 6:** Commit `feat(report): หน้า landing รายงานแบบเดียวกับ System Admin ตัวเลขจาก API` พร้อม spec และ plan
