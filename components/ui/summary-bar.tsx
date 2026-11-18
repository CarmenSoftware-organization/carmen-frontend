// components/form/summary-footer-bar.tsx
import type { ReactNode } from "react";
import { ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

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
}

export function SummaryBar({ items, className }: SummaryBarProps) {
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
      <div className="-ml-[17px] flex flex-wrap items-center gap-x-4 gap-y-1">
        {items.map((item) => (
          <div
            key={item.key}
            className="border-border flex items-center gap-1.5 border-l pl-4 whitespace-nowrap"
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
  /**
   * แถบแคบ (กล่อง < 32rem — มือถือ) เหลือแค่ยอดที่ `emphasis` เป็นปุ่มกดดูรายละเอียด
   * (popover มียอดครบทุกช่อง) แล้วปุ่ม action อยู่บรรทัดเดียวกัน — แทนการตัดยอด 5 ช่อง
   * เป็น 2 บรรทัดแล้วปุ่มตกเป็นบรรทัดที่ 3 ซึ่งกินจอมือถือ ~100px
   * ตัดสินจากความกว้างของแถบเอง (`@container`) ไม่ใช่ความกว้างจอ
   */
  collapseOnNarrow?: boolean;
}

// Sticky footer wrapper: shows the summary only when hasRecord is true,
// aligns content depending on whether the summary is present.
export function SummaryFooterBar({
  hasRecord,
  items,
  children,
  className,
  collapseOnNarrow = false,
}: SummaryFooterBarProps) {
  const lead = items.filter((item) => item.emphasis);
  const collapse = collapseOnNarrow && hasRecord && lead.length > 0;
  // แถบเดิม (ไม่ยุบ) คงโครงชั้นเดียวตามเดิมทุกตัวอักษร — หน้าอื่น 11 หน้าใช้อยู่
  const shell =
    "bg-background sticky bottom-0 z-20 mt-auto border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]";
  const row = [
    "flex items-center gap-3 sm:gap-4",
    hasRecord ? "justify-between" : "justify-end",
  ].join(" ");
  const body = (
    <>
      {hasRecord && (
        <SummaryBar
          items={items}
          className={collapse ? "hidden @lg:block" : undefined}
        />
      )}
      {collapse && (
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="hover:bg-muted -mx-1 flex shrink-0 items-center gap-1 rounded-md px-1 py-1 @lg:hidden"
            >
              {/* ไม่ใช้ SummaryBar (overflow-hidden ของมันตัดสกุลเงินเมื่อแถบแคบ) ·
                  ยอดห้ามถูกตัด — ถ้าไม่พอ ปุ่มรองข้าง ๆ ต้องยุบเหลือไอคอนแทน */}
              <span className="flex items-center gap-1.5 text-xs whitespace-nowrap tabular-nums">
                {lead.map((item) => (
                  <span key={item.key} className="flex items-center gap-1.5">
                    <span className="text-muted-foreground">{item.label}</span>
                    <span
                      className={cn(
                        "text-foreground font-semibold",
                        item.valueClassName,
                      )}
                    >
                      {item.value}
                    </span>
                    {/* สกุลเงินอยู่ที่หัวใบและใน popover แล้ว — แถบแคบสุด (< 20rem) ตัดตัวนี้ก่อน */}
                    {item.suffix && (
                      <span className="text-muted-foreground hidden @xs:inline">
                        {item.suffix}
                      </span>
                    )}
                  </span>
                ))}
              </span>
              <ChevronUp
                className="text-muted-foreground size-3.5 shrink-0"
                aria-hidden="true"
              />
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="start" className="w-auto p-3">
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-1.5 text-xs tabular-nums">
              {items.map((item) => (
                <div key={item.key} className="contents">
                  <dt className="text-muted-foreground">{item.label}</dt>
                  <dd
                    className={cn(
                      "text-right",
                      item.emphasis
                        ? "text-foreground font-semibold"
                        : "font-medium",
                      item.valueClassName,
                    )}
                  >
                    {item.value}
                    {item.suffix && (
                      <span className="text-muted-foreground ms-1 font-normal">
                        {item.suffix}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </PopoverContent>
        </Popover>
      )}
      {/* ms-auto: แถบแคบจนปุ่มตกบรรทัดใหม่ (มือถือ/tablet) ปุ่มยังชิดขวา — justify-between
          ของแถวไม่มีผลกับลูกที่ขึ้นบรรทัดเองคนเดียว มันจะไปเริ่มที่ซ้าย */}
      {children && <div className="ms-auto shrink-0">{children}</div>}
    </>
  );

  if (!collapse) {
    // join ธรรมดาแบบเดิม ไม่ผ่าน cn — twMerge จะตัด class ที่ผู้เรียกส่งมาชนต่างจากเดิม
    return (
      <div
        className={[shell, row, "flex-wrap lg:flex-nowrap", className]
          .filter(Boolean)
          .join(" ")}
      >
        {body}
      </div>
    );
  }

  // container query ใช้กับตัว container เองไม่ได้ (`@lg:` บนตัวมันจะไปถามบรรพบุรุษ)
  // จึงต้องมีชั้นใน · ตัดสินจากความกว้างแถบล้วน — @5xl (64rem) ≈ lg ของแถบเดิม ·
  // แถบแคบยังตัดบรรทัดได้: ยอดยาว (หลักล้าน) หรือภาษาไทยที่ 360px ปุ่มลงบรรทัดสองแทนล้นจอ
  return (
    <div className={cn(shell, "@container", className)}>
      <div className={cn(row, "flex-wrap gap-y-1 @5xl:flex-nowrap")}>
        {body}
      </div>
    </div>
  );
}
