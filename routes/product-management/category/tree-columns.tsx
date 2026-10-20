import { Check, Minus } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { CategoryNode } from "@/types/category";

// คอลัมน์ค่าที่ไหลจากชั้นบนลงชั้นล่าง — กว้างคงที่ ตัวเลขจึงตรงแนวทุกระดับของต้นไม้
// แสดงตั้งแต่ lg ขึ้นไป (จอเล็กกว่านั้นเหลือแค่ต้นไม้ + จำนวน)
export const COL = {
  tax: "w-32",
  price: "w-16",
  qty: "w-16",
  recipe: "w-14",
  sold: "w-14",
  children: "w-24",
  products: "w-20",
} as const;

const COLS_WRAPPER = "hidden shrink-0 items-center lg:flex";

/** หัวคอลัมน์ — ติดบนสุดของกล่องเลื่อน ต้องใช้ความกว้าง COL ชุดเดียวกับแถว */
export function TreeColumnsHeader() {
  const t = useTranslations("productManagement.category");
  const head = "text-micro-legal text-muted-foreground font-medium";
  return (
    <div className="bg-card sticky top-0 z-10 hidden h-7 items-center border-b pr-3 lg:flex">
      <span className={cn(head, "flex-1 pl-3")}>{t("colName")}</span>
      <div className={COLS_WRAPPER}>
        <span className={cn(head, COL.tax, "px-2")}>{t("colTax")}</span>
        <span className={cn(head, COL.price, "text-right")}>
          {t("colPriceDev")}
        </span>
        <span className={cn(head, COL.qty, "text-right")}>
          {t("colQtyDev")}
        </span>
        <span className={cn(head, COL.recipe, "text-center")}>
          {t("colRecipe")}
        </span>
        <span className={cn(head, COL.sold, "text-center")}>
          {t("colSold")}
        </span>
      </div>
      <span className={cn(head, COL.children, "hidden text-right sm:inline")}>
        {t("colChildren")}
      </span>
      <span className={cn(head, COL.products, "hidden text-right sm:inline")}>
        {t("colProducts")}
      </span>
    </div>
  );
}

interface CellProps {
  readonly className: string;
  /** undefined = ชั้นบนสุด ไม่มีแม่ให้เทียบ */
  readonly differs: boolean | undefined;
  readonly parentLabel?: string;
  readonly children: React.ReactNode;
}

/**
 * ค่าเท่ากับแม่ = จาง (สืบทอดมา), ต่างจากแม่ = เข้ม + จุดเตือน
 * กวาดตาลงคอลัมน์เดียวก็เห็นทุกโหนดที่เบี่ยงจากชั้นบน
 */
function Cell({ className, differs, parentLabel, children }: CellProps) {
  const t = useTranslations("productManagement.category");
  const title =
    differs === undefined
      ? undefined
      : differs
        ? t("differsFromParent", { value: parentLabel ?? "—" })
        : t("sameAsParent");
  return (
    <span
      title={title}
      className={cn(
        "text-micro-legal relative inline-flex items-center tabular-nums",
        differs === undefined && "text-foreground/80",
        differs === false && "text-muted-foreground/70",
        differs === true && "text-foreground font-semibold",
        className,
      )}
    >
      {differs && (
        <span
          aria-hidden
          className="bg-warning mr-1 inline-block size-1.5 shrink-0 rounded-full"
        />
      )}
      {children}
    </span>
  );
}

const pct = (v: number | undefined) =>
  v === undefined || v === null ? "—" : `${Number(v)}%`;

function Flag({ on }: { readonly on: boolean | undefined }) {
  return on ? (
    <Check className="size-3" aria-label="yes" />
  ) : (
    <Minus className="size-3 opacity-50" aria-label="no" />
  );
}

interface NodeColumnsProps {
  readonly node: CategoryNode;
  readonly parent?: CategoryNode;
}

export function NodeColumns({ node, parent }: NodeColumnsProps) {
  const cmp = <T,>(pick: (n: CategoryNode) => T) =>
    parent ? pick(node) !== pick(parent) : undefined;

  const num = (
    n: CategoryNode,
    k: "price_deviation_limit" | "qty_deviation_limit",
  ) => (n[k] === undefined || n[k] === null ? undefined : Number(n[k]));

  return (
    <div className={COLS_WRAPPER}>
      <Cell
        className={cn(COL.tax, "min-w-0 px-2")}
        differs={cmp((n) => n.tax_profile_id ?? null)}
        parentLabel={parent?.tax_profile_name}
      >
        <span className="truncate">{node.tax_profile_name ?? "—"}</span>
      </Cell>
      <Cell
        className={cn(COL.price, "justify-end")}
        differs={cmp((n) => num(n, "price_deviation_limit"))}
        parentLabel={parent && pct(num(parent, "price_deviation_limit"))}
      >
        {pct(num(node, "price_deviation_limit"))}
      </Cell>
      <Cell
        className={cn(COL.qty, "justify-end")}
        differs={cmp((n) => num(n, "qty_deviation_limit"))}
        parentLabel={parent && pct(num(parent, "qty_deviation_limit"))}
      >
        {pct(num(node, "qty_deviation_limit"))}
      </Cell>
      <Cell
        className={cn(COL.recipe, "justify-center")}
        differs={cmp((n) => !!n.is_used_in_recipe)}
      >
        <Flag on={node.is_used_in_recipe} />
      </Cell>
      <Cell
        className={cn(COL.sold, "justify-center")}
        differs={cmp((n) => !!n.is_sold_directly)}
      >
        <Flag on={node.is_sold_directly} />
      </Cell>
    </div>
  );
}
