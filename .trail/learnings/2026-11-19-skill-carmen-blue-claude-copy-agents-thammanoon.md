---
title: skill ออกแบบหน้าจอ Carmen Blue ยึดฉบับใน .claude เป็นหลัก แล้ว copy ไป .agents ให้ตรงกัน
author: Thammanoon
date: 2026-11-19
branch: chore/sync-ui-design-skill
cost: { minutes: 1, tokens: 2439 }
id: l-0e38cd77
scope: repo
status: active
src: agent
touches:
  - ".agents/skills/carmen-ui-consistency/SKILL.md"
  - ".agents/skills/carmen-blue-ui-design/SKILL.md"
  - ".agents/skills/carmen-blue-ui-design/verify.md"
  - ".agents/skills/carmen-ui-consistency/current-conventions.md"
---

## Decided
skill จัดหน้าจอ (carmen-blue-ui-design) มีสองชุด คือ `.claude/skills` และ `.agents/skills` เมื่อสองชุดไม่ตรงกัน ให้ถือฉบับ `.claude` เป็นหลัก (user เลือกเอง 19 พ.ย.) แล้ว copy ไปทับ `.agents`
วิธีตรวจขนาดจอใช้ iframe + `__vp` ของฉบับ `.claude` ข้อห้ามฉีด iframe เดิมของ `.agents` ถูกยกเลิก

## Tried and ruled out
ยึด `.agents` เป็นหลัก: ตัดทิ้ง เพราะ `.claude` ได้แตกไฟล์ recipe ใหม่ไปแล้ว ถ้ายึด `.agents` ไฟล์ชุดนั้นจะถูกทับหาย

## Watch out
- `.agents` มีของที่ `.claude` ไม่มี ตอน copy ห้ามทับส่วนนี้: ย่อหน้าใน SKILL.md ที่ลิงก์ carmen-ui-consistency / accounting-detail-shell และทางสำรองใน verify.md สำหรับ agent ที่ไม่มี tool รัน JS
- ถ้าแก้ชื่อไฟล์ recipe ต้องแก้ตามใน `.agents/skills/carmen-ui-consistency/SKILL.md` ด้วย

In the code:
- `.claude/skills/carmen-blue-ui-design/SKILL.md`
- `.claude/skills/carmen-blue-ui-design/verify.md`
- `.agents/skills/carmen-blue-ui-design/SKILL.md`
- `.agents/skills/carmen-blue-ui-design/verify.md`
- `.agents/skills/carmen-ui-consistency/SKILL.md`
- `.agents/skills/carmen-ui-consistency/current-conventions.md`
- ตรวจว่าตรงกันไหม: `diff -rq .agents/skills/carmen-blue-ui-design .claude/skills/carmen-blue-ui-design` (ควรต่างกันแค่ SKILL.md และ verify.md)
