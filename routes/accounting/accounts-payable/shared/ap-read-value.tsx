import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * ค่าในโหมดอ่านของหัวเอกสาร AP — แทน `<Input readOnly>` ที่ดูเหมือนพิมพ์ได้
 * (และโชว์ตัวนับ maxLength ค้าง) ด้วยข้อความธรรมดาแบบเดียวกับช่อง vendor/currency
 */
export function ApReadValue({
  children,
  className,
  multiline,
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly multiline?: boolean;
}) {
  const empty = children == null || children === "";
  return (
    <span
      className={cn(
        "text-xs font-medium",
        multiline
          ? "block min-h-8 py-1.5 whitespace-pre-wrap"
          : "inline-flex min-h-8 items-center",
        className,
      )}
    >
      {empty ? "—" : children}
    </span>
  );
}
