---
title: "หน้า Company Profile เป็นฟอร์มเต็มความกว้างจอ กะทัดรัด ไม่มีเมนูข้ามหมวด และไม่จำกัดความกว้าง"
author: Thammanoon
date: 2026-11-12
branch: feature/company-profile-full-width
cost: { minutes: 23, tokens: 292597 }
id: l-c907eb29
scope: repo
status: active
src: agent
touches:
  - messages/en.json
  - messages/th.json
  - routes/system-admin/company-profile/company-profile-address.tsx
  - routes/system-admin/company-profile/company-profile-component.tsx
  - routes/system-admin/company-profile/company-profile-identity.tsx
  - routes/system-admin/company-profile/company-profile-ui.tsx
---

## Decided
- 2026-11-12 ผู้ใช้สั่งเองทีละข้อ: หน้า Company Profile ต้อง (1) เต็มความกว้างจอทุกขนาด — mobile, tablet, 1366, Full HD, 4K — ไม่เหลือที่ว่างซ้ายขวานอกจาก gap ภายใน (2) ไม่มีเมนูข้ามหมวดด้านซ้าย (3) กะทัดรัดกว่า layout ของ `SettingSection` กลาง (4) ไม่มีช่อง Info ในหมวด General
- จำนวนคอลัมน์ของช่องนับจากความกว้างของการ์ดเอง (container query) ไม่ใช่ของจอ การ์ดครึ่งจอกับการ์ดเต็มจอจึงใช้กฎเดียวกัน และพับ sidebar แล้วยังถูก
- โหมดดูไม่ใส่กรอบให้ค่า (กรอบมีเฉพาะ input ตอนแก้) และรูปแบบวันที่/ตัวเลขโชว์ตัวอย่างผลลัพธ์เป็นค่าหลัก pattern ดิบเป็นบรรทัดรอง

## Tried and ruled out
- จำกัดความกว้างเนื้อหา (`max-w-7xl`) เพื่อไม่ให้ค่าลอยห่างจากป้ายบนจอกว้าง — ผู้ใช้ไม่เอา ต้องเต็มจอ จึงแก้ด้วยการเพิ่มคอลัมน์ตามความกว้างแทน
- เมนูข้ามหมวดแบบ sticky ด้านซ้าย — ผู้ใช้สั่งถอด (หน้าสั้นลงจนไม่จำเป็นเมื่อช่องเรียงหลายคอลัมน์)
- layout หัวข้อซ้าย 1/3 + การ์ดขวา 2/3 ของ `SettingSection` — เสียพื้นที่หนึ่งในสามของจอ จึงย้ายหัวข้อขึ้นเหนือการ์ด

## Watch out
- `info` ยังอยู่ใน form schema ทั้งที่ไม่มีช่องในหน้าแล้ว ค่าใน DB ไม่ถูกแตะเพราะ Save ส่งเฉพาะช่องที่เปลี่ยน อย่าเข้าใจว่าเป็นของตกค้างแล้วลบโดยไม่ดูเทสต์ของ schema
- `SettingSection` กลางไม่ได้แก้ หน้าอื่น (default-setting, vendor ฯลฯ) ยังเป็น layout เดิม ถ้าจะทำให้หน้าอื่นกะทัดรัดแบบนี้ต้องถามผู้ใช้ก่อน ไม่ใช่แก้ตัวกลาง
- ตรวจหลายขนาดจอผ่าน Chrome extension: `resize_window` รายงานสำเร็จแต่ viewport ไม่เปลี่ยน วิธีที่ใช้ได้คือฝัง iframe same-origin ของหน้าเดียวกันด้วยความกว้างที่ต้องการ (media query และ container query ทำงานตามความกว้าง iframe) แล้วย่อด้วย transform ให้พอดีจอ
- ป้าย "min N digits" ของ Quantity/Recipe Format ไม่ตรงกับตัวอย่างและข้อความช่วย ("minimum decimal places") ยังไม่ได้แก้

In the code:
- `routes/system-admin/company-profile/company-profile-component.tsx` — `Section`, `FieldGrid` (`@md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6`), `SECTION_PAIR` (`min-[1700px]:grid-cols-2`)
- `routes/system-admin/company-profile/company-profile-ui.tsx` — `SettingField` prop `specimen`
- ลบ `company-profile-nav.tsx` และคีย์ `companyProfile.sectionNav`, `fields.info`, `fields.infoDesc` ใน `messages/en.json`, `messages/th.json`
