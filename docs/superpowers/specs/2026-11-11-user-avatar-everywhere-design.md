# แสดงรูปโปรไฟล์ผู้ใช้ทุกจุดที่มีไอคอน/ตัวย่อของคน

วันที่: 2026-11-11 · รีโป: carmen-frontend + carmen-turborepo-backend

## เจตนา

ผู้ใช้อัปโหลดรูปโปรไฟล์ได้แล้ว (หน้า `/profile`) แต่รูปขึ้นแค่ 3 จุด — เมนูผู้ใช้บน navbar,
หน้า profile และ BU switcher ที่เหลือทั้งแอปยังเป็นวงกลมตัวย่อชื่อหรือไอคอนคนทั่วไป
ผู้ใช้ต้องการ: **ตรงไหนมีไอคอน/ตัวย่อแทนคนคนหนึ่ง และคนนั้นมีรูป → แสดงรูป ทุกที่**
จุดตั้งต้นที่ผู้ใช้เห็นปัญหาคือหน้า workflow config (ผู้ใช้ในแต่ละ stage)

## เป้าหมาย

- ทุกจุดในรายการด้านล่างแสดงรูปจริงเมื่อคนนั้นมีรูป
- ไม่มีรูป / URL หมดอายุ / โหลดรูปไม่ได้ → กลับไปแสดงสิ่งที่แสดงอยู่วันนี้ (ตัวย่อ หรือไอคอน) ไม่มีกรอบว่าง
- ขนาดและตำแหน่งเดิมทุกจุด — เปลี่ยนแค่ "สิ่งที่อยู่ในวงกลม"

## ไม่ใช่เป้าหมาย

- ไม่ทำระบบอัปโหลดรูปใหม่ / ไม่แก้หน้า profile
- ไม่แตะไอคอนคนที่ไม่ได้หมายถึงคนใดคนหนึ่ง: badge "ของฉัน/ทั้งหมด" บน dashboard
  (`routes/dashboard/status-group-card.tsx`), saved view (`components/list-filter/view-selector.tsx`),
  ไอคอนเมนู Profile ใน dropdown navbar
- ไม่ใช่ BU/cluster avatar (มีอยู่แล้ว)

## Anti-goals

- ห้ามส่ง `avatar_file_token` ดิบออกนอก gateway — แปลงเป็น presigned URL ที่ gateway เสมอ
  (แบบเดียวกับ `config_users.service.ts#hydrateAvatar`)
- ห้ามทำให้ list endpoint ช้าลงแบบเห็นได้ชัด (presign ทีละคนแบบ serial ในรายการยาว)
- ห้ามกรอบรูปแตก/ว่างเมื่อ URL หมดอายุ (presigned อายุ 1 ชม. หน้าที่เปิดค้างไว้นาน ๆ จะเจอแน่)

## สภาพปัจจุบัน (ตรวจแล้ว)

- **ต้นเหตุหลัก:** micro-cluster `apps/micro-cluster/src/cluster/user/user.service.ts` `resolveByIds`
  (≈ L1202–1245) คืน `avatar: null` ตายตัวเป็น stub ทั้งที่ pipeline ฝั่ง gateway รองรับแล้ว:
  `common/enrichment/user-name-resolver.service.ts` (`UserDisplay { name, avatar }`, cache LRU TTL 60s)
  → `enrichment.service` เขียนลง `audit.created/updated/deleted.avatar`
  (`common/dto/_shared/audit/audit.dto.ts` มีฟิลด์ `avatar?: string`, มี spec ทดสอบ pass-through แล้ว)
- presign: `Files.presignedUrl` RPC `{ fileToken, expirySeconds: 3600 }` — ตัวอย่างใน
  `apps/backend-gateway/src/config/config_users/config_users.service.ts#resolveAvatarUrl`
- รายชื่อผู้ใช้ `GET /api/:bu_code/users` (`application/user/user.controller.ts` ≈ L352,
  serializer `UserListItemResponseSchema` ใน `common/dto/user/user.serializer.ts` L111) **ไม่มีรูป**
- FE primitive: `components/ui/avatar.tsx` (Radix `Avatar`/`AvatarImage`/`AvatarFallback` —
  Radix แสดง fallback เองเมื่อรูปโหลดไม่ได้), ตัวย่อชื่อใช้ `formatName` จาก `lib/name`

## จุดที่ต้องเปลี่ยน (inventory)

| # | จุด | ไฟล์ FE | วันนี้แสดง | รูปมาจาก |
|---|-----|---------|-----------|----------|
| 1 | Workflow config — ผู้ใช้ใน stage (ดู + แก้) | `routes/system-admin/workflow/wf-stage-users.tsx` | วงกลมตัวย่อ 28px | **BE ต้องเพิ่ม** `avatar_url` ใน `/api/:bu_code/users` |
| 2 | ฟอร์มกำหนดผู้ใช้ (หัวฟอร์ม) | `routes/system-admin/user/user-assigned-ui.tsx` `UserAvatar` ← `user-assigned-form.tsx` | วงกลมตัวย่อ 64px | น่าจะมีแล้ว: `UserAccount.avatar_url` (`types/user.ts`) จาก config-user endpoint ที่ `hydrateAvatar` — **ต้องยืนยันของจริง** |
| 3 | Comment sheet (ทุกเอกสาร) | `components/ui/comment-sheet.tsx` ≈ L513 | ไอคอน User ในวงกลม 20px | `c.audit.created.avatar` — ได้เองเมื่อแก้ `resolveByIds` |
| 4 | Activity log card + ตาราง | `routes/system-admin/activity-log/activity-log-card.tsx`, `use-activity-log-table.tsx` | ไอคอน User 12px | `actor_id` — **ยังไม่มีรูป** ต้องเติมฝั่ง BE |
| 5 | User activity card | `routes/system-admin/user-activity/user-activity-card.tsx` | ไอคอน User 12px | เหมือน #4 |
| 6 | หัวเอกสาร PR / PO / GRN / CN / SR (ชื่อผู้ขอ/ผู้ซื้อ/ผู้รับ/ผู้สร้าง) | `pr-header.tsx`, `po-header.tsx`, `grn-header.tsx`, `cn-header.tsx`, `sr-header.tsx` | ไอคอน User 12px | ชื่อมาจากฟิลด์ชื่อ denormalized บนเอกสาร — **ยังไม่มีรูป** |
| 7 | PO from price list — step summary (ผู้ซื้อ) | `routes/procurement/purchase-order/from-price-list/step-summary.tsx` ≈ L159 | ไอคอน User | `values.buyer_name` (ค่าในฟอร์ม) — ไม่มีรูป |
| 8 | Status bar (ตัวเอง) | `components/footer/status-bar.tsx` ≈ L143 | ไอคอน User 12px | มีแล้ว: `useProfile()` → `avatar_url` |

ถ้า builder เจอจุดอื่นระหว่างทำ (ไอคอน/ตัวย่อที่แทนคนคนหนึ่ง) ให้รวมเข้ามาด้วยตามเกณฑ์เดียวกัน

## ทางที่ตัดสินแล้ว

**Backend (carmen-turborepo-backend)**

1. `resolveByIds` ใน micro-cluster คืน avatar file token ของ `tb_user_profile` แทน `null`
   แล้ว gateway (`UserNameResolverService`) แปลง token → presigned URL ก่อนเก็บลง cache / คืนค่า
   — token ต้องไม่หลุดเข้า response ผลคือ #3 และทุกที่ที่อ่าน `audit.*.avatar` ได้รูปพร้อมกัน
   (cache TTL 60s สั้นกว่าอายุ URL 1 ชม. จึงไม่มี URL หมดอายุค้างใน cache)
2. `/api/:bu_code/users` เพิ่ม `avatar_url: string | null` ใน response (micro ส่ง token +
   gateway presign + เพิ่มฟิลด์ใน `UserListItemResponseSchema` — ทั้ง micro และ gateway serializer
   ต้องแก้ ไม่งั้นฟิลด์ถูก strip เงียบ ๆ)
3. #4–#6 ต้องมีทางให้ FE ได้รูปของ actor / ผู้ขอ / ผู้ซื้อ / ผู้รับ / ผู้สร้าง — ใช้
   `UserNameResolverService` ตัวเดิมเป็นแหล่งเดียว (ไม่ทำ presign ซ้ำอีกที่)
4. presign ในรายการทำแบบขนาน (`Promise.all`) และ dedupe ตาม token

**Frontend (carmen-frontend)**

1. component กลางตัวเดียวใน `components/share/` (ชื่อเสนอ `person-avatar.tsx`) รับ
   `name` (หรือ first/last) + `avatarUrl?: string | null` + ขนาด ใช้ primitive `components/ui/avatar.tsx`
   — มีรูป → `AvatarImage`, ไม่มี/โหลดไม่ได้ → fallback แบบเดิมของจุดนั้น (ตัวย่อ หรือไอคอน User)
2. แทนที่ทุกจุดในตาราง inventory ด้วย component นี้ ขนาดเดิมทุกจุด (รวมไอคอน 12px บนหัวเอกสาร —
   ผู้ใช้เลือกแล้วให้เป็นรูปขนาดเดิม)
3. รูปเป็นของตกแต่ง ชื่อแสดงข้าง ๆ อยู่แล้ว → `alt=""` / `aria-hidden`
4. เพิ่ม `avatar_url?: string | null` ใน type `User` (`types/workflows.ts`) และ `avatar?: string` ใน
   type audit ที่ comment ใช้ (ถ้ายังไม่มี)
5. ใช้ได้ทั้ง light/dark (ขอบ/พื้น fallback ใช้ token เดิม ไม่ตั้งสีใหม่)

**ลำดับ deploy:** backend ก่อน FE ได้ แต่ FE ก่อนก็ไม่พัง (ไม่มีรูป = fallback) — ไม่มี api_name ใหม่
ถ้า builder เพิ่ม endpoint ใหม่สำหรับ #4–#6 ต้องเติม api_name ใน allowlist ของ app-id ทุก env ก่อน FE
ไม่งั้นผู้ใช้โดน logout (ดู memory "api_name ใหม่ = user โดน logout")

**ความเป็นส่วนตัว (ผู้ใช้ตัดสินแล้ว):** ทุกคนใน BU เห็นรูปของกันและกันได้ — ใครเห็นชื่อในเอกสาร /
comment / activity ก็เห็นรูปได้ ยอมรับว่า presigned URL อายุ 1 ชม. เป็นลิงก์ที่ใครถือก็เปิดได้
(builder ยังต้องเช็คว่า `Files.presignedUrl` ยอม presign token ของผู้ใช้คนอื่นได้ ไม่ติดเช็ค owner)

## การตัดสินของผู้ออกแบบ (ผู้ใช้ยังไม่ได้ยืนยันทีละข้อ — ทวนได้)

- **#4–#6 ใช้ enrichment เดิม ไม่เพิ่ม endpoint/api_name ใหม่** — ขยาย enrichment ให้ resolve
  ฟิลด์ id ของคน (`requestor_id` / `buyer_id` / `received_by_id` / ผู้สร้าง CN / `actor_id`) แล้วเติม
  `*_avatar` (หรือรูปทรงที่ builder เลือก) ลง response ของ PR/PO/GRN/CN/SR detail + activity-log +
  user-activity ยอมแลกกับพื้นที่แก้ BE ที่กว้างกว่า เพื่อตัดความเสี่ยง allowlist → logout
  — ต้องแก้ serializer ทั้งชั้น micro (ถ้ามี) และ gateway ไม่งั้นฟิลด์ถูก strip
  (`UserNameResolverService` วันนี้ถูกใช้แค่โดย audit enrichment / `audit-user-sort`)
- actor ที่ resolve ไม่เจอ (เช่นผู้ใช้ระดับ platform ที่ไม่อยู่ใน `tb_user` ที่ `resolveByIds` อ่าน) →
  แสดงไอคอนเดิม ไม่ต้องหาแหล่งอื่น
- #7 (PO from price list): ถ้าค่าในฟอร์มไม่มี `buyer_id` → คงไอคอนเดิม ไม่ต้อง lookup
- #2: builder ตรวจของจริงว่า endpoint ที่ `user-assigned-form` ใช้ส่ง `avatar_url` แล้วหรือยัง
  ถ้ายัง ย้ายเข้างาน BE
- `/users` ยาว: presign ทุกแถวแบบขนาน + dedupe token แล้ววัดเวลาจริงบน dev; ถ้าช้าแบบเห็นได้ค่อยคิดใหม่
- BE ทั้งหมดเป็น PR เดียว (micro + gateway ขึ้นพร้อมกัน)

## ปล่อยให้ builder ตัดสิน

- รูปทรงฟิลด์รูปใน response ของ #4–#6 (ชื่อฟิลด์, แบนหรือ object)
- รูปเป็น presigned 1 ชม.: ปล่อยให้ fallback ของ Radix จัดการ URL หมดอายุ หรือ refetch — เลือกเอง
  ขอแค่ไม่มีกรอบแตก
- ชื่อ/prop ของ component กลาง, การรวม `UserAvatar` ใน `navbar/user-profile.tsx` เข้ากับตัวกลาง (ทำได้ถ้าไม่เปลี่ยนหน้าตา)
- ไม่ต้องเขียนเทสต์ใหม่ (ตาม preference ของผู้ใช้) — แต่ typecheck + lint ต้องผ่าน และเทสต์เดิมต้องเขียว

## ยืนยันด้วยมือ (หลังทำ)

ด้วยบัญชีที่มีรูปโปรไฟล์บน dev: workflow config (ดู+แก้), comment sheet ของเอกสารหนึ่งใบ,
activity log, หัว PR/PO/GRN/CN/SR, status bar — และบัญชีที่ไม่มีรูปต้องเห็นตัวย่อ/ไอคอนเหมือนเดิม
