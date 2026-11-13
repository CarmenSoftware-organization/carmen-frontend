---
title: "หน้า Ask AI: provider เป็นช่องในกริดเต็มความกว้างจอ ตัวที่ขยายกินเต็มแถว (แทนแบบหนึ่งแถวต่อ provider)"
author: Thammanoon
date: 2026-11-12
branch: feature/ask-ai-compact
cost: { minutes: 15, tokens: 122064 }
id: l-d698bf96
scope: repo
status: active
replaces: l-f4ef0513
src: agent
touches:
  - components/share/compact-section.tsx
  - routes/system-admin/company-profile/company-profile-component.tsx
  - routes/system-admin/company-profile/company-profile-ui.tsx
  - routes/system-admin/default-setting/default-setting-component.tsx
  - routes/system-admin/ask-ai/ask-ai-provider-card.tsx
  - routes/system-admin/ask-ai/ask-ai-component.tsx
---

## Decided
- 2026-11-12 ผู้ใช้สั่งจัดหน้า `/system-admin/ask-ai` ตามกติกา skill `carmen-blue-ui-design` (เต็มความกว้างจอ, จอกว้างขึ้น = คอลัมน์มากขึ้น, กะทัดรัด) จึงเปลี่ยนจาก "หนึ่งแถวเต็มความกว้างต่อ provider" เป็น "หนึ่งช่องของกริดต่อ provider": 1 / 2 / 2 / 4 / 6 คอลัมน์ที่ mobile / tablet / 1366 / Full HD / 4K
- ของที่ยังเหมือนเดิมจากการตัดสินใจ 27 ต.ค.: ขยายได้ทีละตัว (`openCode`), ยุบไว้เห็น ไอคอน · ชื่อ · ป้าย Default/Customized · On/Off (Switch ตอนแก้) + ตัวอย่าง prompt ที่ใช้จริง, โหมดดูโชว์ prompt ที่ใช้จริงแบบอ่านอย่างเดียว, โหมดแก้มี textarea + "Start from default" / "Reset to default"
- ตัวที่ขยายกินเต็มแถวของกริด (`col-span-full`) เมื่อแก้ prompt เอง prompt ที่แก้กับค่ามาตรฐานวางเคียงกันเพื่อเทียบ

## Tried and ruled out
- คงแถวเต็มความกว้างไว้: บนจอกว้างสถานะ On/Off อยู่ขวาสุดของจอ ห่างจากชื่อ provider และเหลือคอลัมน์หัวข้อเปล่าหนึ่งในสามของจอ — ขัดกติกาที่ผู้ใช้ตั้งไว้
- การ์ดซ้อนเรียงลงมา (ของเดิมก่อน 27 ต.ค.) ผู้ใช้ปฏิเสธไปแล้ว ไม่ได้กลับไปใช้

## Watch out
- prompt ว่างยังแปลว่า "ใช้ค่ามาตรฐาน" (บันทึกเป็น null ใน buildSaveBody) — "Start from default" คัดลอกค่ามาตรฐานลง draft ซึ่งพอ Save จะกลายเป็น override ของ BU
- ตัวอย่าง prompt ในช่องที่ยุบเป็น `aria-hidden` อย่าย้ายข้อความ prompt เข้าไปในชื่อของปุ่ม
- ตัวที่ขยายจะย้ายลงไปอยู่แถวของตัวเอง ช่องที่ตามหลังเลื่อนลงไปต่อ — เป็นพฤติกรรมที่ตั้งใจ ไม่ใช่บั๊ก

In the code:
- `routes/system-admin/ask-ai/ask-ai-provider-card.tsx` — `Collapsible` รับ `className={cn("min-w-0", open && "col-span-full")}`; ตัวอย่าง prompt `line-clamp-2`
- `routes/system-admin/ask-ai/ask-ai-component.tsx` — `CompactSection` + `FieldGrid size="item"`
- `components/share/compact-section.tsx` — `FieldGrid` prop `size`, `CompactSection` prop `count`
