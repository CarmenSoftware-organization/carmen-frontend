# ธีมสีให้ผู้ใช้เลือก — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ผู้ใช้เลือกธีมสีจาก 6 ธีม (Classic · Blue Glass · Emerald · Teal · Violet · Graphite) จากเมนูโปรไฟล์ โดย Blue Glass ได้กระจกเฉพาะ sidebar/navbar บนพื้นไล่โทนน้ำเงิน

**Architecture:** ธีมคือ class `theme-<id>` บน `<html>` (Classic ไม่มี class) ที่ override token สีใน CSS ไฟล์ใหม่ ตั้งค่าก่อน paint แรกใน inline script เดิมของ `index.html` และตั้งซ้ำใน `main.tsx` — mirror pattern ของ `lib/font-scale.ts` ทุกประการ ธีมแกนนี้อิสระจาก `next-themes` (light/dark)

**Tech Stack:** React 19 · Tailwind v4 (oklch token ใน CSS) · next-themes · use-intl · Vitest

**Spec:** `docs/superpowers/specs/2026-11-26-theme-color-presets-design.md`

## Global Constraints

- ID ธีม (ลำดับนี้ในเมนู): `classic` · `blue-glass` · `emerald` · `teal` · `violet` · `graphite` — ค่าตั้งต้น `classic`
- localStorage key: `carmen.color-theme` · class: `theme-<id>` · `classic` ไม่มี class
- ทุกธีมต้องมีค่า `:root`-level (light) และ `.dark` (dark) ครบ
- ธีมเปลี่ยนเฉพาะ: `--primary` `--primary-foreground` `--ring` `--sidebar-primary` `--sidebar-primary-foreground` `--sidebar-ring` `--chart-1` — **ห้ามแตะ** `--success` `--warning` `--destructive` `--info` `--status-*`
- `--primary` คู่ `--primary-foreground` ผ่าน WCAG AA (≥ 4.5:1) ทุกธีมทั้งสองโหมด
- Blue Glass light `--primary` = `#0154bd` (เขียนเป็น oklch ได้) · โหมดมืดต้องมีโทน navy ไม่ใช่ดำล้วน
- กระจก (`backdrop-filter`) เฉพาะ `.space-sidebar-gradient` / `.space-navbar-gradient` — card / DataGrid / form / dialog / popover ทึบเสมอ
- ห้ามประกาศ `--spacing-md/sm/lg/xl/2xl` · ห้ามตั้งสีที่ call site · ขนาดตัวอักษรตาม ladder (เมนูใช้ `text-xs` เหมือน `ThemeSwitch`)
- ข้อความ UI ทุกคำผ่าน i18n (`messages/en.json` + `messages/th.json` namespace `common`) · ห้ามมี `{}` หรือ `<คำ>` ในข้อความแปล
- **ไม่เขียน test ใหม่** (ตาม CLAUDE.md ของ user) — แต่ test เดิมต้องผ่าน โดยเฉพาะ `lib/__tests__/security-headers.test.ts`
- Commit message ภาษาไทย

## Review Focus

1. **CSP hash** — แก้ inline script ใน `index.html` แล้วลืมอัปเดต hash ใน 4 ไฟล์ = สคริปต์ถูกบล็อกเฉพาะ production; `security-headers.test.ts` ต้องผ่าน (Task 1 Step 4)
2. **รายชื่อธีมใน inline script drift จาก `COLOR_THEMES`** — ไม่มี test ดัก (ตัดสินใจไม่เขียน test ใหม่) ตรวจด้วยตาตอน review; เสนอ user ทีหลังว่าจะเพิ่ม test แบบ font-scale ไหม
3. **localStorage มีค่าขยะ/ธีมที่ถูกลบ** (เช่น `"rose"`) — ต้อง fallback เป็น `classic` ทั้งใน inline script และ `readStoredColorTheme()`
4. **storage ใช้ไม่ได้** (private mode) — `try/catch` ทั้งอ่านและเขียน มีผลแค่ session นี้ ไม่ throw
5. **Blue Glass + dark + font-scale biggest** และหน้าตารางยาว — ตาราง/การ์ดยังทึบ อ่านออก ไม่กระตุกตอน scroll (ตรวจมือ Task 4)

---

### Task 1: โมดูลธีม + boot ก่อน paint แรก

**Files:**
- Create: `lib/color-theme.ts`
- Modify: `index.html` (inline script เดิม — เพิ่มบล็อกที่สองใน `<script>` เดียวกัน อย่าแยก tag ใหม่)
- Modify: `main.tsx:15` (ถัดจาก `applyScale(readStoredScale());`)
- Modify: hash ใน `docker/30-render-security-headers.sh`, `vercel.json`, `scripts/setup-gcs-cdn.sh`, `scripts/cloudfront-security-headers.sh`

**Interfaces:**
- Produces (`lib/color-theme.ts`):
  - `export const COLOR_THEMES = ["classic","blue-glass","emerald","teal","violet","graphite"] as const`
  - `export type ColorTheme = (typeof COLOR_THEMES)[number]`
  - `export const DEFAULT_COLOR_THEME: ColorTheme = "classic"`
  - `export const COLOR_THEME_STORAGE_KEY = "carmen.color-theme"`
  - `export function readStoredColorTheme(): ColorTheme` — ค่าไม่รู้จัก/อ่านไม่ได้ → `classic`
  - `export function applyColorTheme(theme: ColorTheme): void` — ลบ `theme-*` ทุกตัวที่รู้จักออกจาก `<html>`, เติม `theme-<id>` ถ้าไม่ใช่ classic, เขียน localStorage ใน try/catch

- [ ] **Step 1:** เขียน `lib/color-theme.ts` ตาม Interfaces — โครงเดียวกับ `lib/font-scale.ts` (type guard `isColorTheme`, comment ไทยสั้น ๆ ว่า classic ไม่มี class)
- [ ] **Step 2:** ใน `index.html` เพิ่มในสคริปต์เดิม: อ่าน `carmen.color-theme` ถ้าอยู่ใน `["blue-glass","emerald","teal","violet","graphite"]` ให้ `classList.add("theme-" + t)` ห่อ try/catch แยกจากบล็อก font-scale; เพิ่ม comment ว่ารายชื่อซ้ำกับ `COLOR_THEMES` ใน `lib/color-theme.ts`
- [ ] **Step 3:** `main.tsx` เพิ่ม `applyColorTheme(readStoredColorTheme());` ใต้ `applyScale(...)`
- [ ] **Step 4:** รัน `bun test:run lib/__tests__/security-headers.test.ts` → FAIL บอก hash ที่ขาด; แทน hash เดิมของ inline script ด้วยค่าใหม่ใน 4 ไฟล์ (คำนวณตาม `cspHashesOfInlineScripts` — base64 sha256 ของเนื้อใน tag) รันซ้ำ → PASS
- [ ] **Step 5:** `bun test:run lib/__tests__/font-scale.test.ts` → PASS (regex `\[...\]\.indexOf\(s\)` ต้องยังจับ array ของ font-scale — ในบล็อกธีมใช้ตัวแปรชื่ออื่น เช่น `t` และ `.indexOf(t)` เพื่อไม่ให้ regex ไปจับผิดตัว)
- [ ] **Step 6:** `bun run typecheck` → ไม่มี error
- [ ] **Step 7:** Commit `git add lib/color-theme.ts index.html main.tsx docker/ vercel.json scripts/ && git commit -m "feat(theme): โมดูลธีมสีและตั้ง class ก่อน paint แรก"`

### Task 2: token ของ 6 ธีม + กระจกของ Blue Glass

**Files:**
- Create: `styles/color-themes.css`
- Modify: `styles/globals.css:6` เพิ่ม `@import "./color-themes.css";` ถัดจาก `module-colors.css`

**Interfaces:**
- Consumes: class `theme-<id>` จาก Task 1
- Produces: selector `html.theme-<id>` (light) และ `html.dark.theme-<id>` (dark) สำหรับ `blue-glass` `emerald` `teal` `violet` `graphite`

- [ ] **Step 1:** แต่ละธีม override ชุด token ใน Global Constraints ทั้งสองโหมด ค่า oklch เลือกเอง แต่ hue โดยประมาณ: emerald ~160 · teal ~195 · violet ~295 · graphite chroma ≈ 0.02 (เทาอมน้ำเงิน) · blue-glass light = `#0154bd`; ตรวจ contrast primary/primary-foreground ≥ 4.5:1 ทุกคู่ (คำนวณด้วยสคริปต์ชั่วคราวใน scratchpad หรือ DevTools — ไม่ commit)
  - selector ต่อธีม (ใช้ได้ทั้งบน `<html>` และบน div ซ้อนใน สำหรับ Task 4): light `html.theme-x, .theme-x` · dark `html.dark.theme-x, .dark .theme-x`
    — `html.theme-x` `(0,1,1)` ชนะ `:root` `(0,1,0)` แม้ไฟล์นี้ถูก `@import` ก่อน; `html.dark.theme-x` `(0,2,1)` ชนะทั้ง `.dark` และ `html.theme-x`; บน div ซ้อน ค่าที่ประกาศบน element ชนะค่าที่ inherit มาเสมอ
- [ ] **Step 2:** Blue Glass เพิ่ม:
  - `html.theme-blue-glass .space-main-gradient` → พื้นไล่โทนน้ำเงินอ่อน (light: tint `#e5efff` → ขาว; dark: navy `#1c4988`-ish → เข้มเกือบดำ)
  - `.space-sidebar-gradient` / `.space-navbar-gradient` → พื้นขาว/navy โปร่ง (alpha ~0.55–0.75) + `backdrop-filter: blur(8–12px)` + `-webkit-backdrop-filter` + เส้นขอบโปร่ง
  - กระจกจะเห็นได้ต่อเมื่อมีพื้นไล่สีอยู่ข้างหลัง — ถ้า sidebar/navbar ไม่ได้ซ้อนบน `.space-main-gradient` ให้ตั้งพื้นไล่สีที่ `body` ของธีมนี้แทน (ตรวจ DOM ใน `routes/root-layout.tsx` ก่อน)
  - `--sidebar-accent` / `--sidebar-border` ของธีมนี้ปรับให้อ่านออกบนพื้นโปร่ง
- [ ] **Step 3:** `bun test:run lib/__tests__ components/ui/type-ladder.test.ts` → PASS (status-ink-contrast ต้องไม่เปลี่ยน)
- [ ] **Step 4:** Commit `git add styles/ && git commit -m "feat(theme): token สีของ 6 ธีม และกระจกเฉพาะโครงหน้าจอของ Blue Glass"`

### Task 3: ตัวเลือกธีมในเมนูโปรไฟล์

**Files:**
- Create: `components/navbar/color-theme-switch.tsx`
- Modify: `components/navbar/user-profile.tsx:126-127` และ `:251-252` — วาง `<ColorThemeSwitch />` ระหว่าง `<ThemeSwitch />` กับ `<FontScaleSwitch />` ทั้งสองจุด
- Modify: `messages/en.json`, `messages/th.json` (namespace `common` ถัดจาก `themeSystem`)

**Interfaces:**
- Consumes: `COLOR_THEMES`, `ColorTheme`, `DEFAULT_COLOR_THEME`, `applyColorTheme`, `readStoredColorTheme` จาก Task 1
- Produces: `export function ColorThemeSwitch()`

- [ ] **Step 1:** i18n keys (en / th):
  - `colorTheme`: "Color theme" / "ธีมสี"
  - `colorThemeClassic`: "Classic" / "Classic"
  - `colorThemeBlueGlass`: "Blue Glass" / "Blue Glass"
  - `colorThemeEmerald`: "Emerald" / "มรกต"
  - `colorThemeTeal`: "Teal" / "เขียวน้ำทะเล"
  - `colorThemeViolet`: "Violet" / "ม่วง"
  - `colorThemeGraphite`: "Graphite" / "กราไฟต์"
- [ ] **Step 2:** เขียน `ColorThemeSwitch` mirror `FontScaleSwitch`: state เริ่มจาก "ธีมที่ใช้อยู่ใน tab นี้" อ่านจาก class บน `<html>` (fallback `readStoredColorTheme()`), `DropdownMenuSub` + `DropdownMenuSubTrigger` (ไอคอน `Palette` จาก lucide-react) + item `role="menuitemradio"` `aria-checked` + `Check` ตัวที่เลือก, class ของ item ตาม `ThemeSwitch` (`gap-2 rounded-md px-2 py-2 text-xs`)
  - ภาพตัวอย่างต่อธีม: วงกลม `size-4 rounded-full border` พื้นเป็นสี primary ของธีมนั้น — ใช้ค่าคงที่ map `ColorTheme → hex` ภายในไฟล์ (แบบ `LIGHT`/`DARK` ใน `theme-switch.tsx`) เพราะ token จริงของธีมอื่นอ่านจาก CSS ไม่ได้ขณะยังไม่ได้เลือก; Blue Glass วาดไล่สี `#0154bd → #4cabe0`
- [ ] **Step 3:** `bun run typecheck && bun run lint` → ไม่มี error (ESLint boundary: `components/` ห้าม import จาก `routes/`)
- [ ] **Step 4:** Commit `git add components/navbar/ messages/ && git commit -m "feat(theme): เมนูเลือกธีมสีในโปรไฟล์"`

### Task 4: ตัวอย่างใน /design-system + ตรวจมือ

**Files:**
- Create: `routes/design-system/sections/color-themes.tsx`
- Modify: `routes/design-system/design-system.route.tsx` (ลงทะเบียน section ตามแบบ section อื่น ๆ)

**Interfaces:**
- Consumes: `COLOR_THEMES` จาก Task 1, class `theme-<id>` จาก Task 2

- [ ] **Step 1:** section แสดงการ์ดหนึ่งใบต่อธีม — ห่อแต่ละใบด้วย `<div className={id === "classic" ? "" : `theme-${id}`}>` ให้ token cascade ภายในใบ (selector ของ Task 2 รองรับไว้แล้ว) แสดงปุ่ม primary, input ที่ focus (ring), sidebar item active จำลอง; กระจกของ Blue Glass ไม่ต้องจำลองในใบ; ไม่ผ่าน i18n (dev tool ตาม CLAUDE.md)
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun test:run` → ผ่านทั้งหมด (ยกเว้น test ที่แดงบน main อยู่แล้ว — บันทึกไว้)
- [ ] **Step 3:** ตรวจมือใน `bun dev` (หรือเสนอ user ตรวจ): ทั้ง 6 ธีม × light/dark — ปุ่มหลัก, sidebar item ที่ active, focus ring, กราฟ dashboard; Blue Glass: กระจกเห็นจริงที่ sidebar/navbar, ตารางยาว (เช่น `/config/chart-of-account-mapping`) ทึบและ scroll ลื่น; รีโหลดแล้วไม่กะพริบ; ใส่ค่าขยะใน `localStorage["carmen.color-theme"]` แล้วรีโหลด → Classic
- [ ] **Step 4:** Commit `git add routes/design-system/ && git commit -m "feat(design-system): ตัวอย่างธีมสีทั้ง 6 ธีม"`
