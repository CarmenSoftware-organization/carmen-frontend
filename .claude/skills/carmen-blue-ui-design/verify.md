# วิธีตรวจ 5 ขนาดจอ

ฝัง iframe same-origin ของหน้าเดียวกันด้วยความกว้างที่ต้องการ — media query และ container query
ข้างในทำงานตามความกว้างของ iframe (`resize_window` เชื่อไม่ได้) iframe ที่ใหญ่กว่าจอถูกย่อด้วย
`transform` ให้พอดี ค่าที่วัดจาก `contentDocument` ยังเป็นพิกเซลจริงของ iframe ไม่ต้องหารด้วยสเกล

## สคริปต์

รันครั้งเดียวในแท็บที่เปิดหน้านั้นอยู่ แล้วเรียก `await __vp(W, H)` ต่อขนาด คืนผลวัดเป็นข้อความ

```js
window.__vp = async (W, H, { edit = false, dark = false } = {}) => {
  document.getElementById("__vp")?.remove();
  const f = document.createElement("iframe");
  f.id = "__vp";
  f.src = location.href;
  const s = Math.min(1, innerWidth / W, innerHeight / H);
  f.style.cssText = `position:fixed;top:0;left:0;width:${W}px;height:${H}px;transform:scale(${s});transform-origin:top left;z-index:99999;background:#fff;border:0`;
  document.body.appendChild(f);
  await new Promise((r) => setTimeout(r, 4500)); // รอ boot + ดึงข้อมูล
  const d = f.contentDocument;
  if (edit) {
    [...d.querySelectorAll("button")].find((b) => /Edit/.test(b.textContent))?.click();
    await new Promise((r) => setTimeout(r, 700));
  }
  if (dark) d.documentElement.classList.replace("light", "dark") || d.documentElement.classList.add("dark");
  const out = [`${W}: page ${d.documentElement.scrollWidth}`];
  const t = d.querySelector("table");
  if (t) out.push(`table ${t.offsetWidth}/${t.parentElement.clientWidth} cols ${[...t.querySelectorAll("thead th")].map((th) => Math.round(th.getBoundingClientRect().width)).join("/")}`);
  const bar = d.querySelector("[data-slot=status-bar]");
  if (bar) {
    const [l, r] = bar.children;
    const last = [...l.children].filter((e) => e.getBoundingClientRect().width > 0).pop();
    out.push(`footer gap ${Math.round(r.getBoundingClientRect().left - last.getBoundingClientRect().right)} scroll ${bar.scrollWidth}/${bar.clientWidth}`);
  }
  return out.join(" | ");
};
const sizes = [[390, 844], [768, 1024], [1366, 768], [1920, 1080], [3840, 2160]];
const res = [];
for (const [W, H] of sizes) res.push(await __vp(W, H));
res;
```

วัดเกิน 4 ขนาดต่อการเรียก `javascript_tool` หนึ่งครั้งจะ timeout ที่ 45 วินาที — แบ่งเป็นสองชุด

อ่านผล:

- `page` ต้องเท่ากับ `W` — มากกว่า = หน้ามี scroll แนวนอน
- `table a/b` ต้อง `a ≤ b` — มากกว่า = ตารางล้นในกรอบของมัน
- `footer gap` ต้องเป็นบวก และ `scroll` สองค่าเท่ากัน — ติดลบ = ข้อความทับกัน

ถ่ายภาพหลังเรียกแต่ละขนาด พิกัดของ `zoom` เป็นพิกัดของภาพหน้าจอ ไม่ใช่ของ viewport: iframe กว้าง
`W × s` พิกเซลของ viewport ต้องคูณด้วย (ความกว้างภาพหน้าจอ ÷ `innerWidth`) อีกที

## ตรวจการกดจริง (ไม่ใช่แค่ขนาดจอ)

จัด layout ของฟอร์มแล้วต้องลองกดจริงด้วย — บั๊กของหน้า `/profile/setting` (2026-11-13) วัดขนาดจอ
ครบ 5 ขนาดก็ไม่เจอ เจอตอนกด Save

- **Save → แก้ช่องเดิมกลับเป็นค่าเก่าภายใน 3 วินาที → Save อีกรอบ** ปุ่มต้อง enabled และค่าต้องถูก
  บันทึก (reload แล้วเช็ก) ฟอร์มที่ผูก `values` กับข้อมูลจาก query พังตรงนี้ถ้าขาดสองอย่าง:
  `resetOptions: { keepDirtyValues: true }` (refetch ไม่ทับช่องที่กำลังแก้) และ mutation ที่
  `setQueryData` ค่าที่เพิ่งบันทึกก่อน `invalidateQueries` (ไม่งั้นช่วงรอ refetch ฟอร์มถือค่าเก่าเป็น
  default แก้กลับเป็นค่าเดิมแล้วปุ่ม Save disabled) ตัวอย่าง: `hooks/use-profile.ts`
  `useUpdateProfile`, `routes/profile/user-profile-setting.tsx`
- ตั้งค่า input ด้วย native setter + `input` event (`el.value = …` เฉย ๆ React ไม่เห็น) —
  แต่ setter **ข้าม `disabled`** ได้ ผลที่ได้ตอนช่องถูก disable (ระหว่าง mutation pending) ไม่ใช่
  พฤติกรรมของผู้ใช้จริง อย่าตีความเป็นบั๊ก
- ฟังก์ชันที่ฝากไว้บน `window` (`__vp`) หายทุกครั้งที่หน้า reload/navigate — ประกาศใหม่
- ผลลัพธ์ที่มี `=` ถูก extension บล็อกเป็น "Cookie/query string data" ทั้งที่สคริปต์รันจบแล้ว —
  อย่ารันซ้ำโดยไม่เช็กสถานะ ใช้ `:` แทน
- dialog ที่มีช่องรหัสผ่าน (Change Password) ทำ extension หลุด ("Detached") — ตรวจด้วยตาเอง
  สคริปต์ที่หลุดกลางทาง**ยังรันต่อจนจบ** ถ่ายภาพดูสถานะก่อนทำอะไรต่อ
- ทดสอบบน dev DB ที่ใช้ร่วมกัน: จดค่าเดิมก่อนแก้ แก้กลับแล้ว reload ยืนยัน · ของที่สร้างเพื่อทดสอบ
  (โทเค็น ลายเซ็น) ลบออก · **ไม่อัปโหลดทับรูป/ไฟล์ที่มีอยู่** (กู้คืนไม่ได้) และไม่กด "ลบทั้งหมด"
- สลับภาษา: `localStorage["carmen.locale"] = "th"` แล้วโหลด iframe ใหม่ เสร็จแล้วตั้งกลับ

## หน้า landing

- **จำนวนคอลัมน์** = จำนวนค่า `left` ที่ไม่ซ้ำของหมวด · **ความกว้างการ์ด** ต้องอยู่ราว 280–400px
  ทุกขนาด · **ความยาวหน้า** = ขอบล่างของหมวดที่ต่ำสุด − ขอบบนของ `h1` เทียบกับความสูง viewport
- **ภาพประกอบถูกตัดขอบไหม**: ขอบบนของเนื้อภาพ (`box.firstElementChild.firstElementChild`) ต้องไม่
  อยู่เหนือขอบบนของกรอบภาพ — ลดความสูงกรอบแล้วภาพ 4 แถวจะโดนตัดเงียบ ๆ
- **คีย์แปลดิบ**: ข้อความที่ขึ้นต้นด้วย namespace (`systemAdmin.`) ต้องเป็น 0 — แท็บที่เปิดค้างไว้ก่อน
  แก้ไฟล์แปลยังถือข้อความชุดเก่า ต้อง reload ก่อนเชื่อ
- **เปิดปลายทางให้ครบทุกใบ**: เก็บ `href` ของทุกการ์ด แล้วโหลดทีละ path ใน iframe (ครั้งละ ~3 วินาที
  แบ่งชุดละ 5–6 ใบ) เช็กว่า `location.pathname` ตรง และไม่มี `[role=alert]` · กดการ์ดจริงอย่างน้อย 1 ใบ
- **สถานะล็อก / ไม่มีสิทธิ์ / ถูกซ่อน** ดูไม่ได้ด้วยบัญชี admin — บังคับสถานะชั่วคราวในโค้ดของหน้า
  (แก้ค่าใน map ของสิทธิ์ ติดป้าย `__TEMP_VERIFY__`) เปิดดูและกดจริง แล้ว**ถอดออกและ grep ยืนยัน
  ก่อน commit** ดูให้ครบ 4 แบบ: ล็อก (กุญแจ + dialog license), ไม่มีสิทธิ์ (dialog permission),
  การ์ดหาย, หมวดหายทั้งหมวด (เลขหมวดต้องไม่กระโดด จำนวนคอลัมน์ลดตาม) บอกผู้ใช้ด้วยว่าเป็นการจำลอง
  ไม่ใช่บัญชี non-admin จริง

## ตรวจให้ครบก่อนบอกว่าเสร็จ

- [ ] โหมดดู **และ** โหมดแก้ ที่ทั้ง 5 ขนาด (`{ edit: true }`)
- [ ] ไม่มี scroll แนวนอนของหน้า และตารางไม่ล้นกรอบ
- [ ] ตารางที่เลือกคอลัมน์/ขนาดตามความกว้างกล่อง: วัดเพิ่มที่ 1024, 1180, 1280 (ขั้นเปลี่ยนในช่วงนี้)
      และย่อ-ขยาย iframe สด ๆ (`f.style.width = "900px"`) ว่าคอลัมน์สลับตาม
- [ ] แถบค้นหา: ระยะจากช่องค้นถึงปุ่ม View เท่ากันทุกขนาดตั้งแต่ tablet
- [ ] footer / แถบของ shell ไม่ทับกันที่ mobile และ tablet
- [ ] dark mode อย่างน้อยหนึ่งขนาด (`{ dark: true }`)
- [ ] skeleton ตอนโหลด และสถานะว่าง (ไม่มีข้อมูล)
- [ ] สถานะที่ขยาย/เปิดได้ของรายการ (ทั้งแบบมีและไม่มีเนื้อหาเปรียบเทียบ)
- [ ] ฟอร์ม: ข้อความ error ใต้ช่อง · Save แล้วแก้กลับภายใน 3 วินาที (ดูหัวข้อ "ตรวจการกดจริง")
- [ ] ภาษาไทยอย่างน้อยที่ mobile กับ 1366 · ของที่จำนวนเปลี่ยนตามข้อมูลลองที่ค่าสูงสุด (เช่น 10 scope)
- [ ] แก้ของกลาง (`CompactSection` ฯลฯ) → เปิดทุกหน้าที่ใช้มัน ไม่ใช่แค่หน้าที่กำลังทำ
- [ ] หน้า landing: ไม่มีตัวเลขตายตัว · การ์ดครบทุกหน้าในเมนู · เปิดปลายทางครบทุกใบ · สถานะสิทธิ์ 4 แบบ
- [ ] `bun run typecheck` · `bun run lint` · เทสต์ของโฟลเดอร์ที่แตะ
- [ ] ข้อไหนไม่ได้ตรวจ ขนาดไหนไม่ได้เปิดดู ให้บอกผู้ใช้ตรง ๆ — อย่ารายงานว่าครบ
