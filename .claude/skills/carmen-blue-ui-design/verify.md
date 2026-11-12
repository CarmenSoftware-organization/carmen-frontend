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
- [ ] `bun run typecheck` · `bun run lint` · เทสต์ของโฟลเดอร์ที่แตะ
- [ ] ข้อไหนไม่ได้ตรวจ ขนาดไหนไม่ได้เปิดดู ให้บอกผู้ใช้ตรง ๆ — อย่ารายงานว่าครบ
