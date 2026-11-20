# Refresh token ตอน server ล่ม — ไม่เตะผู้ใช้ออก

วันที่: 2026-11-20 · ขนาด: งานเล็ก แตะ 3 รีโป (carmen-frontend, micro-keycloak, carmen-turborepo-backend)

## เจตนา

ผู้ใช้โดนเด้งไปหน้า login เมื่อ access token หมดอายุในช่วงที่ server ล่ม ทั้งที่ session ยังไม่หมดจริง
เป้าคือแยก "refresh token ถูกปฏิเสธ" (ต้อง login ใหม่) ออกจาก "ติดต่อ server ไม่ได้" (รอแล้วลองใหม่)

## สาเหตุ (ตรวจในโค้ดแล้ว)

1. FE ระหว่างใช้งาน — `lib/http-client.ts:271` เรียก `tokenStore.clear()` ทุกครั้งที่ refresh ไม่สำเร็จ
   แม้ `doRefresh` จะตั้งใจเก็บ session ไว้เมื่อ network/5xx → `RequireAuth` พาไป `/login`
2. FE ตอน boot — `main.tsx:46` refresh ไม่ผ่านเพราะ server ล่ม → ไม่มี token → `/login`
3. Backend — `micro-keycloak` `keycloak.controller.ts` `handleRefreshToken` แปลงทุก error เป็น
   `UNAUTHENTICATED` (401) รวมถึงต่อ Keycloak ไม่ได้ / Keycloak 5xx และ `micro-business`
   `auth.service.ts` `refreshToken` แปลงทุก non-200 (รวม transport failure ของ micro-keycloak) เป็น 401
   → FE `clearSession()` ลบ refresh token ทิ้งจริง

## เป้าหมาย / ไม่ใช่เป้าหมาย

- เป้าหมาย: server/Keycloak ล่ม → ผู้ใช้ไม่เสีย session; reload ระหว่างล่ม → เห็นหน้า "ติดต่อเซิร์ฟเวอร์ไม่ได้"
  ที่ลองใหม่เอง แล้วกลับเข้าหน้าเดิมเมื่อ server กลับมา
- ไม่ใช่เป้าหมาย: proactive refresh ก่อน token หมดอายุ, ประสาน refresh ข้ามแท็บ (rotation)
- Anti-goal: refresh token ที่ถูกปฏิเสธจริง (หมดอายุ/ถูก revoke) ต้องยังพาไป login เหมือนเดิม —
  ห้ามให้ผู้ใช้ค้างอยู่หน้า outage ตลอดไปเพราะ token เสีย

## Approaches

1. **(เลือก)** สถานะ "ติดต่อไม่ได้" ใน auth layer — `refreshTokens()` คืนผล 3 แบบ, `RequireAuth`
   แสดงหน้า outage เต็มจอแทน `Navigate` ไป login ครอบทั้ง boot และกลางคัน, ใช้ i18n/dark mode/design system ได้
2. retry loop ใน `main.tsx` ก่อน render — แก้น้อยกว่า แต่ช่วยเฉพาะ reload และเป็น HTML ดิบไม่มี i18n/theme
3. (ฝั่ง backend มีทางเดียว) แยก status ตามสาเหตุที่ต้นทาง แล้วส่งต่อไม่แปลง

## Design

### Backend

- **micro-keycloak** `KeycloakService.refreshToken`: Keycloak ตอบ 400/401 → error แบบ auth (คง
  `UNAUTHENTICATED` 401); fetch throw หรือ Keycloak ≥500 → error แบบ unavailable → controller
  ตอบ 503 (`SERVICE_UNAVAILABLE` หรือ ErrorCode ที่มีอยู่แล้วที่ map เป็น 503 — builder เลือก)
- **micro-business** `AuthService.refreshToken`: status จาก micro-keycloak เป็น ≥500 → ส่ง status นั้นต่อ
  (ไม่แปลงเป็น 401); 4xx → 401 เหมือนเดิม; บัญชีระบบ → 401 เหมือนเดิม; catch block (500) คงเดิม
- gateway ไม่ต้องแก้ (`throw new HttpException(response.response, status)` ส่ง status ต่ออยู่แล้ว)

### Frontend

- `lib/auth/auth-api.ts`: `refreshTokens()` คืน `"ok" | "rejected" | "unreachable"` (mutex เดิมคงไว้)
  - `rejected` = 400/401/403 หรือ body ไม่มี access_token → `clearSession()` (เหมือนเดิม)
  - `unreachable` = network/timeout/5xx/429 → เก็บ refresh token ไว้ ไม่แตะ access token
  - ไม่มี refresh token ใน storage → `rejected` (ไม่ต้องล้างอะไร)
- สถานะ `unreachable` เก็บใน store เล็ก ๆ ที่ subscribe ได้ (ต่อจาก `token-store.ts` หรือไฟล์ใหม่ข้าง ๆ — builder เลือก)
  ล้างเมื่อ refresh สำเร็จหรือถูกปฏิเสธ
- `lib/http-client.ts` 401 branch: `ok` → retry เหมือนเดิม; `rejected` → ล้าง + throw 401 "Session expired"
  เหมือนเดิม; `unreachable` → **ไม่** `tokenStore.clear()` throw `ApiError` แบบ network/unavailable
  (ไม่ใช่ 401) ให้ toast/`offline-banner` เดิมแสดง ผู้ใช้อยู่หน้าเดิม 401 ครั้งถัดไปลอง refresh ใหม่เอง
  (legacy shim ข้อความ "permission" คงไว้)
- `main.tsx`: ไม่ต้องเปลี่ยน flow — boot ได้ `unreachable` แล้ว render ต่อ
- `components/auth/require-auth.tsx`: ไม่มี token + สถานะ `unreachable` → render หน้า outage
  เต็มจอแทน `Navigate` (ไม่มี token + ไม่ unreachable → `/login` เหมือนเดิม)
- หน้า outage (component ใหม่ใน `components/auth/`): หัวข้อ "ติดต่อเซิร์ฟเวอร์ไม่ได้", ข้อความ
  "กำลังลองใหม่อัตโนมัติ", ปุ่ม "ลองใหม่"; ลองเอง `refreshTokens()` ทุก ~10 วินาที (หยุดเมื่อ unmount)
  สำเร็จ → token เข้า store → `RequireAuth` render หน้าเดิม; ถูกปฏิเสธ → ไป `/login` ตามปกติ
  ใช้ primitive จาก `components/ui/` · ข้อความผ่าน i18n (th/en) · อ่านออกทั้งสองธีม
- WebSocket (`hooks/use-notification.ts`) รับค่าคืนใหม่ของ `refreshTokens()` (เดิมใช้เป็น boolean)

```
┌──────────────────────────────────────┐
│     ⚠ ติดต่อเซิร์ฟเวอร์ไม่ได้              │
│     กำลังลองใหม่อัตโนมัติ…               │
│              [ ลองใหม่ ]               │
└──────────────────────────────────────┘
```

### Deploy

ลำดับไม่บังคับ — แต่ละรีโปขึ้นก่อนได้โดยไม่พัง ปัญหาหายครบเมื่อขึ้นครบ 3 รีโป
(FE อย่างเดียว: แก้กรณี gateway ล่ม; BE อย่างเดียว: กรณี Keycloak ล่มได้ 503 ซึ่ง FE เดิมเก็บ refresh token ไว้แล้ว
แต่ยังเด้ง login จนกว่า FE จะขึ้น)

## ปล่อยให้ builder

- ชื่อ ErrorCode/status mapping ที่ใช้จริงใน micro-keycloak, ตำแหน่ง store สถานะ, ชื่อคีย์ i18n,
  ช่วงเวลาลองใหม่ (~10 วินาที)
- ตรวจ caller อื่นของ `refreshTokens()` ทั้งหมด (`trail callers refreshTokens`) ให้รับค่าคืนแบบใหม่
