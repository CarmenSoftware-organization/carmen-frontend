import { DsSection, DsSwatch } from "../ds-kit";

const CORE = [
  { token: "background", on: "foreground" },
  { token: "foreground", on: "background" },
  { token: "card", on: "card-foreground" },
  { token: "popover", on: "popover-foreground" },
  { token: "primary", on: "primary-foreground" },
  { token: "secondary", on: "secondary-foreground" },
  { token: "muted", on: "muted-foreground" },
  { token: "accent", on: "accent-foreground" },
  { token: "border" },
  { token: "input" },
  { token: "ring" },
];

const SEMANTIC = [
  { token: "destructive", on: "destructive-foreground" },
  { token: "success", on: "success-foreground" },
  { token: "info", on: "info-foreground" },
  { token: "warning", on: "warning-foreground" },
  { token: "positive", on: "positive-foreground" },
  { token: "negative", on: "negative-foreground" },
  { token: "invert", on: "invert-foreground" },
];

const SURFACE = [
  { token: "surface-1" },
  { token: "surface-2" },
  { token: "neutral", on: "neutral-foreground" },
  { token: "border-strong" },
  { token: "border-subtle" },
  { token: "disabled", on: "disabled-foreground" },
  { token: "selected" },
  { token: "highlight", on: "highlight-foreground" },
];

const CHARTS = [
  "chart-1",
  "chart-2",
  "chart-3",
  "chart-4",
  "chart-5",
  "chart-6",
  "chart-7",
  "chart-8",
];

const INKS = [
  { token: "brand-ink", label: "text-brand-ink" },
  { token: "info-ink", label: "text-info-ink" },
  { token: "success-ink", label: "text-success-ink" },
  { token: "warning-ink", label: "text-warning-ink" },
  { token: "positive-ink", label: "text-positive-ink" },
  { token: "negative-ink", label: "text-negative-ink" },
];

export function ColorsSection() {
  return (
    <>
      <DsSection
        id="colors-core"
        title="Colors — core"
        description={
          <>
            พื้นผิวและ accent หลัก ประกาศเป็น OKLCH ที่ <code>:root</code> และ{" "}
            <code>.dark</code> ใน <code>styles/globals.css</code> แล้วเปิดเป็น
            utility ผ่าน <code>@theme inline</code> — ใช้{" "}
            <code>bg-primary</code> / <code>text-muted-foreground</code> ได้ตรง ๆ
            ห้ามใส่ค่าสีดิบที่ call site
          </>
        }
        usage={
          <>
            <b>สีคู่กันเสมอ:</b> ทุก token ที่เป็นพื้นมีคู่ <code>-foreground</code>{" "}
            สำหรับตัวอักษรที่วางทับ อย่าจับคู่ข้ามชุดเอง ·{" "}
            <b>accent เดียวต่อหนึ่งชิ้น</b> — DESIGN.md ห้ามซ้ำสีเดียวกันที่กล่อง +
            ไอคอน + ชิปพร้อมกัน (อ่านเป็นนีออน)
          </>
        }
        code={`<div className="bg-card text-card-foreground border rounded-xl p-4">
  <p className="text-muted-foreground text-xs">Subtotal</p>
  <p className="text-primary font-semibold">1,240.00</p>
</div>`}
      >
        <div className="flex flex-wrap gap-3">
          {CORE.map((c) => (
            <DsSwatch key={c.token} token={c.token} on={c.on} />
          ))}
        </div>
      </DsSection>

      <DsSection
        id="colors-semantic"
        title="Colors — semantic"
        description="สีที่แปลว่าอะไรบางอย่าง ไม่ใช่สีที่สวย — ใช้เป็นพื้น (fill) เท่านั้น"
        usage={
          <>
            token กลุ่มนี้เป็น <b>สีพื้น</b> ความสว่างถูกจูนให้ label ที่วางทับอ่านได้
            ถ้าเอาไปใช้เป็น <code>text-*</code> บนพื้นหน้าจะตกเกณฑ์ WCAG AA —
            ใช้ <code>-ink</code> แทน (ดูหัวข้อถัดไป)
          </>
        }
      >
        <div className="flex flex-wrap gap-3">
          {SEMANTIC.map((c) => (
            <DsSwatch key={c.token} token={c.token} on={c.on} />
          ))}
        </div>
      </DsSection>

      <DsSection
        id="colors-ink"
        title="Colors — status inks"
        description={
          <>
            เฉดเดียวกับ semantic แต่แก้ค่าความสว่างให้ผ่าน 4.5:1 เมื่อใช้เป็น{" "}
            <b>ตัวอักษร</b> คำนวณกับพื้นผิวที่แย่ที่สุดที่ข้อความจะไปตกได้ (
            <code>--accent</code>) ไม่ใช่แค่พื้นหน้า
          </>
        }
        usage={
          <>
            <code>lib/__tests__/status-ink-contrast.test.ts</code>{" "}
            คำนวณค่าเหล่านี้ใหม่จาก CSS ทุกครั้งที่รันเทสต์ และจะแดงถ้ามีใครเอา
            token พื้นกลับไปใช้เป็น <code>text-*</code> อีก
          </>
        }
        code={`<span className="text-warning-ink text-xs">เกินงบ 12%</span>
<span className="text-success-ink text-xs">ผ่านการอนุมัติ</span>`}
      >
        <div className="flex flex-col gap-2">
          {INKS.map((i) => (
            <div key={i.token} className="flex items-center gap-4">
              <span
                className="w-52 text-sm font-semibold"
                style={{ color: `var(--${i.token})` }}
              >
                {i.label}
              </span>
              <span className="rounded bg-accent px-2 py-1 text-xs">
                <span style={{ color: `var(--${i.token})` }}>
                  บนพื้น --accent (เคสที่แย่ที่สุด)
                </span>
              </span>
            </div>
          ))}
        </div>
      </DsSection>

      <DsSection
        id="colors-surface"
        title="Colors — surface & state"
        description="ชั้นความลึกของพื้นผิว เส้นขอบสองน้ำหนัก และสถานะ disabled / selected / highlight"
      >
        <div className="flex flex-wrap gap-3">
          {SURFACE.map((c) => (
            <DsSwatch key={c.token} token={c.token} on={c.on} />
          ))}
        </div>
      </DsSection>

      <DsSection
        id="colors-chart"
        title="Colors — chart series"
        description="ลำดับสีสำหรับกราฟ 8 ค่า ใช้ตามลำดับเสมอเพื่อให้กราฟคนละหน้าอ่านเทียบกันได้"
        code={`<Bar dataKey="qty" fill="var(--chart-1)" />`}
      >
        <div className="flex flex-wrap gap-3">
          {CHARTS.map((t) => (
            <DsSwatch key={t} token={t} className="w-28" />
          ))}
        </div>
      </DsSection>
    </>
  );
}
