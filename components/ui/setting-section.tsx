import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * โครงหนึ่ง section ของหน้า settings — 2 คอลัมน์แบบ Business Setting
 *
 * ซ้าย = ชื่อ section + คำอธิบายสั้น (+ count / action), ขวา = grid ของ field
 * มีเส้นคั่นด้านบนทุก section ยกเว้นอันแรก (คุมด้วย prop `first`)
 *
 * Shared primitive — ใช้ทั้ง company-profile, config-email, notification-template
 * และทุกฟอร์มใน vendor-management
 *
 * @param title - ชื่อ section
 * @param description - คำอธิบายสั้นว่า section นี้เกี่ยวกับอะไร
 * @param first - true = section แรก (ไม่มีเส้นคั่น/padding บน)
 * @param count - ตัวเลขต่อท้าย title (เช่นจำนวนแถวใน dynamic section)
 * @param action - คอนโทรลใต้คำอธิบาย (เช่นปุ่ม Add)
 * @param wide - body กินเต็มความกว้าง (เช่นตารางกว้าง) → title/desc วางด้านบน
 * @param plain - body เป็นบล็อกเปล่า ไม่ใช่ grid 2 คอลัมน์ (caller จัด layout เอง)
 * @param frameless - ไม่ห่อ card ให้ (ของข้างในมีกรอบของตัวเองอยู่แล้ว)
 * @param children - field ต่างๆ
 */
export function SettingSection({
  title,
  description,
  first,
  count,
  action,
  wide,
  plain,
  frameless,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly first?: boolean;
  readonly count?: number;
  readonly action?: React.ReactNode;
  readonly wide?: boolean;
  /**
   * body ไม่ต้องเป็น grid 2 คอลัมน์ — ปล่อยเป็นบล็อกเปล่าให้ caller จัด layout เอง
   * (ฟอร์ม operation-plan ห่อ grid ของตัวเองมาแล้ว grid ซ้อน grid จะเพี้ยน)
   */
  readonly plain?: boolean;
  /**
   * ไม่ห่อ card (`bg-card` + border + shadow + padding) ให้
   *
   * ใช้เมื่อของที่ยัดเข้ามามีกรอบของตัวเองอยู่แล้ว — เช่น `Transfer`,
   * `TreeProductLookup` หรืออะไรก็ตามที่ห่อด้วย `DataGridContainer` (ตัวนั้น
   * ใส่ `rounded-lg border` ให้เป็นค่า default) ไม่งั้นได้กรอบซ้อนกรอบ
   * เส้นสองชั้นห่างกัน 24px ซึ่งอ่านเป็นความผิดพลาดมากกว่าลำดับชั้น
   */
  readonly frameless?: boolean;
  readonly children: React.ReactNode;
}) {
  const heading = (
    <>
      <div className="flex items-baseline gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
        {count !== undefined && (
          <span className="text-muted-foreground text-xs font-semibold tabular-nums">
            {count}
          </span>
        )}
      </div>
      {description && (
        <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
          {description}
        </p>
      )}
    </>
  );

  if (wide) {
    return (
      <section
        className={cn(
          "space-y-4",
          !first && "border-border/70 mt-8 border-t pt-8",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">{heading}</div>
          {action}
        </div>
        <div
          className={cn(
            "min-w-0",
            !frameless &&
              "bg-card overflow-hidden rounded-xl border p-5 shadow-sm sm:p-6",
          )}
        >
          {children}
        </div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "grid items-start gap-x-10 md:grid-cols-3",
        plain ? "gap-y-1" : "gap-y-6",
        !first && "border-border/70 mt-8 border-t pt-8",
      )}
    >
      <div className="pt-2 md:col-span-1">
        {heading}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div
        className={cn(
          "md:col-span-2",
          !frameless && "bg-card overflow-hidden rounded-xl border shadow-sm",
        )}
      >
        <div
          className={cn(
            !frameless && "p-5 sm:p-6",
            plain ? "min-w-0" : "grid gap-6 sm:grid-cols-2",
          )}
        >
          {children}
        </div>
      </div>
    </section>
  );
}

export function SettingSectionSkeleton({
  first,
  fields,
}: {
  readonly first?: boolean;
  readonly fields: ReadonlyArray<"full" | "half" | "tall">;
}) {
  return (
    <div
      className={cn(
        "grid items-start gap-x-10 gap-y-6 md:grid-cols-3",
        !first && "border-border/70 mt-8 border-t pt-8",
      )}
    >
      <div className="space-y-2 pt-2 md:col-span-1">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-3 w-44" />
      </div>
      <div className="bg-card overflow-hidden rounded-xl border shadow-sm md:col-span-2">
        <div className="grid gap-6 p-5 sm:grid-cols-2 sm:p-6">
          {fields.map((w, j) => (
            <Skeleton
              key={j}
              className={cn(
                "w-full",
                w === "tall" ? "h-24" : "h-14",
                (w === "full" || w === "tall") && "sm:col-span-2",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
