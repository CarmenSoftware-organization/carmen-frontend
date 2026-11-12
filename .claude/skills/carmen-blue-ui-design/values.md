# ค่าและสูตรตามชนิดของหน้า

## ฟอร์ม (form / settings / detail)

```tsx
<FormPageShell width="wide" header={<FormToolbar … />}>
  <form>
    <CompactSection first title={…} description={…}>
      <FieldGrid>{/* ช่อง */}</FieldGrid>
    </CompactSection>
    <div className={SECTION_PAIR}>
      <CompactSection title={…}>…</CompactSection>
      <CompactSection title={…} action={<Button size="sm" … />}>…</CompactSection>
    </div>
  </form>
</FormPageShell>
```

| เรื่อง | ค่า |
|---|---|
| กริดของช่อง (`FieldGrid`) | `grid gap-x-5 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6` ใต้ wrapper `@container` |
| ช่องที่ต้องกว้าง (textarea, ชื่อยาว) | `@md:col-span-2` — ไม่ใช่ `col-span-full` และไม่ใช่ `sm:col-span-2` |
| หมวดคู่ (`SECTION_PAIR`) | `min-[1700px]:grid min-[1700px]:grid-cols-2 min-[1700px]:items-start min-[1700px]:gap-x-5` |
| ระยะระหว่างหมวด | `mt-5` ไม่มีเส้นคั่น |
| หัวข้อหมวด | `text-sm font-semibold` + คำอธิบาย `text-xs text-muted-foreground` บรรทัดเดียวกัน เหนือการ์ด, action ชิดขวา |
| การ์ด | `bg-card rounded-xl border p-4 shadow-sm` |
| ป้ายในโหมดดู | `text-muted-foreground text-xs` ตามด้วยค่า `text-sm` ห่าง `mt-0.5` |
| ป้ายในโหมดแก้ | `text-foreground text-xs font-semibold` |
| ค่าว่างในโหมดดู | `—` สี `text-muted-foreground/60` |

จำนวนคอลัมน์ที่ได้ (sidebar กาง):

| ขนาดจอ | หมวด | `FieldGrid` | `FieldGrid size="item"` |
|---|---|---|---|
| Mobile (390) | เรียงลงมา | 1 | 1 |
| Tablet (768) | เรียงลงมา | 2 | 2 |
| 1366 | เรียงลงมา | 3 | 2 |
| Full HD (1920) | คู่ | การ์ดเต็ม 6 · การ์ดคู่ 3 | 4 |
| 4K (3840) | คู่ | 6 | 6 |

จับคู่หมวดเมื่อสองหมวดสูงใกล้กันและเป็นเรื่องคู่กัน (Hotel | Company) อย่าจับคู่หมวด 3 รายการ
กับหมวด 13 รายการ

## รายการ

**รายการตั้งค่า "ป้ายซ้าย ค่าขวา เต็มความกว้างแถว"** ผิดกติกาข้อ 2 บนจอกว้าง ให้แต่ละรายการเป็น
ช่องของ `FieldGrid`: รหัส/ป้ายบน ค่าหรือคอนโทรลล่าง คำอธิบาย (ถ้าบอกอะไรเพิ่ม) ใต้คอนโทรล —
แบบ `ConfigField` ในหน้า default-setting

**รายการที่เนื้อหาหลายส่วน** (ไอคอน ชื่อ ป้าย สถานะ ตัวอย่างข้อความ) ใช้ `FieldGrid size="item"`
ตัวอย่างข้อความตัดด้วย `line-clamp-2`

**รายการที่ขยายดูรายละเอียดได้** (provider ของ Ask AI): ยุบ = ช่องหนึ่งของกริด ·
ขยาย = `col-span-full` กินเต็มแถวของตัวเอง ขยายได้ทีละตัว ของสองก้อนที่ต้องเทียบกันวางเคียงกัน
ด้วย `@3xl:grid-cols-2` ใต้ `@container` ของตัวเอง

```tsx
<Collapsible open={open} onOpenChange={onOpenChange}
  className={cn("min-w-0", open && "col-span-full")}>
```

**ตารางสรุป "ชื่อชิดซ้าย · ตัวเลขชิดขวา" ในการ์ด** (ไฟล์แนบแยกตามประเภทของหน้า Storage): เป็นรายการ
ป้ายซ้ายค่าขวาเหมือนกัน เปลี่ยนเป็นช่องของ `FieldGrid` — ป้ายบน ค่าหลักล่าง (`text-sm font-medium`)
ค่ารองต่อท้ายเป็น `text-xs text-muted-foreground` คงลำดับการเรียงเดิมไว้

**ของที่มีแถบ progress ไม่กี่ตัว** (database / attachment ของหน้า Storage): วางเคียงกันด้วย
`grid-cols-[repeat(auto-fit,minmax(min(100%,20rem),1fr))]` ชื่อกับตัวเลขอยู่ติดกันชิดซ้าย
(`flex flex-wrap items-baseline gap-x-2`) ไม่ใช่ `justify-between`

**หน้ารายการที่แบ่งเป็นหมวด และแต่ละหมวดมีไม่กี่แถว** (หน้า Interfaces): อย่ายืดแถวให้เต็มจอ
ให้หมวดเรียงเป็นคอลัมน์ด้วย `auto-fit` ไม่ใช่จำนวนคอลัมน์ตายตัว — จำนวนหมวดเปลี่ยนตามข้อมูล
(ใบอนุญาตของ BU) กริด 4 คอลัมน์ที่มี 3 หมวดจะเหลือคอลัมน์ว่างด้านขวา `auto-fit` ยุบคอลัมน์ว่าง
แล้วให้หมวดที่มียืดเต็ม

```tsx
// ขั้นต่ำ = ความกว้างที่แถวข้างในยังโชว์ครบ · min(100%, …) กันล้นบนจอแคบกว่าขั้นต่ำ
<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,46rem),1fr))] items-start gap-5">
  <section>…<ul className="@container …">{/* แถวใช้ @xl: ตามความกว้างการ์ด */}</ul></section>
</div>
```

แถวที่อยู่ในการ์ดของหมวดต้องเปลี่ยน `sm:` เป็น `@xl:` (และใส่ `@container` ที่การ์ด) เพราะการ์ดแคบ
เกิดได้บนจอกว้างเมื่อแตกหลายคอลัมน์

## ตาราง (หน้า list)

หน้า list เต็มความกว้างและกะทัดรัดอยู่แล้ว จุดเดียวที่ผิดกติกาข้อ 2 คือ **ตารางที่มีคอลัมน์สั้น ๆ
ไม่กี่คอลัมน์**: `DataGrid` แบ่งความกว้างตามสัดส่วน `size` บนจอ 4K คอลัมน์จึงห่างกันเป็นพันพิกเซล

```tsx
{ accessorKey: "period", size: 240, … },
{ accessorKey: "start_at", size: 195, … },
// คอลัมน์สุดท้ายรับที่เหลือ → สองคอลัมน์ข้างหน้ากว้างคงที่ เนื้อหาชิดซ้ายจึงอยู่ติดกัน
{ accessorKey: "status", size: 110, meta: { grow: true }, … },
```

ตารางที่มีคอลัมน์ข้อความยาว (description) ให้ติด `grow` ที่คอลัมน์นั้นแทน ตั้ง `size` ให้ผลรวมพอดี
ที่ tablet (ดูกับดักใน `SKILL.md`) `size` ของคอลัมน์ grow คือความกว้างขั้นต่ำของมัน เซลล์ข้อความยาว
ตัดด้วย `block truncate` + `title` ตามความกว้างคอลัมน์ ไม่ใช่ `max-w-*` ตายตัว

**หน้าที่ตั้ง pattern** (running-code) เพิ่มคอลัมน์ที่โชว์ผลลัพธ์จริงของ pattern (กติกาข้อ 8) —
ตัวอย่างเลขที่เอกสาร `PR26110001` ในตาราง ไม่ต้องเปิด dialog ทีละแถว

**ตารางที่คอลัมน์ไม่พอดีกล่อง 662px ที่ tablet** — เลือกตามความกว้างของกล่องที่วัดจริง ไม่ใช่ของจอ:

```tsx
// หน้า: ครอบ DataGrid ด้วยกล่องวัด (ลบขอบ 1px สองข้างของ DataGridContainer)
const [setGridBox, gridBoxWidth] = useElementWidth();
const table = useXxxTable({ …, containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2 });
<div ref={setGridBox}><DataGrid table={table} …>…</DataGrid></div>

// hook ของตาราง: undefined (ยังไม่ได้วัด) = ชุดของกล่องกว้าง
const w = containerWidth ?? Number.POSITIVE_INFINITY;
```

- **คอลัมน์เยอะ (document, 6 คอลัมน์):** ซ่อนคอลัมน์รองเป็นขั้นผ่าน `state.columnVisibility`
  ผู้อัปโหลด ≥1060 · ชนิด ≥890 · เลขลำดับ ≥800 ของที่ซ่อนต้องยังดูได้ทางอื่น (ไอคอนชนิดย้ายไปหน้า
  ชื่อไฟล์ ผู้อัปโหลดอยู่ในมุมมอง preview)
- **คอลัมน์น้อยแต่ค่ากว้าง (user: ชื่อ อีเมล แผนก):** ไม่ซ่อน สลับชุด `size` สองชุด — กล่อง ≥900
  ชื่อ 240 / อีเมล 280 ต่ำกว่านั้น 180 / 190 คอลัมน์สุดท้าย (แผนก) เป็นตัว grow
- เขียนผลรวม `size` ของแต่ละขั้นไว้ในคอมเมนต์เหนือฟังก์ชันขั้น แก้ขนาดคอลัมน์เมื่อไรต้องคิดใหม่
- หน้าที่ไม่มี `"use no memo"` ต้องลองย่อ-ขยายกล่องสด ๆ ว่าคอลัมน์สลับตาม (React Compiler อาจแช่ JSX)

**ตาราง HTML ธรรมดา (`<table className="w-full">`)** — เบราว์เซอร์แบ่งที่เหลือให้ทุกคอลัมน์ ให้
คอลัมน์ข้อมูลกว้างเท่าเนื้อหาด้วย `w-px whitespace-nowrap` (+ `pr-10` เป็นช่องไฟ) แล้วปล่อยคอลัมน์
สุดท้าย (ปุ่มของแถว ชิดขวา) รับที่เหลือ เนื้อหาในคอลัมน์ `w-px` ห้าม `flex-wrap` ไม่งั้นคอลัมน์หด
เหลือเท่าชิ้นที่กว้างสุดแล้วป้ายตกบรรทัด

ถ้าตารางมีคอลัมน์ข้อความยาว (หัวเรื่อง, description) ให้คอลัมน์นั้นเป็นตัวยืดหดตัวเดียว:
`<td className="w-full max-w-0">` + `<span className="block truncate" title={…}>` (`max-w-0` ทำให้
เซลล์ไม่ดันตารางให้กว้างตามข้อความ) หัวคอลัมน์ใส่ `min-w-40` ส่วนคอลัมน์ปุ่มกลับมาเป็น `w-px`
อย่าใช้ `max-w-*` ตายตัวกับข้อความยาว — หัวเรื่องถูกตัดที่ 256px ทั้งที่จอมีที่ และพอรวมกับคอลัมน์
nowrap อื่นตารางล้นที่ 1366px

ตารางที่กว้างขั้นต่ำเกินกล่อง: สลับเป็นรายการแบบซ้อนตามความกว้างของกล่อง (`@container` +
`@xl:hidden` / `hidden @xl:block`) โดยสร้างชิ้นส่วนของแถว (ชื่อ สถานะ ปุ่ม) ครั้งเดียวแล้วใช้ทั้งสอง
แบบ **จุดสลับ = ความกว้างขั้นต่ำของตารางที่วัดได้จริง** ไม่ใช่ค่าเดียวทุกหน้า: email-profile
(4 คอลัมน์ ~610px) สลับที่ `@xl`, email-template (5 คอลัมน์ ~890px) สลับที่ `@4xl` วัดด้วย
`table.offsetWidth` เทียบ `table.parentElement.clientWidth` ที่ทุกขนาดรวม 1024 และ 1180
ตัวอย่าง: `routes/system-admin/email-profile/`, `routes/system-admin/email-template/`

## แถบ (footer status bar, toolbar, แถบสรุป)

แถบที่สองฝั่งชิดซ้าย–ชิดขวา (`justify-between`) ทับกันเมื่อเลือกของที่โชว์จากความกว้างของจอ

```tsx
<footer className="@container flex items-center justify-between gap-3 …">
  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
    <span className="truncate">{name}</span>
    <span className="hidden shrink-0 @md:inline">{buCode}</span>
  </div>
  <div className="flex shrink-0 items-center gap-3">
    <span className="hidden @md:flex">{time}</span>
    <span className="hidden @4xl:flex">{apiVersion}</span>
  </div>
</footer>
```

- เรียงของตามความสำคัญ ของสำคัญน้อยโผล่เมื่อแถบกว้างขึ้น
- ของที่ซ่อนต้องยังเข้าถึงได้ทางอื่น (tooltip, `aria-label`, หรือมีอยู่ที่อื่นของหน้า)
- ข้อความที่ `truncate` จนเหลือไม่กี่ตัวอักษร ("Admi…") = ยังโชว์ของมากเกินไป ซ่อนเพิ่ม

**แถบสรุปเหนือตาราง** (ยอดรวม + รายการแจกแจง + ลิงก์ดูทั้งหมด ของหน้า Document): ทุกชิ้นอยู่ติดกัน
ชิดซ้าย ไม่ใช่ยอดรวมซ้าย–รายการขวา และเรียงแนวนอนเมื่อแถบเองกว้างพอ (`@container` + `@xl:flex-row`)

**แถบค้นหาของหน้า list** (กติกาข้อ 12): ช่องค้น → ปุ่ม View → ปุ่ม Filter เรียงติดกันชิดซ้าย ใช้
`ListToolbar` เสมอ ถ้าต้องวางเอง กล่องครอบช่องค้นห้ามยืดตั้งแต่ `md` (ช่องค้นกว้างคงที่ที่ขนาดนั้น):

```tsx
<div className="flex w-full items-center gap-2">
  <div className="flex-1 md:flex-initial"><SearchInput … /></div>
  <ViewSelector … />
  <ListFilter … />
</div>
```

วัดด้วยระยะจากขอบขวาของช่องค้นถึงขอบซ้ายของปุ่ม View — ต้องเท่ากันทุกขนาดจอตั้งแต่ tablet (17px)

ขั้นของ `status-bar.tsx`: แคบกว่า 448px โชว์ชื่อ · รหัสรอบ · App v → เวลา + รหัส BU + ป้าย
"Period" (`@md` 448px) → commit hash (`@2xl` 672px) → ป้าย "Inventory period" เต็ม + เวอร์ชัน
API (`@4xl` 896px)
