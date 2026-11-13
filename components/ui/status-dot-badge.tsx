import { type ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type DotTone =
  "success" | "info" | "warning" | "destructive" | "neutral";

const TONE_DOT: Record<DotTone, string> = {
  success: "bg-success",
  info: "bg-info",
  warning: "bg-warning",
  destructive: "bg-destructive",
  neutral: "bg-muted-foreground/50",
};

/**
 * ขนาดจุด — 8px ทุกขนาดชิป ยกเว้น `xs` ที่ชิปบีบเกินกว่าจะรับได้
 *
 * เดิมเป็น 6px ทุกที่ซึ่งเล็กเกินไปสำหรับของที่แบกสัญญาณสีไว้คนเดียว (label เป็น
 * สีกลางเสมอ) แต่**จุดไม่ต้องโตตามตัวอักษร** — ขนาดตัวอักษรเป็นเรื่องของการอ่าน
 * ส่วนจุดเป็นเรื่องของการกวาดตาหาสี ซึ่งมีสตอปที่พอดีอยู่สตอปเดียว โตกว่านี้
 * มันจะอ่านเป็น "จุดที่มีคำต่อท้าย" แทนที่จะเป็นป้ายที่มีจุดนำ
 */
const DOT_SIZE = {
  xs: "size-1.5",
  sm: "size-2",
  lg: "size-2",
} as const;

interface StatusDotBadgeProps {
  /** semantic tone ของจุด — ไม่ส่งได้เมื่อส่ง `dotColor` */
  readonly tone?: DotTone;
  /**
   * สีจุดเป็นค่า CSS ตรง ๆ (เช่น `var(--status-approved)`) — สำหรับสถานะเอกสารซึ่งใช้
   * พาเลตของ `styles/badge-status.css` ไม่ใช่ semantic tone (DESIGN.md: สองชั้นสีห้ามปนกัน)
   * ส่งมาแล้วชนะ `tone`
   */
  readonly dotColor?: string;
  readonly size?: keyof typeof DOT_SIZE;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * Status badge มาตรฐานของทั้งแอป — chip กลาง (`secondary`) + **dot สี** นำหน้า
 * label โดย label เป็นสีกลาง สีอยู่ที่ dot อย่างเดียว (DESIGN.md "avoid neon":
 * สัญญาณสีเดียว ไม่ย้อมทั้ง chip) ใช้ร่วมทุก entity/ทุก view (list/grid/form) เพื่อ
 * ไม่ให้สถานะแสดงต่างกันเมื่อสลับมุมมอง — สีของ dot ผูกกับ semantic tone ไม่ใช่
 * status string ตรง ๆ จึง reuse ข้าม domain ได้ (แต่ละ domain map status → tone เอง)
 *
 * @example
 * <StatusDotBadge tone="success">Active</StatusDotBadge>
 */
export function StatusDotBadge({
  tone = "neutral",
  dotColor,
  size = "sm",
  className,
  children,
}: StatusDotBadgeProps) {
  return (
    <Badge
      variant="secondary"
      size={size}
      // ธงให้ globals.css ยกเว้นชิปนี้จากกฎย่อ badge ในตาราง (ดูคอมเมนต์ที่กฎนั้น)
      data-status-chip=""
      // ยกเลิก tracking-tight ที่มาจาก base ของ Badge — ในแถวตารางที่คอลัมน์ข้าง ๆ
      // เป็น tracking-wide ตัวอักษรที่ถูกบีบจะอ่านว่าเล็กกว่าเพื่อน ทั้งที่ px เท่ากัน
      className={cn("font-normal tracking-normal", className)}
    >
      <span
        className={cn(
          "shrink-0 rounded-full",
          DOT_SIZE[size],
          !dotColor && TONE_DOT[tone],
        )}
        style={dotColor ? { backgroundColor: dotColor } : undefined}
        aria-hidden="true"
      />
      {children}
    </Badge>
  );
}
