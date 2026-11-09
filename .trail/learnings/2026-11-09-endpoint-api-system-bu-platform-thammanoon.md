---
title: Endpoint บางตัวใต้ api-system/ เสิร์ฟแอป BU ไม่ใช่หน้าจอ platform
author: Thammanoon
date: 2026-11-09
id: l-4df42520
scope: repo
status: active
touches:
  - "lib/__tests__/security-headers.test.ts#read"
---

## Decided
`api-system/` **ไม่ได้แปลว่า "สำหรับผู้ดูแลแพลตฟอร์มเท่านั้น"** มีหลาย endpoint ใต้ prefix นี้ที่
แอปฝั่ง BU เรียกใช้ และผู้ใช้ BU **ไม่มีสิทธิ์ระดับ platform สักตัว** (`report_template.read`,
`news.read` ฯลฯ อยู่กับ Platform Admin / Support Manager / Support Staff เท่านั้น — ดู
`seed.platform-role-permission.data.ts`) การใส่ `@RequirePlatformPermission` ทับจึงล็อกผู้ใช้
ทุกคนออกทันที ไม่ใช่แค่ "กันคนนอก"

ที่รู้แล้ว — คุมด้วย `AppIdGuard` อย่างเดียวโดยตั้งใจ ส่วนใหญ่อยู่ใน allowlist ของ
`packages/prisma-shared-schema-platform/prisma/check.api-system-permission-coverage.ts` พร้อมเหตุผล:
- `GET api-system/report-templates/forms` → dropdown Print Forms ของ `/system-admin/default-setting`
- `GET api/news`, `/tags`, `/:id`, `/summary` → mobile-app
- `GET api-system/platform/feature-flags` → ทุกหน้าจอต้องอ่านเพื่อรู้ว่าจะเรนเดอร์อะไร
- `GET api-system/business-units/:id/avatar|logo` → AppIdGuard เดี่ยวตั้งแต่ต้น (ไม่ได้อยู่ใน allowlist)

**Why:** คอมมิต `72fbd8ef1` (9 ส.ค. 2026) ไล่ปิด `MISSING_DECORATOR: 7 → 0` ของ report-templates
แบบเหมาเข่ง ทำหน้า Default Setting พังเงียบไปเดือนกว่า — checker เขียวแต่ผู้ใช้เข้าไม่ได้ เพราะ
checker วัดว่า "มี decorator ไหม" ไม่ได้วัดว่า "ใครเรียก endpoint นี้จริง" แก้แล้ว 21 ก.ย. 2026:
BE #649 (ถอด guard + allowlist entry) · FE #167 (`silentForbidden` ไม่ให้ 403 ของ lookup เด้ง
modal ทับทั้งหน้า) — **ทั้งคู่ merge เข้า main แล้ว ยังไม่ deploy · BE ต้องขึ้นก่อน FE**

## Watch out
ก่อนใส่ platform permission ให้ endpoint ใต้ `api-system/` ให้ grep path นั้นใน
`carmen-inventory-frontend-react/constant/api-endpoints.ts` และ `carmen-inventory-mobile` ก่อน
ถ้ามีผู้เรียกฝั่ง BU ให้เพิ่ม allowlist entry พร้อมเหตุผลแทนการใส่ guard · อย่าอ่านว่า
"checker เขียว = ปลอดภัย" ดู print-form-config-shipped · permission-key-audit-against-db ·
license-feature-hide-runtime

_From Claude Code's memory of this repo, last updated Sep 21._
