---
name: carmen-blue-ui-design
description: ใช้เมื่อจัดหรือปรับ layout หน้าจอของ CARMEN BLUE — หน้า form / settings / detail ที่ต้องเต็มความกว้างจอ กะทัดรัด และรองรับ 5 ขนาดจอ (mobile, tablet, 1366, Full HD, 4K) หรือเมื่อผู้ใช้บอกว่าหน้า "โล่ง" "ยืด" "ไม่ compact" "มีที่ว่างซ้ายขวา"
---

# CARMEN BLUE — การจัดหน้าจอ

กติกาชุดนี้ผู้ใช้กำหนดเองทีละข้อบนหน้า `/system-admin/company-profile` (2026-11-12, PR #547)
ซึ่งเป็นหน้าอ้างอิง โทเค็นสี/ตัวอักษร/primitive ยังเป็นเรื่องของ `docs/DESIGN.md` และหน้า
`/design-system` — skill นี้ว่าด้วย **การวางพื้นที่** เท่านั้น

## กติกา

1. **เต็มความกว้างจอทุกขนาด** — ไม่มี `max-w-*` ครอบเนื้อหา ไม่มีคอลัมน์หัวข้อเปล่าด้านข้าง
   ที่ว่างที่ยอมได้มีแค่ gutter ของ shell กับ gap ภายใน ใช้ `FormPageShell width="wide"`
2. **จอกว้างขึ้น = คอลัมน์มากขึ้น ไม่ใช่ช่องกว้างขึ้น** — ค่าที่ลอยห่างจากป้ายเป็นคืบอ่านยาก
   กว่าหน้าที่ถูกจำกัดความกว้างเสียอีก
3. **นับคอลัมน์จากความกว้างของการ์ด ไม่ใช่ของจอ** — ใช้ container query การ์ดครึ่งจอกับการ์ด
   เต็มจอจึงใช้กฎเดียวกัน และพับ/กาง sidebar แล้วยังถูก
4. **หมวดที่เป็นคู่กันวางเคียงกันบนจอกว้าง** — ต่ำกว่านั้นเรียงลงมาเต็มความกว้าง
5. **กะทัดรัด** — ระยะห่างต้องไม่กินที่มากกว่าเนื้อหา (ตัวเลขอยู่ในตารางข้างล่าง)
6. **ไม่มีเมนูข้ามหมวดด้านข้าง** — เมื่อช่องเรียงหลายคอลัมน์ หน้าสั้นจนไม่ต้องใช้
7. **โหมดดูไม่ใส่กรอบให้ค่า** — ป้ายจาง + ค่าตัวเข้ม (`FieldPlainText`, น้ำหนัก 500) กรอบมีเฉพาะ
   ช่องที่กรอกได้จริงในโหมดแก้ ค่าในกล่องเทามีขอบอ่านเป็น input ที่ถูก disable
8. **ค่าตั้งแบบ pattern โชว์ผลลัพธ์เป็นหลัก** — `2026-11-12` เป็นค่าหลัก `yyyy-MM-dd` เป็นบรรทัดรอง
   (mono, muted) pattern ใช้ไม่ได้ → ค่าดิบกลับมาเป็นค่าหลัก
9. **ข้อความช่วยใต้ช่องมีเฉพาะที่บอกอะไรเพิ่ม** — ที่แค่ทวนป้าย ("Hotel Email: Contact email of
   the hotel") ตัดออก มันกินหนึ่งบรรทัดต่อช่อง
10. **อ่านออกทั้ง light และ dark** — ใช้โทเค็นเท่านั้น

## ค่าที่ใช้

| เรื่อง | ค่า |
|---|---|
| กริดของช่องในการ์ด | `grid gap-x-5 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6` ใต้ wrapper `@container` |
| ช่องที่ต้องกว้าง (textarea, ชื่อยาว) | `@md:col-span-2` — ไม่ใช่ `col-span-full` และไม่ใช่ `sm:col-span-2` (breakpoint ของจอไม่รู้ความกว้างการ์ด) |
| หมวดคู่ | `min-[1700px]:grid min-[1700px]:grid-cols-2 min-[1700px]:items-start min-[1700px]:gap-x-5` |
| ระยะระหว่างหมวด | `mt-5` ไม่มีเส้นคั่น (ขอบการ์ดแยกหมวดให้แล้ว) |
| หัวข้อหมวด | `text-sm font-semibold` + คำอธิบาย `text-xs text-muted-foreground` **บรรทัดเดียวกัน** อยู่เหนือการ์ด, action ชิดขวา |
| การ์ด | `bg-card rounded-xl border p-4 shadow-sm` |
| ป้ายในโหมดดู | `text-muted-foreground text-xs` ตามด้วยค่า `text-sm` ห่าง `mt-0.5` |
| ค่าว่างในโหมดดู | `—` สี `text-muted-foreground/60` |

ผลที่ได้เมื่อ sidebar กาง:

| ขนาดจอ | หมวด | คอลัมน์ในการ์ด |
|---|---|---|
| Mobile (390) | เรียงลงมา | 1 |
| Tablet (768) | เรียงลงมา | 2 |
| 1366 | เรียงลงมา | 3 |
| Full HD (1920) | คู่ | การ์ดเต็ม 6 · การ์ดคู่ 3 |
| 4K (3840) | คู่ | 6 |

## ของที่มีอยู่แล้ว

- `components/share/compact-section.tsx` — `CompactSection`, `CompactSectionSkeleton`,
  `FieldGrid`, `SECTION_PAIR` ใช้ตัวนี้ อย่าเขียนชุดที่สอง
- `routes/system-admin/company-profile/company-profile-ui.tsx` — `SettingField` (prop `specimen`
  ของข้อ 8) และ `ConfigField` (ช่อง config: รหัสเอกสาร + ป้ายบน ค่า/คอนโทรลล่าง) ยังเป็นของ
  โมดูล system-admin โมดูลอื่นที่ต้องใช้ให้ยกขึ้น `components/` ก่อน (ESLint ห้าม
  `routes/<A>/` → `routes/<B>/`)

หน้าที่ใช้แล้ว: `/system-admin/company-profile` (PR #547), `/system-admin/default-setting`

รายการตั้งค่าแบบ "ป้ายซ้าย ค่าขวา เต็มความกว้างแถว" ผิดกติกาข้อ 2 บนจอกว้าง — ให้เป็นช่องของ
`FieldGrid` (ป้ายบน ค่าล่าง) แทน แบบที่ `ConfigField` ทำ

## กับดัก

- **อย่าแก้ `components/ui/setting-section.tsx` ให้กะทัดรัดทั้งตัว** — config-email,
  notification-template และทุกฟอร์มของ vendor-management ใช้ layout หัวข้อซ้าย 1/3 + การ์ดขวา
  2/3 ของมันอยู่ ผู้ใช้ยังไม่ได้สั่งเปลี่ยนหน้าพวกนั้น ถามก่อน
- **`@md:` ไม่ทำงานถ้าไม่มี ancestor ที่เป็น `@container`** — ไม่มี error คอลัมน์แค่ไม่แตก
- **ห้ามเขียน `max-w-4xl` หรือ padding safe-area ที่หน้าเอง** — มาจาก `FormPageShell`
  (`components/share/__tests__/form-page-shell.usage.test.ts` ดักอยู่)
- **ช่องที่กิน 2 คอลัมน์สองช่องติดกันในกริด 3 คอลัมน์จะลงไปคนละแถว** — เหลือช่องที่ต้องกว้าง
  จริง ๆ ช่องเดียวต่อหมวด
- **skeleton ต้องเป็นโครงเดียวกับหน้าจริง** (ความกว้าง ระยะ การจับคู่) ไม่งั้นเนื้อหากระโดดตอน
  ข้อมูลมา

## วิธีตรวจ 5 ขนาดจอ

`resize_window` ของ Chrome extension รายงานว่าสำเร็จแต่ viewport ไม่เปลี่ยน (ยืนยัน 2026-11-12)
ให้ฝัง iframe same-origin ของหน้าเดียวกันด้วยความกว้างที่ต้องการแทน — media query และ
container query ข้างในทำงานตามความกว้างของ iframe

```js
// รันในแท็บที่เปิดหน้านั้นอยู่ แล้วถ่ายภาพหน้าจอ
const show = (W, H) => {
  document.getElementById("__vp")?.remove();
  const f = document.createElement("iframe");
  f.id = "__vp";
  f.src = location.href;
  const s = Math.min(1, innerWidth / W, innerHeight / H);
  f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;transform:scale(${s});transform-origin:top left;z-index:99999;background:#fff;border:0`;
  document.body.appendChild(f);
};
show(390, 844); // 768×1024 · 1366×768 · 1920×1080 · 3840×2160
```

ตรวจให้ครบก่อนบอกว่าเสร็จ:

- โหมดดู **และ** โหมดแก้ ที่ทั้ง 5 ขนาด
- ไม่มี scroll แนวนอน: `iframe.contentDocument.documentElement.scrollWidth` เท่ากับความกว้างที่ตั้ง
- dark mode อย่างน้อยหนึ่งขนาด
- skeleton ตอนโหลด
- ขนาดไหนไม่ได้เปิดดู ให้บอกผู้ใช้ตรง ๆ ว่าไม่ได้ดู
