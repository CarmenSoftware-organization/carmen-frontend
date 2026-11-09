---
title: "FE ย้าย lookup 20 ตัวไป GET /api/:bu/lookup/:resource"
author: Thammanoon
date: 2026-11-09
id: l-93b51cf7
scope: repo
status: active
touches:
  - "components/lookup/lookup-location.tsx#LookupLocation"
  - "components/lookup/lookup-user-location.tsx#LookupUserLocation"
  - "hooks/use-lookup-resource.ts#assertExtraFields"
  - "hooks/use-lookup-resource.ts#useLookupResource"
  - "hooks/use-user-location.ts#useUserLocation"
---

## Decided
2026-10-07: merge ครบทั้งสองเฟสแล้ว (merge commit ทุกใบ, branch ลบแล้ว)
- เฟส 1 FE #257 (`9917dac9` บน main): 11 lookup ย้ายไป `useLookupResource` (useInfiniteQuery + `?ids=`), debounce 400ms, prefetch 5 แถว
- เฟส 2 BE #787 (`703ebb3fe`): registry มี `extra` (ฟิลด์เพิ่มวางแบน) + `filters` (enum/uuid guard → ค่าผิดได้ 200 ว่าง ไม่ใช่ 500); product ใช้ `product_status_type` (ตัด inactive+discontinued); เพิ่ม `notification_template`; gateway whitelist filter ตาม catalog; jest `lookup-catalog.spec.ts` กัน catalog↔registry หลุดซิงก์
- เฟส 2 FE #258: อีก 9 ตัว (tax_profile, currency, credit_term, recipe_category, product, sub_category, noti-tmpl, location, user-location) + `serverFilter` + `assertExtraFields` (backend เก่า = lookup ว่าง)

**Why:** user อยากใช้ lookup endpoint แทน list เต็ม + ค้นฝั่ง server

## Watch out
- **ยังไม่ deploy ที่ไหนเลย** — deploy BE #787 ก่อน FE ทุก env ไม่งั้น lookup ที่มี extra ว่างหมด (ดูเหมือน "ไม่มีข้อมูล" ไม่ใช่ error); curl `/lookup/unit` ด้วย x-app-id จริงต้องได้ 200 ก่อน ไม่งั้น user โดน logout (new-api-name-401-logs-users-out)
- ส่ง filter เป็น `k:v1,v2;k2:v` ห้ามมี `|string` (gateway ตอบ 400)
- location: `LookupLocation` = scope all, `LookupUserLocation` = scope mine; department ต้องส่ง scope all
- แก้ exchange rate/currency/tax/credit term/location → invalidate prefix `LOOKUP_QUERY_ROOT` ("lookup") แล้ว; resource อื่นยังค้าง cache 60s
…

_From Claude Code's memory of this repo, last updated Oct 7._
