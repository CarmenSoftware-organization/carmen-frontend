import { cn } from "@/lib/utils";

/**
 * ขนาดบรรทัดรองของเซลล์ตาราง — จุดเดียวที่กำหนด (docs/DESIGN.md §typography-roles
 * `cell-secondary`) บรรทัดหลักไม่มี class ขนาด: สืบทอด `text-xs` (12px) จาก DataGrid
 * เน้นด้วยน้ำหนักตัวอักษร ห้ามเน้นด้วยขนาด · ใช้ตรง ๆ เมื่อห่อด้วย element อื่น เช่น `<Link>`
 *
 * line-height มาจาก token `--text-micro--line-height` (1.35) — อย่าใส่ `leading-none`
 * ทับ สระบน + วรรณยุกต์ภาษาไทยจะถูกตัด
 */
export const CELL_SUB_CLASS = "text-micro text-muted-foreground";

/** บรรทัดหลักของเซลล์ที่ต้องมีตัวห่อ (truncate / ตัวหนา) — ไม่ใส่ขนาด */
export function CellText({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return <span data-slot="cell-text" className={cn(className)} {...props} />;
}

/** บรรทัดรองของเซลล์ (รหัส ชื่อรอง วันที่ใต้ชื่อ) — 11px สีจาง ขึ้นบรรทัดใหม่ */
export function CellSub({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="cell-sub"
      className={cn("block", CELL_SUB_CLASS, className)}
      {...props}
    />
  );
}
