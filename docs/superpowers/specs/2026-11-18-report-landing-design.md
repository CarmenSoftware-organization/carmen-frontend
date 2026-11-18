# Report landing (`/report`) แบบเดียวกับ System Admin — design

วันที่ 2026-11-18 · ขนาด: งานเล็ก (เปลี่ยนเลย์เอาต์ 2 หน้า ไม่มี behaviour ใหม่)

## เจตนา

ผู้ใช้สั่ง: ทำหน้า `/report` ใหม่ "แบบ System Admin landing ใช้ข้อมูลจริง"
หน้าเดิม (`routes/report/report-landing.tsx`) ผิดกติกา §Landing pages ของ skill
`carmen-blue-ui-design` เกือบทุกข้อ: hero ครึ่งจอ + เลขเวอร์ชันตายตัว · ภาพจำลองเต็มไปด้วยข้อมูลแต่ง
(`PR-AGING`, 07:45, 1,284 แถว, "7 OK · 1 failed") · ปุ่ม Templates/Builder ที่กดแล้วไม่ทำอะไร ·
ไม่เช็กสิทธิ์

## เป้าหมาย

- การ์ด 1 ใบต่อทุกหน้าในเมนูซ้ายของ Report (Report List · Schedules · History) ตาม `constant/module-list.ts`
- ชื่อการ์ด = ชื่อเมนู (`modules.reportList` …) · คำอธิบาย = คำอธิบายหัวหน้านั้นเอง
  (`report.desc`, `reportSchedule.desc`, `reportHistory.desc`) — ไม่มีข้อความโฆษณาแยก
- ตัวเลขบนการ์ดมาจาก API เท่านั้น:
  - Report List: `useReportTemplates({ perpage: 1 })` → `paginate.total`
  - Schedules: `useReportSchedules()` → จำนวนในอาร์เรย์
  - History: `useReportHistory({ perpage: 1 })` → `paginate.total`
  - ระหว่างโหลด / error = ไม่แสดงตัวเลข (ไม่ใช่ 0) แบบ `wf-landing.tsx`
- สิทธิ์จาก `useVisibleModules` ตัวเดียวกับเมนูซ้าย: ซ่อน = ไม่มีการ์ด · ล็อก/ไม่มีสิทธิ์ = การ์ดจาง
  กดแล้ว `dispatchPermissionDenied` · การ์ดที่เข้าไม่ได้ไม่ยิง API ของตัวเลข
- การ์ดกดได้ทั้งใบ · ภาพประกอบเป็นเส้น ไม่มีชื่อ/เลข/เวลาแต่ง
- หัวหน้ากะทัดรัด (ชื่อ + คำโปรย) แบบ `LandingHero`

## ไม่ทำ (non-goals)

- ไม่เพิ่มของใหม่ที่ไม่มีหน้ารองรับ (template builder, รายงานโปรด, ปุ่มลัด)
- ไม่แตะหน้า list / schedules / history เอง

## Anti-goals

- System Admin landing หน้าตาหรือสิทธิ์เปลี่ยนไปจากเดิม (ย้ายโค้ดแล้วต้องวัดซ้ำได้ผลเท่าเดิม)
- ตัวเลขที่ดูเหมือนจริงแต่ไม่ได้มาจาก API

## Approaches

1. **ย้ายชิ้นส่วนกลางไป `components/share/landing/`** — การ์ด, หัวหน้า, ตัวช่วยวาดเส้น (`Line`,
   `ListViz`) รับเนื้อหาเป็น props; System Admin เปลี่ยนมาใช้ชุดเดียวกัน — **ผู้ใช้เลือกข้อนี้**
   ข้อดี: ชุดเดียว landing ถัดไปหยิบใช้ได้ (skill ห้ามเขียนชุดที่สอง) · ข้อเสีย: แตะ System Admin ต้องวัดซ้ำ
2. คัดลอกเข้า `routes/report/` — เร็ว แต่สองชุดจะเพี้ยนจากกัน
3. ย้ายแค่การ์ด ภาพวาดแยก — ตัวช่วยวาดเส้นยังซ้ำสองที่

## การออกแบบ

- `components/share/landing/landing-card.tsx` — `LandingCard({ href, title, description, icon,
  visual, stat?, access? })` ย้ายจาก `LandingModuleCard` ตรง ๆ แต่รับข้อความ/ภาพเป็น props
  แทน `t` + `visualKey` · `stat` วางใต้คำอธิบาย
- `components/share/landing/landing-hero.tsx` — `LandingHero({ title, kicker?, lede })`
- `components/share/landing/landing-viz.tsx` — `Line`, `ListViz` (export)
- `routes/system-admin/` — `landing-module-card.tsx` เหลือตัวห่อบาง ๆ ที่แปล `t` + `ModuleVisual`
  แล้วส่งให้ `LandingCard` · viz เฉพาะ System Admin อยู่ที่เดิมแต่ import `Line`/`ListViz` จากกลาง
- `routes/report/report-landing.tsx` เขียนใหม่: `LandingHero` + กริดการ์ด 3 ใบ ไม่มีหัว chapter
  (กลุ่มเดียว หัว chapter จะทวนชื่อหน้า) · ภาพประกอบ 3 ภาพเป็นเส้น: รายการ (List), ตารางสัปดาห์ (Schedules),
  เส้นเวลา (History) — ป้ายในภาพตรงกับหน้าจริงเท่านั้น
- ลบคีย์ `report.intro.*` (103 คีย์) ทั้ง en/th — ไม่มีผู้ใช้อื่น · เพิ่มคีย์ตัวเลข
  (`report.landing.count*` แบบ ICU plural) และ kicker/lede ของหัวหน้า
- `components/ui/type-ladder.test.ts` อ้างไฟล์ landing ของ System Admin อยู่ ต้องปรับ path/ตัวเลขข้อยกเว้นตาม

## การตัดสินของผม (ตรวจได้)

- เลย์เอาต์การ์ด: `grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))]` — การ์ดกว้าง ~280–400px
  ทุกจอ (กติกา 2) จอกว้างจึงเหลือที่ว่างด้านขวาหลังการ์ดใบที่ 3 ซึ่งเลี่ยงไม่ได้เมื่อมีแค่ 3 หน้า;
  ยืดการ์ดเต็มจอจะได้การ์ดกว้าง 1100px ที่ 4K ซึ่งผิดกติกา 2
- ตัวเลขของ Schedules นับทั้งหมด ไม่แยก active/paused
- ไม่มีหัว chapter / เลข 01–03

## ที่เหลือให้ผู้ลงมือ

- รูปเส้นของภาพประกอบทั้ง 3 · ชื่อคีย์ i18n · การตรวจตาม `verify.md` §Landing pages
  (390/768/1366/1920/3840, ไทย, dark, บัญชีที่ไม่มีสิทธิ์บางหน้า)
