import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { EyeBrow } from "@/components/ui/eye-brow";
import { formatCurrency } from "@/lib/currency-utils";
import type { RecipeComputed } from "./use-recipe-cost-calc";
import type { RecipeCategoryDefaults } from "../shared/recipe-category-defaults";

/** 30 → "30" · 0.5 → "0.5" — ไม่ปัดเป้าทศนิยมทิ้ง */
function formatPct(n: number): string {
  return String(Number(n.toFixed(1)));
}

/**
 * กำไรขั้นต้นแบบงบย่อ — ราคาขาย ลบต้นทุนทีละตัว เท่ากับกำไร (ทุกตัวเลขของทั้งสูตร)
 * แต่ละบรรทัดบอกเป็น % ของราคาขาย · วัตถุดิบเทียบเป้า food cost ในคอลัมน์สุดท้าย
 * ส่วนอัตราค่าแรง/โสหุ้ยของหมวดย้ายไปต่อท้ายชื่อในส่วนต้นทุนแล้ว (กดใช้ค่าได้ที่นั่น — ผู้ใช้สั่ง 24/11)
 * แยกออกมาจากส่วนกรอกต้นทุนกับส่วนตั้งราคา เพื่อให้เห็นที่มาของกำไรในที่เดียว
 */
export function RecipeMarginStatement({
  computed,
  amounts,
  sellingPrice,
  targetPct,
  categoryDefaults,
}: {
  readonly computed: RecipeComputed;
  readonly amounts: {
    readonly ingredient: number;
    readonly labor: number;
    readonly overhead: number;
  };
  readonly sellingPrice: number;
  readonly targetPct: number;
  readonly categoryDefaults: RecipeCategoryDefaults | null;
}) {
  const t = useTranslations("operationPlan.recipe");
  const food = computed.actualFoodCostPct ?? 0;
  const margin = computed.grossMargin ?? 0;
  const marginPct = computed.grossMarginPct ?? 0;
  const hasTarget = targetPct > 0;
  const over = hasTarget && food > targetPct;

  const lines: {
    key: string;
    label: string;
    amount: number;
    pct: number | null;
    note?: React.ReactNode;
    tone?: "destructive";
  }[] = [
    {
      key: "ingredient",
      label: t("ingredientCost"),
      amount: amounts.ingredient,
      pct: computed.actualFoodCostPct,
      tone: over ? "destructive" : undefined,
      note: (
        <span className={over ? "text-destructive font-semibold" : undefined}>
          {t("foodCost")} ·{" "}
          {!hasTarget
            ? t("noTargetYet")
            : over
              ? t("aboveTargetMessage", { pts: (food - targetPct).toFixed(1) })
              : t("withinTargetMessage", { pct: formatPct(targetPct) })}
        </span>
      ),
    },
    {
      key: "labor",
      label: t("laborCost"),
      amount: amounts.labor,
      pct: computed.laborCostPct,
    },
    {
      key: "overhead",
      label: t("overheadCost"),
      amount: amounts.overhead,
      pct: computed.overheadPct,
    },
  ];

  const row =
    "grid grid-cols-[1rem_minmax(0,1fr)_auto_3.5rem] items-baseline gap-x-3 @2xl:grid-cols-[1rem_14rem_7.5rem_4.5rem_minmax(0,1fr)]";
  const noteCell =
    "text-muted-foreground col-start-2 col-end-5 text-micro @2xl:col-start-auto @2xl:col-end-auto";

  return (
    <div className="@container" data-recipe-margin-statement>
      <div className={cn(row, "text-muted-foreground pb-1")}>
        <span />
        <span />
        <EyeBrow className="text-right">{t("amountColumn")}</EyeBrow>
        <EyeBrow className="text-right">{t("shareOfPrice")}</EyeBrow>
      </div>

      <div className={cn(row, "border-t py-2")}>
        <span />
        <span className="text-foreground text-sm font-semibold">
          {t("sellingPrice")}
        </span>
        <span className="text-foreground text-right text-sm font-semibold tabular-nums">
          ฿{formatCurrency(sellingPrice)}
        </span>
        <span className="text-muted-foreground text-right text-xs tabular-nums">
          100%
        </span>
      </div>

      {lines.map((line) => (
        <div key={line.key} className={cn(row, "gap-y-0.5 py-1.5")}>
          <span className="text-muted-foreground text-xs" aria-hidden="true">
            −
          </span>
          <span className="text-foreground text-xs">{line.label}</span>
          <span className="text-foreground text-right text-xs tabular-nums">
            ฿{formatCurrency(line.amount)}
          </span>
          <span
            className={cn(
              "text-right text-xs tabular-nums",
              line.tone === "destructive"
                ? "text-destructive font-semibold"
                : "text-muted-foreground",
            )}
          >
            {line.pct == null ? "—" : `${line.pct.toFixed(1)}%`}
          </span>
          {line.note ? <span className={noteCell}>{line.note}</span> : null}
        </div>
      ))}

      <div
        className={cn(
          row,
          "border-foreground/70 mt-1 gap-y-0.5 border-t-2 pt-2",
        )}
      >
        <span
          className="text-foreground text-sm font-semibold"
          aria-hidden="true"
        >
          =
        </span>
        <span className="text-foreground text-sm font-semibold">
          {t("grossMargin")}
        </span>
        <span
          className={cn(
            "text-right text-lg font-semibold tracking-tight tabular-nums",
            margin < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          ฿{formatCurrency(margin)}
        </span>
        <span
          className={cn(
            "text-right text-sm font-semibold tabular-nums",
            margin < 0 ? "text-destructive" : "text-foreground",
          )}
        >
          {margin < 0 ? t("belowCost") : `${marginPct.toFixed(1)}%`}
        </span>
        <span className={noteCell}>
          <MarginNote
            marginPct={marginPct}
            margin={margin}
            categoryDefaults={categoryDefaults}
          />
          <span className="ml-2">
            {t("markup")}{" "}
            <span className="text-foreground font-semibold tabular-nums">
              {computed.markup == null ? "—" : `×${computed.markup.toFixed(2)}`}
            </span>
          </span>
        </span>
      </div>
    </div>
  );
}

/** กำไรขั้นต้นเทียบขั้นต่ำ/เป้าของหมวด — ต่ำกว่าขั้นต่ำเท่านั้นที่ขึ้นสีเตือน */
function MarginNote({
  marginPct,
  margin,
  categoryDefaults,
}: {
  readonly marginPct: number;
  readonly margin: number;
  readonly categoryDefaults: RecipeCategoryDefaults | null;
}) {
  const t = useTranslations("operationPlan.recipe");
  if (!categoryDefaults || margin < 0) return null;
  const { marginMin: min, marginTarget: target } = categoryDefaults;
  if (min != null && marginPct < min)
    return (
      <span className="text-warning-ink font-semibold">
        {t("marginBelowCategoryMin", { pct: formatPct(min) })}
      </span>
    );
  if (target == null) return null;
  const meets = marginPct >= target;
  return (
    <span className={meets ? "text-success-ink" : undefined}>
      {t(meets ? "marginMeetsCategoryTarget" : "marginCategoryTarget", {
        pct: formatPct(target),
      })}
    </span>
  );
}
