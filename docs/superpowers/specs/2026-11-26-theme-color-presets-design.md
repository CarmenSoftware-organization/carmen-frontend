# ธีมสีให้ผู้ใช้เลือก (Classic · Blue Glass · Emerald · Teal · Violet · Graphite)

วันที่: 2026-11-26 · สถานะ: design (รออนุมัติ)

## เจตนา

ผู้ใช้อยากเลือกสีหลักของแอปเองได้ และอยากได้ธีมแบบ **Blue Glass** ตามสไตล์เว็บ
https://carmen-demo.kazaki-rio.com/mainpage/ ซึ่งใช้สีแบรนด์ `#0154bd` / navy `#1c4988` /
sky `#4cabe0` / tint `#e5efff` พื้นหลังไล่สีโทนน้ำเงิน และแถบเมนูเป็นกระจกโปร่ง
(`backdrop-filter: blur(4–8px)` ทับพื้นขาวที่ alpha ต่ำ)

## เป้าหมาย

- มีธีมสีให้เลือก 6 ธีม ได้แก่ **Classic** (หน้าตาปัจจุบันและเป็นค่าตั้งต้น) · **Blue Glass** · **Emerald** · **Teal** · **Violet** · **Graphite**
- ธีมสีเป็นการตั้งค่าคนละแกนกับ light/dark/system ที่มีอยู่ ทุกธีมต้องมีทั้งโหมดสว่างและโหมดมืด
- **Blue Glass** เปลี่ยนสีด้วย และเปลี่ยนวัสดุของ**โครงหน้าจอ**ด้วย คือพื้นหลักเป็นสีไล่โทนน้ำเงิน ส่วน sidebar กับ navbar เป็นกระจกโปร่งเบลอ
- ธีมอื่นนอกจาก Blue Glass เปลี่ยนแค่ token สีหลัก ได้แก่ `--primary`, `--ring`, `--sidebar-primary`, `--sidebar-ring`, `--chart-1` และ accent ที่ผูกกับสีหลัก
- ผู้ใช้ที่ไม่เคยแตะการตั้งค่านี้ต้องได้ DOM และหน้าตาเดิมทุกประการ

## สิ่งที่ไม่ทำ

- ไม่บันทึกลง backend ค่าเก็บต่อเครื่องต่อเบราว์เซอร์ใน localStorage และไม่ sync ข้าม tab (เหมือน font-scale)
- ไม่มีตัวเลือกสีอิสระ (color picker)
- ไม่มีสวิตช์เปิด/ปิดกระจกแยก กระจกเป็นของ Blue Glass เท่านั้น
- ไม่ตั้งธีมตาม BU หรือตามแบรนด์ลูกค้า

## สิ่งที่ถือว่าล้มเหลว แม้ระบบจะทำงานได้

- การ์ด ตาราง (DataGrid) ฟอร์ม dialog หรือ popover โปร่งแสง สิ่งเหล่านี้ต้องเป็นพื้นทึบเสมอ
- ตัวหนังสือขาวบนปุ่มสีหลักไม่ผ่าน WCAG AA ในธีมใดธีมหนึ่ง หรือในโหมดใดโหมดหนึ่ง
- สีกะพริบตอนโหลดหน้า คือเห็น Classic แวบหนึ่งก่อนเปลี่ยนเป็นธีมที่เลือก
- สคริปต์ใน `index.html` ถูก CSP บล็อกบน production เพราะลืมอัปเดต hash
- สีสถานะ เช่น success, warning, destructive และ `--status-*` เปลี่ยนตามธีม สีเหล่านี้ต้องคงเดิม

## ข้อจำกัด

- `index.html` มี inline script ตั้ง class `font-scale-*` ก่อน paint แรก และ `script-src` ผูกกับ sha256 ของสคริปต์นี้
  ใน 4 ปลายทาง (nginx · vercel.json · GCS · CloudFront) `lib/__tests__/security-headers.test.ts`
  คำนวณ hash ให้และเทียบให้ครบ 4 ไฟล์ (รายละเอียดใน `docs/deploy.md` §Security headers)
- โครงหน้าจอใช้ class `space-sidebar-gradient` / `space-navbar-gradient` / `space-main-gradient`
  (`styles/globals.css:622`) ใน `components/ui/sidebar.tsx`, `components/navbar/navbar.tsx` และ `routes/root-layout.tsx`
  Blue Glass จึงเปลี่ยนที่ 3 class นี้ได้ ไม่ต้องไล่แก้ทีละหน้า
- กฎของ `docs/DESIGN.md`: ห้ามตั้งค่าสีที่ call site และห้ามประกาศ `--spacing-md/sm/lg/xl/2xl`
- `lib/__tests__/status-ink-contrast.test.ts` ต้องยังผ่าน

## แนวทางที่พิจารณา

- **A. ชุดสีสำเร็จรูปเป็น class บน `<html>` ตั้งใน inline script ตัวเดิม (เลือกแนวทางนี้)**
  ใช้ class `.theme-<name>` และ `.dark.theme-<name>` ใน `globals.css` override token ไม่มีสีกะพริบ
  ส่วนที่ต้องจ่ายคือแก้ `index.html` แล้วอัปเดต CSP hash ใน 4 ไฟล์
- **B. แนวทางเดียวกับ A แต่ตั้งค่าใน `main.tsx` อย่างเดียว** ไม่ต้องแตะ CSP แต่จะเห็น Classic แวบหนึ่งทุกครั้งที่รีโหลด
  เพราะ boot เรียก network ก่อน (`loadRuntimeConfig` → `refreshTokens`) และ Blue Glass ที่มีพื้นหลังไล่สีจะเห็นชัดที่สุด จึงไม่เลือก
- **C. ตัวเลือกสีอิสระแล้วคำนวณ token เอง** ตัดออกตั้งแต่ต้น เพราะรับประกัน contrast ไม่ได้
- **ธีมที่ไม่ใส่:** Rose/แดงจะปนกับสี destructive ส่วน Amber/เหลืองทำให้ตัวหนังสือขาวบนปุ่มไม่ผ่าน AA

ผู้ใช้เลือกขอบเขต "สี + กระจกเฉพาะโครงหน้าจอ" (แทนที่จะทำแค่สี หรือกระจกทั้งหน้า) เลือกชุด "Classic + Blue Glass + ธีมสีล้วน"
และเลือกแนวทาง A

## สิ่งที่ตัดสินแล้ว

- **การเก็บค่า:** ใช้ localStorage key `carmen.color-theme` ค่าตั้งต้นคือ `classic` และ `classic` ไม่มี class ของตัวเอง เหมือน font-scale ที่ `normal` ไม่มี class
- **ตอน boot:** ตั้ง class ใน inline script เดิมของ `index.html` แล้วตั้งซ้ำใน `main.tsx` ด้วย `applyColorTheme(readStoredColorTheme())`
  ใน inline script รายชื่อธีมจะซ้ำกับค่าคงที่ใน `lib/color-theme.ts` ให้ test เดียวกับที่กัน font-scale drift ตรวจว่าสองรายชื่อตรงกัน
- **ตัวเลือก:** เป็น submenu ในเมนูโปรไฟล์ ถัดจาก Theme เดิม ใช้ pattern เดียวกับ `ThemeSwitch` / `FontScaleSwitch`
  (`menuitemradio` + `aria-checked` และภาพตัวอย่างเล็กหรือจุดสีของแต่ละธีม) ข้อความทุกคำผ่าน i18n ทั้ง `messages/en.json` และ `messages/th.json`
- **Blue Glass:** ทั้ง light และ dark ใช้พื้นหลักไล่โทนน้ำเงิน ส่วน sidebar กับ navbar ใช้พื้นโปร่งและ `backdrop-filter: blur(...)`
  การ์ด ตาราง ฟอร์ม และ popover คงพื้นทึบ สีหลักอิงสีแบรนด์ `#0154bd` ในโหมดสว่าง และโหมดมืดใช้โทนที่สว่างขึ้นให้อ่านออก
  ในโหมดมืดต้องไม่เป็นแค่พื้นดำ ต้องมีโทน navy
- **หน้า `/design-system`:** แสดงตัวอย่างธีมได้ เพื่อให้ตรวจ token ของแต่ละธีมได้ในที่เดียว

## สิ่งที่ปล่อยให้ผู้ลงมือทำตัดสิน

- ค่า oklch ที่แน่นอนของแต่ละธีมในทั้งสองโหมด ต้องให้ `--primary` คู่กับ `--primary-foreground` ผ่าน AA
- ค่า alpha และ blur ของกระจก รวมถึงสีไล่ของพื้นหลัก
- ภาพตัวอย่างในเมนูจะเป็นจุดสีหรือ mini preview แบบ `ThemePreview`
- จะเพิ่ม test contrast ของ primary ต่อธีมหรือไม่ ถ้าผู้ใช้ขอ test ในรอบนั้น
