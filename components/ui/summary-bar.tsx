// components/form/summary-footer-bar.tsx
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface SummaryItemConfig {
  key: string;
  label: ReactNode;
  value: ReactNode;
  emphasis?: boolean; // larger text, used for the final "grand total" item
  valueClassName?: string; // override e.g. text-destructive for discount
  suffix?: ReactNode; // e.g. currency code next to grand total
}

interface SummaryBarProps {
  items: SummaryItemConfig[];
  className?: string;
  /**
   * `end` = ชิดขวา (แถบ footer ของเอกสาร) — ตัวคั่นย้ายไปฝั่งขวาของแต่ละช่อง
   * เพราะทุกบรรทัดจบที่ขอบขวา เส้นท้ายบรรทัดจึงถูกตัดทิ้งแทนเส้นหัวบรรทัด
   * (บรรทัดที่ตกลงมาเริ่มกลางกล่อง เส้นซ้ายของมันจะค้างให้เห็น)
   */
  align?: "start" | "end";
}

export function SummaryBar({
  items,
  className,
  align = "start",
}: SummaryBarProps) {
  const end = align === "end";
  return (
    // ทุกบรรทัดอยู่ที่ 12px เท่ากันหมด (text-xs = body จริงของแอปตาม DESIGN.md)
    // ยอดรวมแยกตัวเองด้วย "น้ำหนัก" ไม่ใช่ "ขนาด" — ของเดิมรายการย่อยไม่ได้ระบุ
    // ขนาดเลย จึงตกไปกิน body 17px ที่ globals.css ทำให้ตัวประกอบใหญ่กว่ายอดรวม
    // ที่ระบุ text-sm (14px) ไว้ ซึ่งกลับหัวลำดับความสำคัญ
    // จอแคบตัดบรรทัดทีละช่อง (ป้ายกับตัวเลขไม่แยกกัน) แทนการดันทั้งแถวล้นจอ
    // ตัวคั่นเป็น border-l ของแต่ละช่อง ไม่ใช่ตัวอักษร "|" — แถวในเลื่อนซ้าย 17px
    // (gap 16 + เส้น 1) แล้วกรอบนอก overflow-hidden ตัดเส้นของช่องที่ขึ้นต้นบรรทัดทิ้ง
    // ตัวคั่นจึงไม่ค้างหัว/ท้ายบรรทัดไม่ว่าจะตัดตรงไหน
    <div className={cn("overflow-hidden text-xs tabular-nums", className)}>
      <div
        className={cn(
          "flex flex-wrap items-center gap-x-4 gap-y-1",
          end ? "-mr-[17px] justify-end" : "-ml-[17px]",
        )}
      >
        {items.map((item) => (
          <div
            key={item.key}
            className={cn(
              "border-border flex items-center gap-1.5 whitespace-nowrap",
              end ? "border-r pr-4" : "border-l pl-4",
            )}
          >
            {/* label muted + value 500 = คู่ label→value มาตรฐานของ DESIGN.md
                (ของเดิม label เป็น 600 เท่าค่า ป้ายเลยดังเท่าตัวเลข) */}
            <span className="text-muted-foreground">{item.label}</span>
            <span
              className={cn(
                item.emphasis ? "text-foreground font-semibold" : "font-medium",
                item.valueClassName,
              )}
            >
              {item.value}
            </span>
            {item.suffix && (
              <span className="text-muted-foreground font-normal">
                {item.suffix}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface SummaryFooterBarProps {
  hasRecord: boolean;
  items: SummaryItemConfig[];
  children?: ReactNode; // e.g. action buttons rendered alongside the summary
  className?: string;
}

// Sticky footer wrapper: shows the summary only when hasRecord is true,
// aligns content depending on whether the summary is present.
export function SummaryFooterBar({
  hasRecord,
  items,
  children,
  className,
}: SummaryFooterBarProps) {
  return (
    <div
      className={[
        "bg-background sticky bottom-0 z-20 mt-auto flex flex-wrap items-center gap-3 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:gap-4 lg:flex-nowrap",
        hasRecord ? "justify-between" : "justify-end",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* ชิดขวาคู่กับปุ่ม — ยอดรวมกับปุ่ม submit เป็นจุดจบของเอกสารชุดเดียวกัน */}
      {hasRecord && (
        <SummaryBar items={items} align="end" className="ms-auto" />
      )}
      {/* ms-auto: แถบแคบจนปุ่มตกบรรทัดใหม่ (มือถือ/tablet) ปุ่มยังชิดขวา — justify-between
          ของแถวไม่มีผลกับลูกที่ขึ้นบรรทัดเองคนเดียว มันจะไปเริ่มที่ซ้าย */}
      {children && <div className="ms-auto">{children}</div>}
    </div>
  );
}
