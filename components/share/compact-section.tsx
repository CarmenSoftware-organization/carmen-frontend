import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * โครงของหน้า form/settings แบบเต็มความกว้างจอ (skill `carmen-blue-ui-design`) — ไม่มีเพดานความกว้างและไม่มีคอลัมน์หัวข้อเปล่า ๆ
 * ด้านซ้าย พื้นที่ที่ได้เพิ่มเมื่อจอกว้างขึ้นถูกใช้สองทาง:
 *
 * 1. section ที่เป็นคู่กัน (โรงแรม|บริษัท, วันเวลา|ตัวเลข) วางเคียงกันตั้งแต่ Full HD
 *    ขึ้นไป (`SECTION_PAIR`) — ต่ำกว่านั้นเรียงลงมาเต็มความกว้าง
 * 2. จำนวนคอลัมน์ของช่องกรอกโตตาม **ความกว้างของการ์ดเอง** (container query ใน
 *    `FieldGrid`) ไม่ใช่ของจอ — การ์ดครึ่งจอกับการ์ดเต็มจอจึงใช้กฎเดียวกันได้ และ
 *    พับ/กาง sidebar แล้วยังถูก
 *
 * ผลต่อขนาดจอ (sidebar กาง): mobile 1 คอลัมน์ · tablet 2 · 1366 3 · Full HD
 * การ์ดเต็ม 6 / การ์ดคู่ 3 · 4K การ์ดเต็มและการ์ดคู่ 6
 */
export const SECTION_PAIR =
  "min-[1700px]:grid min-[1700px]:grid-cols-2 min-[1700px]:items-start min-[1700px]:gap-x-5";

/**
 * กริดของช่องในการ์ด — จำนวนคอลัมน์ตามความกว้างการ์ด
 *
 * @param size - `field` (ค่าเริ่มต้น) = ช่องกรอก/ค่าตั้งสั้น ๆ กว้างราว 220px ขึ้นไป ·
 *   `item` = รายการที่มีเนื้อหาหลายส่วน (ไอคอน ชื่อ ป้าย สถานะ ตัวอย่างข้อความ) ต้องการราว
 *   300px ขึ้นไป จึงแตกคอลัมน์ช้ากว่าหนึ่งขั้น
 */
export function FieldGrid({
  size = "field",
  children,
}: {
  readonly size?: "field" | "item";
  readonly children: React.ReactNode;
}) {
  return (
    <div className="@container">
      <div
        className={cn(
          "grid gap-x-5 gap-y-3",
          size === "field"
            ? "@md:grid-cols-2 @3xl:grid-cols-3 @5xl:grid-cols-4 @min-[96rem]:grid-cols-6"
            : "@xl:grid-cols-2 @5xl:grid-cols-3 @min-[96rem]:grid-cols-4 @min-[128rem]:grid-cols-6",
        )}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * section แบบกะทัดรัด — หัวข้อกับคำอธิบายอยู่บรรทัดเดียวกัน การ์ด padding 16px
 * ระยะระหว่าง section 20px ไม่มีเส้นคั่น (ขอบการ์ดแยก section ให้อยู่แล้ว)
 *
 * ไม่ใช้ `SettingSection` กลาง: ตัวนั้นเว้น 32px + เส้น + 32px ระหว่าง section และ
 * padding 24px ซึ่งเหมาะกับฟอร์มยาวคอลัมน์เดียว แต่หน้าที่เรียงช่องหลายคอลัมน์จนแต่ละ
 * section เหลือ 1–3 แถว ระยะห่างจึงกินที่มากกว่าเนื้อหา
 */
export function CompactSection({
  title,
  description,
  count,
  action,
  first,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  /** ตัวเลขต่อท้าย title (เช่นจำนวนรายการในหมวด) */
  readonly count?: number;
  readonly action?: React.ReactNode;
  readonly first?: boolean;
  readonly children: React.ReactNode;
}) {
  return (
    <section className={cn(!first && "mt-5")}>
      <div className="mb-2 flex min-h-7 flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <h2 className="text-sm font-semibold tracking-tight">{title}</h2>
          {count !== undefined && (
            <span className="text-muted-foreground text-xs font-semibold tabular-nums">
              {count}
            </span>
          )}
          {description && (
            <p className="text-muted-foreground text-xs">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="bg-card rounded-xl border p-4 shadow-sm">{children}</div>
    </section>
  );
}

/** โครงรอโหลดของหนึ่ง section — หัวข้อ + การ์ดเต็มความกว้าง */
export function CompactSectionSkeleton({
  className,
  first,
}: {
  readonly className: string;
  readonly first?: boolean;
}) {
  return (
    <div className={cn("space-y-2", !first && "mt-5")}>
      <Skeleton className="h-5 w-32" />
      <Skeleton className={cn("w-full rounded-xl", className)} />
    </div>
  );
}
