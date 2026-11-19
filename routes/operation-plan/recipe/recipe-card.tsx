import { useTranslations } from "use-intl";
import { Clock } from "lucide-react";
import { ListCard, ListCardAuditRows } from "@/components/share/list-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/recipe";
import type { Cuisine } from "@/types/cuisine";
import type { RecipeCategory } from "@/types/recipe-category";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { RecipeDifficultyPips } from "./recipe-difficulty-pips";
import {
  RecipeCover,
  RecipeFoodCostCell,
  RecipeStatusBadge,
} from "./recipe-list-cells";

interface RecipeCardProps {
  /** เลขลำดับแถว (`rowNumber()`) → `ListCard rowNo` */
  readonly rowNo?: number;
  readonly item: Recipe;
  readonly cuisines: Cuisine[];
  readonly categories: RecipeCategory[];
  readonly onEdit: (item: Recipe) => void;
  readonly onDelete: (item: Recipe) => void;
}

/** ป้ายที่วางทับมุมภาพ — พื้นทึบของธีมรองไว้ให้อ่านออกบนภาพทุกสี ทั้งสว่างและมืด */
const ON_PHOTO = "bg-background/90 shadow-sm backdrop-blur-sm";

/**
 * การ์ดสูตรอาหาร 1 รายการ สำหรับหน้ารายการโหมด grid/mobile — **ภาพนำ**
 *
 * ภาพปกเต็มกว้าง 4:3 บนสุด (สูตรอาหารคนจำจากหน้าตาจาน ไม่ใช่รหัส) สถานะสูตรวางทับมุมซ้าย
 * Inactive มุมขวา · ใต้ภาพ: ชื่อ → รหัส · ครัว · หมวด → ความยาก · เวลา → แถบตัวเลขสามช่อง
 * (ราคาขาย · ต้นทุน/ส่วน · food cost) ที่คนคุมต้นทุนกวาดตาหา · ปิดท้ายด้วย audit เหมือนการ์ดโมดูลอื่น
 *
 * ระดับความยากเป็นจุดสามดวงสีกลาง ไม่ใช่ badge สี — สูตรยากไม่ใช่ error (DESIGN.md single accent)
 *
 * @param props.item - ข้อมูลสูตรอาหาร
 * @param props.cuisines - รายการ cuisine (resolve ชื่อจาก id)
 * @param props.categories - รายการหมวด (resolve ชื่อจาก id)
 * @param props.onEdit - callback เมื่อคลิกการ์ด
 * @param props.onDelete - callback เมื่อกดปุ่มลบ
 */
export default function RecipeCard({
  item,
  cuisines,
  categories,
  onEdit,
  onDelete,
  rowNo,
}: RecipeCardProps) {
  const t = useTranslations("operationPlan.recipe");
  const ts = useTranslations("status");
  const formatAmount = useAmountFormatter();

  const cuisineName = cuisines.find((c) => c.id === item.cuisine_id)?.name;
  const categoryName = categories.find((c) => c.id === item.category_id)?.name;
  const totalTime = (item.prep_time ?? 0) + (item.cook_time ?? 0);
  const name = item.name || "...";
  const meta = [item.code, cuisineName, categoryName]
    .filter(Boolean)
    .join(" · ");

  return (
    <ListCard
      rowNo={rowNo}
      title={name}
      media={
        <RecipeCover image={item.primary_image}>
          {/* พื้นทึบใส่ที่ตัวชิปเอง (ไม่ห่ออีกชั้น — ซ้อนแล้วดูเป็นชิปในชิป) */}
          <RecipeStatusBadge
            status={item.status}
            className={cn(ON_PHOTO, "absolute top-2 left-2")}
          />
          {!item.is_active && (
            <StatusBadge
              active={false}
              className={cn(ON_PHOTO, "absolute top-2 right-2")}
            />
          )}
        </RecipeCover>
      }
      onOpen={() => onEdit(item)}
      onDelete={() => onDelete(item)}
    >
      {meta && (
        <p className="text-muted-foreground -mt-1 truncate" title={meta}>
          {meta}
        </p>
      )}
      {(item.difficulty || totalTime > 0) && (
        <p className="text-muted-foreground flex items-center gap-3">
          {item.difficulty && (
            <span className="inline-flex items-center gap-1.5">
              <RecipeDifficultyPips difficulty={item.difficulty} />
              {ts(item.difficulty.toLowerCase() as "easy" | "medium" | "hard")}
            </span>
          )}
          {totalTime > 0 && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3" aria-hidden="true" />
              {totalTime} {t("minShort")}
            </span>
          )}
        </p>
      )}
      {/* ตัวเลขสามช่องเรียงแนวนอน ป้ายจางบน ค่าเด่นล่าง — ยังไม่มีค่า = — (ไม่ซ่อนช่อง
          ให้ทุกใบในกริดทรงเดียวกัน) · ป้ายยาว (Cost per Portion) ขึ้นบรรทัดใหม่แทนตัดเหลือ
          "Cost per P…" ค่าชิดล่างตรงกันทั้งสามช่อง */}
      <dl className="border-border/60 mt-1 grid grid-cols-3 gap-2 border-t pt-2">
        <div className="flex min-w-0 flex-col justify-between gap-0.5">
          <dt className="text-muted-foreground leading-tight">
            {t("sellingPrice")}
          </dt>
          <dd className="text-sm font-semibold tabular-nums">
            {item.selling_price ? formatAmount(item.selling_price) : "—"}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col justify-between gap-0.5">
          <dt className="text-muted-foreground leading-tight">
            {t("costPerPortion")}
          </dt>
          <dd className="tabular-nums">
            {item.cost_per_portion > 0
              ? formatAmount(item.cost_per_portion)
              : "—"}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col items-end justify-between gap-0.5 text-end">
          <dt className="text-muted-foreground leading-tight">
            {t("foodCost")}
          </dt>
          <dd>
            <RecipeFoodCostCell
              actual={item.actual_food_cost_percentage}
              target={item.target_food_cost_percentage}
              showBar={false}
            />
          </dd>
        </div>
      </dl>
      <ListCardAuditRows audit={item.audit} />
    </ListCard>
  );
}

/** โครงตอนโหลด — ทรงเดียวกับการ์ดจริง (ภาพ 4:3 + ชื่อ + สองบรรทัดเมตา + แถบตัวเลข) */
export function RecipeCardSkeletonGrid({
  count = 8,
}: {
  readonly count?: number;
}) {
  return (
    <div className={RECIPE_CARD_GRID} aria-busy="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="bg-card overflow-hidden rounded-xl border">
          <Skeleton className="aspect-[4/3] w-full rounded-none" />
          <div className="space-y-2 p-3.5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
            <Skeleton className="h-8 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * กริดการ์ดสูตร — คอลัมน์ตามความกว้างกล่อง (auto-fill ขั้นต่ำ 15rem) ไม่ใช่เบรกพอยต์จอ
 * ภาพนำต้องกว้างพอให้เห็นจาน: มือถือ 1 · iPad 2–3 · HD 4 · Full HD 5–6 ใบต่อแถว
 */
export const RECIPE_CARD_GRID =
  "grid grid-cols-[repeat(auto-fill,minmax(15rem,1fr))] gap-3";
