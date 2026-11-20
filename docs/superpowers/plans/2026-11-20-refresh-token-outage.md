# Refresh token ตอน server ล่ม — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** refresh ที่ล้มเพราะ server/Keycloak ล่ม ต้องไม่ลบ session และไม่พาผู้ใช้ไปหน้า login

**Architecture:** backend แยก status ตามสาเหตุ (token ถูกปฏิเสธ = 401, ติดต่อ Keycloak ไม่ได้ = 503)
FE แยกผล refresh เป็น `ok | rejected | unreachable` เก็บสถานะ unreachable ใน store เล็ก ๆ ให้
`RequireAuth` แสดงหน้า outage ที่ลองใหม่เองแทน `Navigate` ไป login

**Tech Stack:** NestJS microservices (`@repo/nest-result`), React 19 + React Router 7 + use-intl, Vitest

**Spec:** `docs/superpowers/specs/2026-11-20-refresh-token-outage-design.md`

## Global Constraints

- **ไม่เขียน test ใหม่** (ความต้องการของ user) — แต่ test ที่มีอยู่ต้องผ่าน แก้ expectation ของ test เดิมที่พังเพราะ signature เปลี่ยนได้
- ทุก task จบด้วย typecheck + lint + test suite เดิมของรีโปนั้น แล้ว commit (commit message ภาษาไทย)
- branch ชื่อ `fix/refresh-token-outage` ในทั้ง 3 รีโป (FE มีแล้ว; อีก 2 รีโปแตกจาก `main`)
- refresh token ที่ถูกปฏิเสธจริง (Keycloak 400/401) ต้องยังเป็น 401 → FE ล้าง session → `/login` เหมือนเดิม
- ข้อความ UI ผ่าน i18n ทั้ง `messages/en.json` และ `messages/th.json` — ห้ามใส่ `{}` หรือ `<คำ>` ในข้อความ
- UI ใหม่ต้องอ่านออกทั้ง light/dark ใช้ primitive จาก `components/ui/` ไม่ตั้งสี/ขนาดใหม่ (`docs/DESIGN.md`)

## Review Focus

1. Refresh token หมดอายุจริงตอน server ปกติ → ต้องไป `/login` ไม่ใช่ค้างหน้า outage (Task 3 `rejected` ล้าง flag unreachable)
2. หลาย request ได้ 401 พร้อมกันขณะ server ล่ม → refresh ยิงครั้งเดียว (mutex เดิม) ไม่มี request ไหนล้าง token
3. หน้า outage ลองเองซ้อนกับการกดปุ่ม → ไม่ยิง refresh ซ้อน (mutex เดิมครอบ) และ timer ถูกล้างตอน unmount
4. ไม่มี refresh token ใน storage เลย (ผู้ใช้ไม่เคย login) → `rejected` → `/login` ทันที ไม่โชว์หน้า outage
5. micro-keycloak เองล่ม (rpc transport failure) → micro-business ต้องส่ง 5xx ต่อ ไม่ใช่ 401

---

### Task 1: micro-keycloak — ติดต่อ Keycloak ไม่ได้ตอบ 503

**Repo:** `../micro-keycloak` (แตก `fix/refresh-token-outage` จาก `main`)

**Files:**
- Modify: `src/keycloak/keycloak.service.ts` `refreshToken` (~บรรทัด 794–830)
- Modify: `src/keycloak/keycloak.controller.ts` `handleRefreshToken` (~บรรทัด 178–200)

**Interfaces:**
- Produces: RPC `keycloak-auth.refresh` ตอบ `response.status` = 401 เมื่อ Keycloak ตอบ 400/401; = 503 เมื่อ fetch throw หรือ Keycloak ≥500 (หรือ status อื่นที่ไม่ใช่ 400/401)

- [ ] **Step 1:** ใน `KeycloakService.refreshToken` ห่อ `fetch` ด้วย try/catch — fetch throw → throw error ที่ระบุว่า unavailable; `!response.ok` แยก: status 400/401 → throw error แบบเดิม (auth), อื่น ๆ → throw แบบ unavailable ใช้ `class KeycloakUnavailableError extends Error` ประกาศในไฟล์ service (export)
- [ ] **Step 2:** ใน `handleRefreshToken` catch: `error instanceof KeycloakUnavailableError` → `Result.error(new AppError(message, ErrorCode.INTERNAL, undefined, { http_status: HttpStatus.SERVICE_UNAVAILABLE }))`; อื่น ๆ คง `ErrorCode.UNAUTHENTICATED` เดิม (base controller ใช้ `error.http_status` ก่อน ErrorCode — ดู `node_modules/@repo/nest-result/dist/base-microservice-controller.js:105`)
- [ ] **Step 3:** รัน typecheck/lint/test ของรีโป (ดูคำสั่งใน `package.json`) — Expected: ผ่าน (spec เดิมของ refresh ที่ assert 401 ตอน fetch ล้มให้แก้เป็น 503)
- [ ] **Step 4:** commit `fix(auth): refresh ตอบ 503 เมื่อติดต่อ Keycloak ไม่ได้ แยกจาก token ถูกปฏิเสธ`

### Task 2: micro-business — ส่ง 5xx ของ refresh ต่อ ไม่แปลงเป็น 401

**Repo:** `../carmen-turborepo-backend` (แตก `fix/refresh-token-outage` จาก `main`)

**Files:**
- Modify: `apps/micro-business/src/authen/auth/auth.service.ts` `refreshToken` (~บรรทัด 2014–2027)

**Interfaces:**
- Consumes: Task 1 — status 503 จาก `KeycloakAuth.refresh`; rpc-client transport failure คืน envelope status ≥500 (`packages/rpc-client/src/rpc-error.ts:163`)
- Produces: `Auth.refreshToken` ตอบ status ≥500 ตามที่ได้รับเมื่อ upstream ≥500; 4xx → 401 เหมือนเดิม (gateway `throw new HttpException(..., status)` ส่งต่อเองไม่ต้องแก้)

- [ ] **Step 1:** ใน branch `status !== OK`: ถ้า `status >= 500` คืน `{ response: { status, message } }` ตามเดิม status; ไม่งั้นคง 401 เดิม · กรณีบัญชีระบบและ catch block (500) ไม่แตะ
- [ ] **Step 2:** `bun run --filter micro-business typecheck` (หรือคำสั่งเทียบเท่าใน `package.json`) + lint + test ของ micro-business — Expected: ผ่าน
- [ ] **Step 3:** commit `fix(auth): refresh ส่ง 5xx จาก Keycloak ต่อแทนการแปลงเป็น 401`

### Task 3: FE — ผล refresh 3 แบบ + ไม่ล้าง token เมื่อติดต่อไม่ได้

**Repo:** carmen-frontend (branch `fix/refresh-token-outage`)

**Files:**
- Create: `lib/auth/auth-reachability-store.ts`
- Modify: `lib/auth/auth-api.ts:307-354` (`refreshTokens`, `doRefresh`)
- Modify: `lib/http-client.ts:246-273` (401 branch)
- Modify: `hooks/use-app-status.ts:76`, `hooks/use-notification.ts:225`, คอมเมนต์ `main.tsx:46`
- Modify (expectation เดิมเท่านั้น): `lib/auth/__tests__/auth-api.test.ts`, `lib/http-client.test.ts`

**Interfaces:**
- Produces:
  - `export type RefreshResult = "ok" | "rejected" | "unreachable"` และ `refreshTokens(): Promise<RefreshResult>` ใน `auth-api.ts`
  - `authReachabilityStore: { get(): boolean; set(unreachable: boolean): void; subscribe(listener: () => void): () => void }` — `get()` = true แปลว่าครั้งล่าสุดติดต่อ server ไม่ได้ (รูปเดียวกับ `token-store.ts`)

- [ ] **Step 1:** สร้าง `auth-reachability-store.ts` ตาม Interfaces (เริ่มต้น `false`, notify เฉพาะเมื่อค่าเปลี่ยน)
- [ ] **Step 2:** `doRefresh` คืน `RefreshResult`:
  - ไม่มี refresh token → `"rejected"` (ไม่ต้อง clear)
  - fetch throw / timeout / status อื่นที่ไม่ใช่ 400/401/403 (5xx, 429) → `authReachabilityStore.set(true)`, คืน `"unreachable"` ไม่แตะ token ใด ๆ
  - 400/401/403 หรือ body ไม่มี `access_token` → `clearSession()` + `set(false)` → `"rejected"`
  - สำเร็จ → `set(false)` ก่อน `tokenStore.set(...)` → `"ok"`
  - mutex `refreshPromise` คงเดิม (เปลี่ยนแค่ type)
- [ ] **Step 3:** `http-client.ts` 401 branch: `"ok"` → retry เดิม; `"unreachable"` → **ไม่** `tokenStore.clear()`, `throw new ApiError(ERROR_CODES.BACKEND_UNAVAILABLE, "Server unreachable", 503, true)`; `"rejected"` → ทางเดิม (legacy "permission" shim แล้ว clear + 401 "Session expired") · retry ที่ได้ 401 ซ้ำ (`isRetry`) คงทางเดิม
- [ ] **Step 4:** caller อื่น: `use-app-status.ts:76` → `(await refreshTokens()) === "ok"`; `use-notification.ts:225` → `... || (await refreshTokens()) === "ok"`; คอมเมนต์ `main.tsx:46` ให้บอกว่า unreachable → RequireAuth แสดงหน้า outage
- [ ] **Step 5:** แก้ expectation ใน test เดิมที่ assert ค่า boolean / การ clear token ตอน 5xx ให้ตรงพฤติกรรมใหม่ (ห้ามเพิ่ม test case ใหม่)
- [ ] **Step 6:** `bun run typecheck && bun run lint && bun test:run lib hooks` — Expected: ผ่านทั้งหมด
- [ ] **Step 7:** commit `fix(auth): refresh ล้มเพราะ server ล่มไม่ล้าง session อีกต่อไป`

### Task 4: FE — หน้า "ติดต่อเซิร์ฟเวอร์ไม่ได้" ใน RequireAuth

**Files:**
- Create: `components/auth/server-unreachable-screen.tsx`
- Modify: `components/auth/require-auth.tsx`
- Modify: `messages/en.json`, `messages/th.json` (namespace `auth` → คีย์ใหม่ `serverUnreachable`)

**Interfaces:**
- Consumes: Task 3 — `authReachabilityStore`, `refreshTokens(): Promise<RefreshResult>`
- Produces: `export function ServerUnreachableScreen(): JSX.Element`

- [ ] **Step 1:** i18n `auth.serverUnreachable`: `title` = "Can't reach the server" / "ติดต่อเซิร์ฟเวอร์ไม่ได้", `description` = "Retrying automatically…" / "กำลังลองใหม่อัตโนมัติ…", `retry` = "Retry" / "ลองใหม่"
- [ ] **Step 2:** `ServerUnreachableScreen`: เต็มจอ กึ่งกลาง ไอคอน `ServerOff` (lucide), หัวข้อ, คำอธิบาย, `Button` "ลองใหม่" (disabled + spinner ระหว่างลอง); `useEffect` ตั้ง `setInterval` 10_000 ms เรียก `refreshTokens()` ล้างตอน unmount; ปุ่มเรียก `refreshTokens()` ทันที · ไม่ต้อง navigate เอง — ผล `ok` ทำให้ token เข้า store แล้ว `RequireAuth` render children, ผล `rejected` ทำให้ flag เป็น false แล้ว `RequireAuth` พาไป login
- [ ] **Step 3:** `RequireAuth`: subscribe `authReachabilityStore` ด้วย `useSyncExternalStore`; ไม่มี token + unreachable → `<ServerUnreachableScreen />`; ไม่มี token + ไม่ unreachable → `Navigate` เดิม
- [ ] **Step 4:** `bun run typecheck && bun run lint && bun test:run components lib` — Expected: ผ่าน (รวม `type-ladder.test.ts`, `status-ink-contrast.test.ts`, `components/auth/__tests__/require-auth.test.tsx`)
- [ ] **Step 5:** commit `feat(auth): หน้าติดต่อเซิร์ฟเวอร์ไม่ได้ ลองใหม่เองแทนการเด้งไป login`

### Task 5: ตรวจมือ (ไม่ใช่ test อัตโนมัติ)

- [ ] `bun dev` → login → DevTools block request `*/api/auth/refresh-token` (หรือ Offline) → ลบ access token ด้วย reload → เห็นหน้า outage ไม่ใช่ login · ปลด block → กลับหน้าเดิมภายใน ~10 วิ
- [ ] ระหว่างใช้งาน: ทำให้ access token ใช้ไม่ได้ + block refresh → request ขึ้น toast ผู้ใช้อยู่หน้าเดิม
- [ ] ลบ `carmen.refresh_token` ใน localStorage แล้ว reload → ไป `/login` ทันที
- [ ] เช็คหน้า outage ทั้ง light/dark และภาษาไทย
