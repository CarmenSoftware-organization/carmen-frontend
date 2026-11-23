import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { EyeBrow } from "@/components/ui/eye-brow";
import { formatCurrency } from "@/lib/currency-utils";
import type { RecipeComputed } from "./use-recipe-cost-calc";
import type { RecipeCategoryDefaults } from "../shared/recipe-category-defaults";

const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

/** 30 → "30" · 0.5 → "0.5" — ไม่ปัดเป้าทศนิยมทิ้ง (0.5% ไม่ควรขึ้นเป็น 1%) */
function formatPct(n: number): string {
  return String(Number(n.toFixed(1)));
}

/**
 * เกจผลลัพธ์ของสูตร อยู่ในส่วนหัว (เห็นจากทุกแท็บ) แบ่งสองฝั่งเท่ากัน:
 * ซ้าย = food cost จริงบนแถบ 0–100% ที่มีขีดเป้า · ขวา = กำไรขั้นต้น (จำนวนเงิน + % ของราคาขาย)
 * บนแถบแบบเดียวกันที่มีขีดเป้าของหมวด · เกินเป้าหรือขายต่ำกว่าทุนเท่านั้นที่ขึ้นสี
 */
export function RecipeCostVerdict({
  computed,
  targetPct,
  categoryDefaults,
}: {
  readonly computed: RecipeComputed;
  readonly targetPct: number;
  readonly categoryDefaults: RecipeCategoryDefaults | null;
}) {
  const t = useTranslations("operationPlan.recipe");
  const food = computed.actualFoodCostPct ?? 0;
  const margin = computed.grossMargin ?? 0;
  const marginPct = computed.grossMarginPct ?? 0;
  const hasTarget = targetPct > 0;
  const over = hasTarget && food > targetPct;
  const marginTarget = categoryDefaults?.marginTarget ?? null;

  return (
    <div className="grid grid-cols-2 gap-4" data-recipe-cost-verdict>
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <EyeBrow className="truncate">{t("actualFoodCost")}</EyeBrow>
          <span
            className={cn(
              "text-lg font-semibold tracking-tight tabular-nums",
              over && "text-destructive",
            )}
          >
            {food.toFixed(1)}%
          </span>
        </div>
        <GaugeBar
          value={food}
          mark={hasTarget ? targetPct : null}
          tone={over ? "destructive" : "neutral"}
        />
        <p
          className={cn(
            "mt-2 text-xs",
            over ? "text-destructive font-semibold" : "text-muted-foreground",
          )}
        >
          {!hasTarget
            ? t("noTargetYet")
            : over
              ? t("aboveTargetMessage", { pts: (food - targetPct).toFixed(1) })
              : t("withinTargetMessage", { pct: formatPct(targetPct) })}
        </p>
      </div>

      <div className="min-w-0 border-l pl-4">
        <div className="flex items-baseline justify-between gap-2">
          <EyeBrow className="truncate">{t("grossMargin")}</EyeBrow>
          <span
            className={cn(
              "text-lg font-semibold tracking-tight tabular-nums",
              margin < 0 && "text-destructive",
            )}
          >
            ฿{formatCurrency(margin)}
          </span>
        </div>
        <GaugeBar
          value={marginPct}
          mark={marginTarget}
          tone={margin < 0 ? "destructive" : "neutral"}
        />
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2 text-xs">
          <span
            className={cn(
              "tabular-nums",
              margin < 0
                ? "text-destructive font-semibold"
                : "text-muted-foreground",
            )}
          >
            {margin < 0 ? t("belowCost") : `${marginPct.toFixed(1)}%`}
          </span>
          {categoryDefaults && margin >= 0 && (
            <CategoryMarginNote
              marginPct={marginPct}
              min={categoryDefaults.marginMin}
              target={marginTarget}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** แถบ 0–100% + ขีดเป้า (ถ้ามี) — ภาษาเดียวกับคอลัมน์ food cost ในหน้ารายการ */
function GaugeBar({
  value,
  mark,
  tone,
}: {
  readonly value: number;
  readonly mark: number | null;
  readonly tone: "neutral" | "destructive";
}) {
  return (
    <div
      className="bg-muted relative mt-1.5 h-2 rounded-full"
      aria-hidden="true"
    >
      <div
        className={cn(
          "absolute inset-y-0 left-0 rounded-full transition-[width]",
          tone === "destructive" ? "bg-destructive" : "bg-muted-foreground/50",
        )}
        style={{ width: `${clamp(value)}%` }}
      />
      {mark != null && (
        <div
          className="bg-foreground absolute -inset-y-1 w-0.5 rounded-full"
          style={{ left: `${clamp(mark)}%` }}
        />
      )}
    </div>
  );
}

/** กำไรขั้นต้นจริงเทียบขั้นต่ำ/เป้าของหมวด — ต่ำกว่าขั้นต่ำเท่านั้นที่ขึ้นสีเตือน */
function CategoryMarginNote({
  marginPct,
  min,
  target,
}: {
  readonly marginPct: number;
  readonly min: number | null;
  readonly target: number | null;
}) {
  const t = useTranslations("operationPlan.recipe");
  if (min != null && marginPct < min)
    return (
      <span className="text-warning-ink font-semibold">
        {t("marginBelowCategoryMin", { pct: formatPct(min) })}
      </span>
    );
  if (target == null) return null;
  const meets = marginPct >= target;
  return (
    <span className={meets ? "text-success-ink" : "text-muted-foreground"}>
      {t(meets ? "marginMeetsCategoryTarget" : "marginCategoryTarget", {
        pct: formatPct(target),
      })}
    </span>
  );
}
