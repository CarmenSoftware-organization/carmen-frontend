# User Avatar Everywhere Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทุกจุดที่แสดงตัวย่อ/ไอคอนแทนคนคนหนึ่ง แสดงรูปโปรไฟล์จริงเมื่อคนนั้นมีรูป และกลับไปแสดงแบบเดิมเมื่อไม่มีรูปหรือโหลดไม่ได้

**Architecture:** Backend: ปลด stub `avatar: null` ใน `resolveByIds` (micro-cluster) ให้คืน file token แล้ว gateway แปลงเป็น presigned URL ที่จุดเดียว (`AvatarUrlService`) → audit enrichment ได้รูปทันที; ขยาย `@EnrichAuditUsers` ให้เติมรูปให้ฟิลด์ id ของคน (`people`) และให้ `/api/:bu_code/users` เติม `avatar_url` ผ่าน resolver ตัวเดิม Frontend: component กลาง `PersonAvatar` แล้วแทนที่ทุกจุดใน inventory

**Tech Stack:** NestJS gateway + microservices (Prisma), React 19 + Radix Avatar + Tailwind v4

**Spec:** `docs/superpowers/specs/2026-11-11-user-avatar-everywhere-design.md`

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (preference ของผู้ใช้) — แต่ทุก task ต้องผ่าน typecheck + lint และ spec เดิมที่เกี่ยวต้องเขียว
- ห้าม `avatar_file_token` หลุดออกนอก gateway — แปลงเป็น presigned URL ที่ gateway เสมอ, `expirySeconds: 3600`
- ไม่เพิ่ม endpoint / api_name ใหม่
- presign ในรายการ: ขนาน (`Promise.all`) + dedupe ตาม token; presign ล้มเหลว → `null` ไม่ throw
- ไม่มีรูป / โหลดรูปไม่ได้ → แสดงของเดิมของจุดนั้น (ตัวย่อ หรือไอคอน `User`) — ขนาด/ตำแหน่งเดิม
- รูปเป็นของตกแต่ง (ชื่ออยู่ข้าง ๆ แล้ว): `alt=""`
- FE: ห้ามตั้งสี/ขนาดตัวอักษรใหม่นอก token/ladder (`docs/DESIGN.md`); อ่านออกทั้ง light/dark
- Commit message ภาษาไทย; branch `feature/user-avatar-everywhere` ทั้ง 2 รีโป (แตกจาก `main`); BE ทั้งหมดเป็น PR เดียว
- deploy: BE ก่อน FE (FE ก่อนก็ไม่พัง — แค่ไม่มีรูป)

## Review Focus

1. **URL หมดอายุ (หน้าเปิดค้าง > 1 ชม.)** → `<img>` 403 ต้องตกไป fallback ไม่ใช่กรอบแตก — Radix `AvatarImage` จัดการเองเมื่อ `onerror`; ห้ามใช้ `<img>` ตรง ๆ ใน `PersonAvatar` (Task 4)
2. **ผู้ใช้ไม่มี profile / ไม่อยู่ใน `tb_user`** (platform user, id ผี) → resolver คืน `avatar: null` ไม่ throw, FE แสดงไอคอนเดิม (Task 1, 2)
3. **presign RPC ล่ม / micro-file ไม่ตอบ** → response หลักต้องยังมา (ชื่อยังมา) แค่ไม่มีรูป — `AvatarUrlService` กลืน error (Task 1)
4. **serializer strip ฟิลด์ใหม่เงียบ ๆ** (`*_avatar`, `avatar_url`) — ทุก task BE ต้อง curl ดู response จริงว่าฟิลด์ออกมา ไม่ใช่แค่ build ผ่าน (Task 2, 3)
5. **ชื่อว่าง/null** (`formatName('', '')`) → fallback ต้องไม่ว่างเปล่า: ถ้าตัวย่อว่างให้แสดงไอคอน `User` (Task 4)

---

## Backend — `carmen-turborepo-backend`

### Task 1: ปลด stub รูปใน `resolveByIds` + `AvatarUrlService` กลาง

**Files:**
- Modify: `apps/micro-cluster/src/cluster/user/user.service.ts` (`resolveByIds` ≈ L1202–1245) — select `avatar_file_token` จาก `tb_user_profile` (relation เดียวกับที่ใช้หา firstname อยู่แล้ว) และคืน `avatar: <token> | null` (ชื่อฟิลด์ใน RPC คงเป็น `avatar` — แต่ค่าคือ **token** ไม่ใช่ URL; ใส่ comment บอก)
- Create: `apps/backend-gateway/src/common/enrichment/avatar-url.service.ts`
- Modify: `apps/backend-gateway/src/common/enrichment/user-name-resolver.service.ts` — แปลง token → URL ก่อน `cache.set`
- Modify: `apps/backend-gateway/src/common/enrichment/enrichment.module.ts` — provide + export `AvatarUrlService`
- Modify: `apps/backend-gateway/src/config/config_users/config_users.service.ts` — `resolveAvatarUrl` เรียก `AvatarUrlService` แทนโค้ดซ้ำ (ทำได้ถ้า module inject ได้ไม่ยุ่ง; ถ้ายุ่งข้ามได้)

**Interfaces:**
- Produces: `AvatarUrlService.toUrl(token: string | null | undefined): Promise<string | null>` และ `AvatarUrlService.toUrls(tokens: Array<string | null | undefined>): Promise<Map<string, string | null>>` (dedupe + `Promise.all`, key = token)
- Produces: `UserNameResolverService.resolveMany(ids)` คืน `UserDisplay.avatar` เป็น **presigned URL** หรือ `null` (สัญญาเดิม ไม่เปลี่ยน type)

- [ ] **Step 1:** สร้าง branch `feature/user-avatar-everywhere` จาก `main` (เช็ค `git status` สะอาดก่อน)
- [ ] **Step 2:** implement `AvatarUrlService` — RPC `Files.presignedUrl` `{ fileToken, expirySeconds: 3600 }`, status ≠ 200 หรือ throw → `null` (ยกแบบจาก `config_users.service.ts#resolveAvatarUrl`)
- [ ] **Step 3:** micro-cluster `resolveByIds` คืน token; gateway resolver: รวบ token ของ `missing` ทั้งชุดเรียก `toUrls` ครั้งเดียว แล้วใส่ URL ลง `UserDisplay` (cache TTL 60s < อายุ URL 1 ชม. — คงไว้)
- [ ] **Step 4:** รัน spec เดิม: `bun run test -- apps/backend-gateway/src/common/enrichment` (หรือคำสั่ง test ของ workspace gateway) — Expected: เขียวทั้งหมด (แก้ mock ใน spec ถ้า constructor เปลี่ยน — ไม่เพิ่มเคสใหม่)
- [ ] **Step 5:** typecheck/build gateway + micro-cluster ตาม skill `build-and-turbo` ของรีโป — Expected: ผ่าน
- [ ] **Step 6:** ยืนยันด้วยมือ: local gateway (:4000 → dev DB) ด้วยบัญชีที่มีรูป เปิด comment ของเอกสาร: `curl` endpoint comment list แล้วเห็น `audit.created.avatar` เป็น URL (ไม่ใช่ token) และ URL เปิดรูปได้
- [ ] **Step 7:** Commit `feat(avatar): resolveByIds คืนรูปผู้ใช้ + AvatarUrlService แปลง token เป็น presigned URL`

### Task 2: `@EnrichAuditUsers({ people })` — รูปของฟิลด์ id คน บนเอกสาร + activity log

**Files:**
- Modify: `apps/backend-gateway/src/common/decorators/enrich-audit-users.decorator.ts` — option ใหม่ `people?: string[]`
- Modify: context type ของ `enrichAuditUsersStorage` (`common/context/enrich-audit-users.context.ts`) ให้ถือ `people`
- Modify: `apps/backend-gateway/src/common/enrichment/audit-shape.ts` + `enrichment.service.ts` — รวม id จาก `people` เข้า `resolveMany` ชุดเดียวกับ audit id แล้วเขียนรูป
- Modify (ใส่ `people` บน route): `application/purchase-requests/…controller.ts` (detail), `purchase-orders` (detail), `good-received-notes` (detail ≈ L157), `store-requisitions` (detail ≈ L156), `activity-logs` (`@Get()` L68, `entity/:entity_type`, `record/:entity_id`) + route ที่หน้า user-activity ใช้ (หาจาก `routes/system-admin/user-activity/` ฝั่ง FE)
- Modify: serializer ของ response เหล่านั้น ถ้ามันตัดฟิลด์ที่ไม่รู้จัก (เช็คด้วย curl ก่อน — Step 4)

**Interfaces:**
- Produces: กติกาเขียนรูปของ `people` (ต่อ target แต่ละตัวที่ `paths` เลือก):
  - entry ลงท้าย `_id` (เช่น `requestor_id`) → เขียน `<base>_avatar` (`requestor_avatar`) ระดับเดียวกัน
  - entry ลงท้าย `.id` (เช่น `requestor.id`) → เขียน `avatar` ลง object นั้น (`requestor.avatar`)
  - ไม่มีรูป → **ไม่เขียนฟิลด์** (FE อ่านเป็น `undefined`)
- ฟิลด์ที่ FE จะอ่าน (Task 6 ใช้): PR `requestor_*`, PO `buyer_*`, GRN `received_by_*`, SR `requestor_*`, activity log `actor_avatar` — **รูปทรงจริง (แบน vs object) ยืนยันจาก response จริงใน Step 1** แล้วเขียนผลลงตารางท้าย task นี้ใน PR description

- [ ] **Step 1:** curl detail จริงบน dev ของ PR / PO / GRN / SR หนึ่งใบ (T02 — memory "T02 workflow test documents": PO20260500006, SR260800001) + activity log list แล้วจดว่า id ของ ผู้ขอ / ผู้ซื้อ / ผู้รับ / actor อยู่ที่ฟิลด์ไหน (หลัง flat→object migration อาจเป็น `requestor.id`)
- [ ] **Step 2:** implement `people` ใน decorator/context/enrichment ตามกติกาข้างบน — ไม่กระทบ route ที่ไม่ส่ง `people`
- [ ] **Step 3:** ใส่ `people` บน route ใน Files (ใช้ฟิลด์จาก Step 1)
- [ ] **Step 4:** curl ซ้ำ Step 1 — Expected: เห็น `*_avatar` / `.avatar` เป็น URL สำหรับคนที่มีรูป; ถ้าหาย = serializer strip → เพิ่มฟิลด์ใน schema (gateway และ micro ถ้ามี)
- [ ] **Step 5:** spec เดิมของ enrichment + controller ที่แตะ เขียว; typecheck/build ผ่าน
- [ ] **Step 6:** Commit `feat(avatar): EnrichAuditUsers เติมรูปให้ฟิลด์ผู้ขอ/ผู้ซื้อ/ผู้รับ/actor`

### Task 3: `/api/:bu_code/users` เติม `avatar_url`

**Files:**
- Modify: `apps/backend-gateway/src/application/user/user.service.ts` (ตัวที่ `getAllUserInTenant` ของ controller ≈ L352 เรียก) — หลังได้รายการ เรียก `UserNameResolverService.resolveMany(user_ids)` แล้วตั้ง `avatar_url` ต่อแถว (`null` ถ้าไม่มี) — **ไม่แก้ micro-business** (`auth.service.ts` getAllUserInTenant) เพราะ resolver มี cache อยู่แล้ว
- Modify: `apps/backend-gateway/src/common/dto/user/user.serializer.ts` `UserListItemResponseSchema` (L111) เพิ่ม `avatar_url: z.string().nullable().optional()` — ถ้า Step 2 พบว่า schema นี้ไม่ได้คุม response จริง (FE ได้ `user_id` ทั้งที่ schema มีแค่ `id`) ก็ยังเพิ่มไว้ให้ swagger ตรง
- Modify: module ของ user ให้ import `EnrichmentModule` (ถ้ายังไม่มี)

**Interfaces:**
- Consumes: `UserNameResolverService.resolveMany` (Task 1)
- Produces: แต่ละแถวของ `/api/:bu_code/users` มี `avatar_url: string | null`

- [ ] **Step 1:** implement ตาม Files
- [ ] **Step 2:** curl `/api/T02/users?perpage=…` ด้วยบัญชี dev — Expected: แถวของคนที่มีรูปได้ `avatar_url` เป็น URL, ที่เหลือ `null`; จับเวลาเทียบก่อน/หลัง (ยอมรับได้ถ้าไม่ช้าขึ้นแบบรู้สึกได้ — เกิน ~300ms ให้บันทึกไว้ใน PR)
- [ ] **Step 3:** typecheck/build ผ่าน
- [ ] **Step 4:** Commit `feat(avatar): รายชื่อผู้ใช้ใน BU ส่ง avatar_url`
- [ ] **Step 5:** `trail check` → push → เปิด PR (ภาษาอังกฤษ) รวม Task 1–3 ระบุลำดับ deploy (BE ก่อน FE, ไม่มี migration, ไม่มี api_name ใหม่)

---

## Frontend — `carmen-frontend`

### Task 4: component กลาง `PersonAvatar`

**Files:**
- Create: `components/share/person-avatar.tsx`

**Interfaces:**
- Produces:
  ```ts
  interface PersonAvatarProps {
    readonly name?: string | null;          // ใช้ทำตัวย่อ (หรือส่ง first/last)
    readonly firstname?: string | null;
    readonly lastname?: string | null;
    readonly avatarUrl?: string | null;
    readonly fallback?: "initials" | "icon"; // default "initials"
    readonly className?: string;            // ขนาด/พื้น fallback มาจาก call site เดิม
    readonly fallbackClassName?: string;
  }
  export function PersonAvatar(props: PersonAvatarProps): JSX.Element
  ```
- ใช้ `Avatar` / `AvatarImage` / `AvatarFallback` จาก `components/ui/avatar.tsx`; ตัวย่อจาก `formatName` (`lib/name`); `fallback="icon"` → `<User />` จาก lucide ขนาดพอดีวง; ตัวย่อว่าง → ไอคอน (Review Focus 5); `AvatarImage alt=""`; `key={avatarUrl ?? "fallback"}` บน `Avatar` เพื่อ remount เมื่อ URL เปลี่ยน (แบบเดียวกับ `routes/profile/user-profile-details.tsx` L78)

- [ ] **Step 1:** implement
- [ ] **Step 2:** `bun run typecheck && bun run lint` — Expected: ผ่าน
- [ ] **Step 3:** Commit `feat(avatar): PersonAvatar component กลาง รูปโปรไฟล์ + fallback ตัวย่อ/ไอคอน`

### Task 5: Workflow config, ฟอร์มกำหนดผู้ใช้, comment sheet, status bar

**Files:**
- Modify: `types/workflows.ts` `User` — เพิ่ม `avatar_url?: string | null`
- Modify: `routes/system-admin/workflow/wf-stage-users.tsx` — ทั้ง `WfStageUsersView` และ `WfStageUsersEditor` ใช้ `PersonAvatar` (`className="size-7 shrink-0"`, fallbackClassName คงสีเดิม รวมสี assigned `bg-primary text-primary-foreground`) — ในโหมดดู ค่า merge จาก `byId` อยู่แล้ว จึงได้ `avatar_url` จากรายชื่อปัจจุบัน
- Modify: `routes/system-admin/user/user-assigned-ui.tsx` `UserAvatar` — รับ `avatarUrl?` แล้วใช้ `PersonAvatar` (size-16 เดิม) · `user-assigned-form.tsx` ส่ง `user.user.avatar_url` — **ตรวจก่อน** ด้วย network tab/curl ว่า endpoint ที่ฟอร์มนี้ใช้ส่ง `avatar_url` จริง; ถ้าไม่ส่ง ให้หยุดและรายงาน (ย้ายเป็นงาน BE)
- Modify: `components/ui/comment-sheet.tsx` ≈ L513 — วงกลม `size-5` + ไอคอน → `PersonAvatar fallback="icon" avatarUrl={c.audit?.created?.avatar}`; เพิ่ม `avatar?: string` ใน type audit ของ `CommentItem` ถ้ายังไม่มี
- Modify: `components/footer/status-bar.tsx` ≈ L143 — ไอคอน 12px → `PersonAvatar fallback="icon"` ขนาด `size-3` ด้วย `avatarUrl` จาก `useProfile()`

- [ ] **Step 1:** implement ตาม Files
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun test:run components routes/system-admin` — Expected: ผ่าน/เขียว
- [ ] **Step 3:** Commit `feat(avatar): รูปโปรไฟล์ใน workflow config, ฟอร์มผู้ใช้, comment และ status bar`

### Task 6: หัวเอกสาร PR / PO / GRN / CN / SR + activity log

**Files:**
- Modify header + form ที่ส่ง prop: `routes/procurement/purchase-request/pr-header.tsx` (+ `pr-form.tsx` L267), `purchase-order/po-header.tsx` (+ `po-form.tsx` L240), `goods-receive-note/grn-header.tsx` (+ `grn-form.tsx` L217), `credit-note/cn-header.tsx` (+ `cn-form.tsx` L252/L400), `store-operation/store-requisition/sr-header.tsx` (+ `sr-form.tsx` L243) — เพิ่ม prop `…Avatar?: string | null` คู่กับชื่อ แล้วแทน `<User className="size-3 …" />` ด้วย `PersonAvatar fallback="icon" className="size-3 shrink-0"`
  - แหล่งรูป: ฟิลด์จาก Task 2 (ดูตารางใน PR ของ BE); CN = `creditNote.audit?.created?.avatar`; **เอกสารใหม่ที่ยังไม่บันทึก** (ชื่อมาจาก profile) → `useProfile().avatarUrl`
- Modify: `types/purchase-request.ts`, `purchase-order.ts`, `goods-receive-note.ts`, `store-requisition.ts`, `activity-log.ts` — เพิ่มฟิลด์รูปแบบ optional ตามรูปทรงจาก Task 2
- Modify: `routes/system-admin/activity-log/activity-log-card.tsx` ≈ L65, `routes/system-admin/user-activity/user-activity-card.tsx` ≈ L61 — ไอคอน → `PersonAvatar fallback="icon" avatarUrl={log.actor_avatar}`; ตาราง `use-activity-log-table.tsx` ถ้ามีไอคอนคนในคอลัมน์ actor ทำแบบเดียวกัน
- ไม่แตะ: `from-price-list/step-summary.tsx` (ไม่มี `buyer_id` → คงไอคอน ตาม spec), dashboard badge, view-selector

**Interfaces:**
- Consumes: `PersonAvatar` (Task 4); ฟิลด์รูปจาก Task 2

- [ ] **Step 1:** implement ตาม Files
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun test:run routes/procurement routes/store-operation routes/system-admin` — Expected: ผ่าน/เขียว
- [ ] **Step 3:** Commit `feat(avatar): รูปผู้ขอ/ผู้ซื้อ/ผู้รับ/ผู้สร้างบนหัวเอกสาร และ actor ใน activity log`

### Task 7: ตรวจมือ + PR

- [ ] **Step 1:** `VITE_DEV_PROXY_TARGET=http://localhost:4000 bun dev` (gateway local ที่มี Task 1–3) ด้วยบัญชีที่มีรูป: workflow config (ดู+แก้), ฟอร์มกำหนดผู้ใช้, comment sheet ของ PR หนึ่งใบ, หัว PR/PO/GRN/CN/SR, activity log + user activity, status bar — ทั้ง light และ dark
- [ ] **Step 2:** บัญชีที่ไม่มีรูป → ตัวย่อ/ไอคอนเหมือนเดิมทุกจุด; จำลอง URL เสีย (แก้ URL ใน devtools ให้ 403) → ตก fallback ไม่มีกรอบแตก
- [ ] **Step 3:** `trail check` → push → เปิด PR (ภาษาอังกฤษ) ลิงก์ PR ของ BE และระบุ "deploy BE ก่อน"
