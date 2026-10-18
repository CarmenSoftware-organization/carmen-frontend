import { cn } from "@/lib/utils";

interface EqAvailabilityProps {
  readonly available: number | null | undefined;
  readonly total: number | null | undefined;
  readonly className?: string;
}

/**
 * จำนวนพร้อมใช้ / ทั้งหมด เช่น `2 / 3` — ตัวหน้าเข้ม ตัวหลังจาง
 *
 * มีของแต่พร้อมใช้ 0 เครื่อง = ตัวหน้าเป็นสี destructive (ข้อความ `/ total`
 * ยังอยู่ จึงไม่ได้พึ่งสีอย่างเดียว) · ไม่ได้ตั้งจำนวนเลย (total 0) = ขีด
 */
export function EqAvailability({
  available,
  total,
  className,
}: EqAvailabilityProps) {
  const avail = available ?? 0;
  const all = total ?? 0;

  if (all === 0 && avail === 0) {
    return (
      <span data-slot="eq-availability" className="text-muted-foreground">
        —
      </span>
    );
  }

  return (
    <span
      data-slot="eq-availability"
      className={cn("inline-flex items-baseline gap-1 tabular-nums", className)}
    >
      <span className={cn("font-semibold", avail === 0 && "text-destructive")}>
        {avail}
      </span>
      <span className="text-muted-foreground">/ {all}</span>
    </span>
  );
}
