# Typography role defaults — ขนาดตัวอักษรตามหน้าที่ เป็นค่าตั้งต้นทั้งแอป

วันที่ 2026-11-25 · สถานะ: ร่าง รอ user อนุมัติ

## ทำไม

ผู้ใช้เห็นขนาดตัวอักษรไม่สม่ำเสมอบนหน้าจอจริง สามอาการ:

1. หน้าหนึ่งตัวใหญ่ อีกหน้าตัวเล็ก สำหรับข้อความหน้าที่เดียวกัน
2. ในแถวตารางเดียวกัน แต่ละ cell ขนาด font ไม่เท่ากัน
3. ข้อความ description ในหน้า detail ใหญ่กว่า group header ของมันเอง

ต้นเหตุจากการสำรวจโค้ด:

- `body` ใน `styles/globals.css` ตั้ง `font-size: 1.0625rem` (17px) ซึ่งเป็นค่าที่ติดมาจากแอปต้นทาง
  ข้อความใดที่ไม่มี class ขนาดจะได้ 17px ไปด้วย และใหญ่กว่าหัวกลุ่ม (14px) กับค่าในฟิลด์ (12px)
  พบจุดแบบนี้แล้วอย่างน้อย 14 จุดที่ใช้ `whitespace-pre-*` โดยไม่มีขนาด เช่น
  `routes/procurement/goods-receive-note/grn-extra-cost-fields.tsx:195` และ
  `routes/accounting/accounts-payable/shared/ap-read-value.tsx:23` และน่าจะมีจุดอื่นที่ไม่ได้ใช้ `whitespace-pre-*` อีก
- `DataGrid` (`components/ui/data-grid/data-grid-table.tsx:113`) ตั้งตารางไว้ที่ `text-xs` แล้ว
  แต่มีราว 50 ไฟล์ใต้ `routes/` ที่ใส่ `text-sm` / `text-micro` / `text-base` / `text-micro-legal` ทับใน `cell:`
- ตอนนี้มีแค่ type ladder (`docs/DESIGN.md` §typography, token ใน `globals.css`) ซึ่งบอกว่า
  ขนาดไหน *ใช้ได้* แต่ไม่มีกติกาว่าข้อความหน้าที่ไหน *ต้องใช้* ขนาดไหน แต่ละหน้าจึงเลือกเอง

ฟอนต์ (font family) ไม่ใช่ปัญหา ทั้งแอปใช้ `--font-sans` ชุดเดียว (system stack ต่อด้วยฟอนต์ไทย)
และ `font-mono` สำหรับรหัส/ตัวเลข ส่วน `font-serif` ที่พบ 1 จุด
(`routes/vendor-management/vendor/vendor-contact.tsx:166` ซึ่งเป็นวงกลมตัวอักษรย่อ) ให้ builder
เปลี่ยนเป็น `font-sans` ได้เลย

## เป้าหมาย

- ข้อความที่มีหน้าที่เดียวกันใช้ขนาดเดียวกันทุกหน้า ตามตารางหน้าที่ข้างล่าง
- ข้อความที่ไม่ได้ใส่ขนาดได้ขนาดของเนื้อหา (12px) ไม่ใช่ 17px
- ในเซลล์ตาราง บรรทัดหลักทุกเซลล์ขนาดเดียวกัน บรรทัดรองเล็กลงหนึ่งขั้นและเป็นขั้นเดียวกันทั้งแอป
  (user เลือกข้อ ข.)
- มีเทสต์คอยดักไม่ให้ `cell:` กลับมาตั้งขนาดเอง
- ตารางหน้าที่เขียนลงใน `docs/DESIGN.md` และแสดงบนหน้า `/design-system`

## สิ่งที่ไม่ทำ

- ไม่เปลี่ยน font family และไม่เพิ่มฟอนต์ใหม่
- ไม่เปลี่ยน ladder (ไม่เพิ่มหรือลบขั้น) และไม่แตะ font scale ของผู้ใช้ (`html.font-scale-*`, `lib/font-scale.ts`)
- ไม่แตะหน้าที่ตั้งใจใช้ขนาดใหญ่และมี class ขนาดของตัวเอง ได้แก่ login / `auth-split-shell`,
  recipe cook mode, dashboard tile/widget, landing visuals และ print
- ไม่เปลี่ยนขนาดปุ่ม คือ 14 ที่ขนาดปกติ และ 12 ที่ `sm`/`xs`

## ต้องไม่เกิด (ถึงจะทำงานได้ก็ถือว่าล้มเหลว)

- ข้อความที่เคย "พึ่ง" 17px โดยไม่รู้ตัวเล็กจนอ่านไม่ออก หรือทำให้ layout พัง เช่น toast, empty state หรือ dropdown item
- ไม่มีกติกาใหม่ที่ทำให้ `max-w-*` หรือ spacing ทั้งแอปเปลี่ยน (ดูกับดัก `--spacing-md` ใน CLAUDE.md)
- ข้อความภาษาไทยถูกตัดสระบนหรือวรรณยุกต์ (ให้ใช้ line-height ของ token และห้ามตั้ง `leading-none` ใหม่ให้ข้อความไทย)

## ตารางหน้าที่ (user อนุมัติแล้ว)

| หน้าที่ | ขนาด | น้ำหนัก / สี |
|---|---|---|
| หัวหน้า (h1) ทั้ง list และหัวเอกสาร | 18px `text-lg` | semibold (หัวเอกสารเลิกขยายเป็น 20 บนจอกว้าง) |
| หัวกลุ่ม / หัวการ์ด / หัว dialog / หัว sheet | 14px `text-sm` | semibold (`SettingSection` เปลี่ยนจาก 16 เป็น 14) |
| ข้อความใต้หัว (`DialogDescription`, `SheetDescription`, `CardDescription`, คำอธิบายใต้ section) | 12px `text-xs` | ปกติ สีจาง (ลดจาก 14) |
| label ของฟิลด์ | 12px `text-xs` | ปกติ สีจาง |
| ค่าในฟิลด์ / input / textarea / description ใน detail | 12px `text-xs` | ปกติ |
| หัวคอลัมน์ตาราง | 12px `text-xs` | semibold สีจาง |
| เซลล์ บรรทัดหลัก | 12px `text-xs` | ปกติ ยอดเงินหรือรหัสเอกสารทำตัวหนาได้ แต่ขนาดเท่าเดิม |
| เซลล์ บรรทัดรอง | 11px `text-micro` | ปกติ สีจาง (`text-muted-foreground`) |
| ข้อความเล็กประกอบ (เวลา, ตัวนับ, caption) | 10px `text-micro-legal` | ปกติ |
| eyebrow / ชิปตัวพิมพ์ใหญ่ | 9px `text-micro-eyebrow` | 600 (คงตามเทสต์เดิม) |
| รายการใน control (menu / select / command / popover / sidebar / tabs / breadcrumb) | 12px `text-xs` | ปกติ (sidebar/menu ลดจาก 14) |
| ค่าตั้งต้นของ `body` | 12px (`0.75rem`) | — |

## วิธีที่พิจารณา

1. **แก้เฉพาะจุด** คือเติม class ให้ข้อความที่ไม่มีขนาด และไล่แก้ `cell:` แล้วคง `body` ไว้ที่ 17px
   ข้อดีคือกระทบน้อย แต่ต้นเหตุยังอยู่ โค้ดใหม่จะกลับมาเป็น 17px และไม่มีอะไรดัก
2. **ลด `body` เป็น 12px แล้วไล่แก้จุดที่ทับ** ซึ่งแก้ที่ต้นเหตุ แต่ข้อความที่พึ่ง 17px จะเล็กลงพร้อมกัน
   จึงต้องวัดก่อนและหลังแก้ และไม่มีอะไรกันไม่ให้ cell กลับมาตั้งขนาดเอง
3. **ทาง 2 + ตัวช่วยเซลล์ + เทสต์ดัก + เอกสาร** ← user เลือก (2026-11-25)
   เพราะเป็นทางเดียวที่ปัญหาจะไม่กลับมาเมื่อมีหน้าใหม่ ต้นทุนเพิ่มมีแค่ตัวช่วยเล็ก ๆ หนึ่งตัวกับเทสต์หนึ่งไฟล์

## การออกแบบ

### 1. ค่าตั้งต้น
- `styles/globals.css` `body`: เปลี่ยน `font-size: 1.0625rem` เป็น `0.75rem` และคง `letter-spacing: -0.01em`
- แก้ `docs/DESIGN.md` §typography: `inherited-base` จาก 17px เป็น 12px และเพิ่มหัวข้อ **Roles** ที่ใช้ตารางข้างบน

### 2. Primitive กลาง
- แก้ `CompactSection`, `SettingSection`, `DialogTitle/Description`, `SheetTitle/Description`, `CardDescription`,
  `DocFormHeader`, `DocumentListHeader` ให้ตรงตามตาราง
- ตัวช่วยเซลล์: เพิ่มใน `components/ui/data-grid/` เช่น `CellText` (บรรทัดหลัก) กับ `CellSub` (บรรทัดรอง 11px สีจาง)
  จะทำเป็น component หรือเป็น class constant ให้ builder เลือก แต่ต้องมีจุดเดียวที่กำหนดขนาดบรรทัดรอง

### 3. ไล่แก้ call site
- `cell:` ใน `routes/**` ที่ตั้งขนาดเอง: บรรทัดหลักให้ลบ class ขนาดออก (สืบทอด 12px จากตาราง)
  บรรทัดรองให้เปลี่ยนไปใช้ `CellSub`
- ข้อความ description หรือค่าที่ไม่มีขนาด: หลัง body เป็น 12px แล้วจะถูกต้องเอง ไม่ต้องแก้ทีละจุด
  ยกเว้นจุดที่การวัดพบว่าผิด
- ขนาดนอก ladder (`text-[0.8rem]` ใน calendar, `text-[0.8125rem]` / `text-[0.9375rem]` ใน badge,
  `text-[1rem]` ใน dashboard h1) ให้ปัดเข้าขั้นที่ใกล้ที่สุด ส่วน `auth-split-shell` ไม่แตะ
- `fontSize` inline ทั้ง 22 จุด ส่วนใหญ่อยู่ใน chart, tile และ font-scale-switch ให้คงไว้

### 4. เทสต์ดัก (static, แบบเดียวกับ `components/ui/type-ladder.test.ts`)
- สแกนไฟล์ `routes/**/*.tsx` ที่มี column definition แล้ว fail เมื่อ class ขนาดใน `cell:` ไม่ใช่ `text-xs`
  หรือตัวช่วยเซลล์ (ให้ builder ออกแบบวิธีจับขอบเขตของ `cell:` และมี probe test ยืนยันว่า regex ยังจับได้
  แบบเดียวกับไฟล์เดิม)
- มี allowlist สำหรับข้อยกเว้นที่ตั้งใจ และต้องเขียนเหตุผลกำกับทุกรายการ
- CLAUDE.md ระบุว่าห้ามสร้าง test file ใหม่ถ้า user ไม่ได้ขอ แต่ user เลือกทาง 3 ซึ่งรวมเทสต์ดักนี้ไว้แล้ว
  จึงถือว่าขอแล้ว เฉพาะไฟล์นี้ไฟล์เดียว

### 5. หน้า `/design-system`
- `routes/design-system/sections/typography.tsx`: เพิ่มตารางหน้าที่ พร้อมตัวอย่างเรนเดอร์จริงของแต่ละหน้าที่
  และตัวอย่างแถวตารางที่มีบรรทัดหลักกับบรรทัดรอง (dev tool ไม่ต้องผ่าน i18n)

### 6. ตรวจด้วยการวัดจริง
- ก่อนแก้: วัด computed `font-size` บนหน้าตัวแทน ได้แก่ PR list, PR detail, GRN detail, หน้าฟอร์ม config
  (เช่น location), dialog, toast, empty state, login และ dashboard แล้วบันทึกไว้
- หลังแก้: วัดซ้ำทั้งธีมสว่างและมืด ที่ font scale ปกติและ `biggest` และตรวจข้อความไทยว่าไม่ถูกตัด
- ข้อความใดที่เล็กลงจาก 17 แล้วผิดหน้าที่ ให้ใส่ class ตามตาราง ห้ามยกค่า body กลับขึ้น

## คำตอบจาก builder check (เครื่องหมาย [call] คือผู้เขียนตัดสินเอง)

- **ข้อความที่ไม่มีหน้าที่ในตาราง**: เจตนาคือให้เป็น 12px ทั้งหมด ข้อความที่ไม่มี class คือเนื้อหา
- **รายการใน control (user เลือกข้อ ข. 2026-11-25)**: ให้รายการในทุก control ใช้ 12px `text-xs` เท่ากันหมด
  ตอนนี้ dropdown-menu, command, popover และ sidebar ใช้ 14 (`text-sm`) ส่วน select, tabs, breadcrumb และ tooltip ใช้ 12
  ให้แก้กลุ่มที่เป็น 14 ลงมาเป็น 12 ใน `components/ui/` ทั้งตัวรายการ, label ของกลุ่ม, ช่องค้นหาใน command
  และ empty text ส่วนปุ่มคงขนาดเดิม และ toast ใช้ค่าของ sonner ตามเดิม sidebar อยู่ทุกหน้า
  จึงต้องอยู่ในรายการหน้าตัวแทนที่วัดก่อนและหลังแก้ (ทั้งตอนกางและตอนหุบ)
  ให้แถวในตารางหน้าที่ระบุว่า "รายการใน control (menu / select / command / sidebar / tabs) = 12px"
- **เกณฑ์ผ่าน/ไม่ผ่านของการวัด** [call]: ผ่านเมื่อ (ก) ข้อความทุกชิ้นบนหน้าตัวแทนอยู่ในขั้นของ ladder
  และตรงกับหน้าที่ตามตาราง (ข) หัวไม่เล็กกว่าเนื้อหาที่มันกำกับ (ค) ไม่มี horizontal overflow และ
  สระบน/วรรณยุกต์ไม่ถูกตัด ที่ font scale `normal` และ `biggest` ทั้งสองธีม การตรวจด้วยตาบวก computed style เพียงพอ
- **ขอบเขตของ cell** [call]: ทุก `cell:` ของ column definition ทั้งใน `routes/**` และ `components/**`
  รวม header renderer ส่วนตาราง `<table>` ดิบและ card grid อยู่นอกขอบเขต
  ตัวเลข "ราว 50 ไฟล์" คือไฟล์ที่ตั้งขนาดเอง จากทั้งหมด 136 ไฟล์ที่มี `cell:`
- **บรรทัดหลักที่เป็น 14/16 อยู่**: ลดเป็น 12 ทั้งหมดตามที่ user เลือกข้อ ข. ยอดเงินหรือสถานะที่อยากเน้นให้ใช้น้ำหนัก
  ไม่ใช้ขนาด status chip/badge เป็น component ของตัวเองจึงไม่นับเป็นข้อความเซลล์ บรรทัดรองที่เป็น 10px
  (`text-micro-legal`) ให้ขยับขึ้นเป็น `CellSub` 11px เพื่อให้มีขั้นเดียวทั้งแอป [call]
- **หัวอื่น ๆ** [call]: dashboard h1 (`text-[1rem]`) และ h1 ของหน้าอื่นที่เป็นหัวหน้า = 18px
  ส่วน `FieldLegend` variant legend (16) และ `AlertDialogTitle` (`text-lg`) = 14px ตามแถวหัวกลุ่ม/หัว dialog
  ส่วนหัวของ empty state คงตาม `components/ui/empty.tsx`
- **letter-spacing ของ body** [call]: คง `-0.01em` เพราะเป็นหน่วยสัมพัทธ์ ขยายตาม font scale ได้
  (แก้จากร่างแรกที่ให้ใช้ `-0.12px`)
- **hook `design-system-font-size`**: มาจาก plugin impeccable ซึ่งอ่าน `docs/DESIGN.md` ถ้าแก้ DESIGN.md ตาม §1 แล้ว
  ค่าใหม่จะผ่าน ถ้า hook บล็อกให้แก้ DESIGN.md ไม่ใช่เปลี่ยนขนาด และ `type-ladder.test.ts` ต้องเขียวต่อไป

## สิ่งที่ปล่อยให้ builder ตัดสิน
- จะทำตัวช่วยเซลล์เป็น component หรือเป็น class constant
- วิธีจับขอบเขต `cell:` ในเทสต์
- ลำดับการแก้ไฟล์และการแบ่ง commit/PR (ควรแบ่งตามโมดูล เพื่อให้ review ทีละชุดได้)
- เครื่องมือวัด ซึ่งใช้ Chrome automation ได้
