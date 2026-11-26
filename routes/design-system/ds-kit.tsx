import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * ชิ้นส่วนกลางของหน้า /design-system — ไม่ใช่ของใช้ทั่วแอป
 *
 * หน้านี้เป็น **reference** ของ design system ที่มีอยู่จริง (`styles/globals.css`
 * + `components/ui/`) ไม่ใช่ระบบที่สอง ทุกอย่างในนี้จึงประกอบจาก token และ
 * primitive เดิมเท่านั้น ห้ามประกาศสี/ขนาดใหม่ — ถ้าหน้านี้ต้องใช้ค่าที่ยังไม่มี
 * แปลว่า design system ขาด ไม่ใช่หน้านี้ขาด
 */

/** หัวข้อหนึ่งบล็อกในหน้า — preview → คำอธิบาย → โค้ดตัวอย่าง */
export function DsSection({
  id,
  title,
  description,
  usage,
  code,
  children,
}: Readonly<{
  id: string;
  title: string;
  description?: ReactNode;
  usage?: ReactNode;
  code?: string;
  children: ReactNode;
}>) {
  return (
    <section
      id={id}
      className="scroll-mt-20 border-b border-border-subtle pb-10 last:border-0"
    >
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {description ? (
        <p className="mt-1.5 max-w-3xl text-sm text-muted-foreground">
          {description}
        </p>
      ) : null}

      <div className="mt-5 rounded-xl border bg-card p-5 shadow-xs">
        {children}
      </div>

      {usage ? (
        <div className="mt-3 rounded-lg border border-border-subtle bg-surface-2 px-4 py-3 text-xs text-muted-foreground">
          {usage}
        </div>
      ) : null}

      {code ? <DsCode code={code} /> : null}
    </section>
  );
}

/** กล่องโค้ดพร้อมปุ่มคัดลอก — ตัวอย่างที่วางใช้ได้จริง */
export function DsCode({ code }: Readonly<{ code: string }>) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="group relative mt-3">
      <pre className="overflow-x-auto rounded-lg border border-border-subtle bg-surface-2 p-4 text-micro leading-relaxed">
        <code className="font-mono">{code}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={copy}
        aria-label="คัดลอกโค้ด"
        className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <Check className="text-success-ink" /> : <Copy />}
      </Button>
    </div>
  );
}

/** แถวย่อยในหนึ่ง section — ป้ายกำกับซ้าย ของจริงขวา */
export function DsRow({
  label,
  hint,
  children,
}: Readonly<{ label: string; hint?: string; children: ReactNode }>) {
  return (
    <div className="flex flex-col gap-2 border-b border-border-subtle py-3.5 first:pt-0 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:gap-6">
      <div className="sm:w-44 sm:shrink-0">
        <div className="font-mono text-micro text-foreground">{label}</div>
        {hint ? (
          <div className="mt-0.5 text-micro-legal text-muted-foreground">
            {hint}
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">{children}</div>
    </div>
  );
}

/**
 * ตัวอย่างสีหนึ่งช่อง
 *
 * `token` คือชื่อ CSS variable โดยไม่มี `--` นำหน้า — ช่องสีวาดด้วย
 * `background: var(--<token>)` ตรง ๆ ไม่ใช่ utility `bg-<token>` เพราะ token
 * ฝั่ง status (`--status-*`) ไม่ได้ถูกประกาศเป็นสี Tailwind จริง
 * (ดู styles/badge-status.css — `@theme inline` ตรงนั้นเป็นโค้ดที่ไม่มีผล)
 */
export function DsSwatch({
  token,
  on,
  className,
}: Readonly<{ token: string; on?: string; className?: string }>) {
  return (
    <div className={cn("w-[10.5rem]", className)}>
      <div
        className="flex h-12 items-center justify-center rounded-md border border-border-subtle text-micro font-semibold"
        style={{
          background: `var(--${token})`,
          color: on ? `var(--${on})` : undefined,
        }}
      >
        {on ? "Aa ก" : ""}
      </div>
      <div className="mt-1 truncate font-mono text-micro-legal text-muted-foreground">
        --{token}
      </div>
    </div>
  );
}
