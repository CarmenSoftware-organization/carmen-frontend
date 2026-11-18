import { cn } from "@/lib/utils";

/**
 * ช่องโหมดอ่านของหน้าอุปกรณ์ — ป้ายจาง + ค่าเด่น ไม่มีกรอบ (ทรงเดียวกับ `SettingField`)
 * ต่างตรงที่คงการขึ้นบรรทัดใหม่ของข้อความหลายบรรทัด (คำแนะนำการใช้/ความปลอดภัย/
 * ทำความสะอาด, รอบซ่อม, หมายเหตุ) ซึ่ง `SettingField` ยุบเป็นบรรทัดเดียว
 */
export function EqTextField({
  label,
  value,
  wide,
  numeric,
}: {
  readonly label: string;
  readonly value?: string | number | null;
  /** กว้าง 2 ช่องของ FieldGrid */
  readonly wide?: boolean;
  readonly numeric?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  return (
    <div className={cn("min-w-0", wide && "@md:col-span-2")}>
      <div className="text-muted-foreground text-xs">{label}</div>
      {isEmpty ? (
        <div className="text-muted-foreground/60 mt-0.5 text-sm">—</div>
      ) : (
        <div
          className={cn(
            "mt-0.5 text-sm break-words whitespace-pre-wrap",
            numeric && "tabular-nums",
          )}
        >
          {value}
        </div>
      )}
    </div>
  );
}
