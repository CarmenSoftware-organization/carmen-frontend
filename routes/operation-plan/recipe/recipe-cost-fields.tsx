import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { FieldInput } from "@/components/ui/field";
import { SettingSection } from "@/components/ui/setting-section";
import { EyeBrow } from "@/components/ui/eye-brow";
import { formatCurrency } from "@/lib/currency-utils";
import { useUnitById } from "@/hooks/use-unit";
import type { RecipeFormValues } from "./recipe-form-schema";
import type { RecipeComputed, RecipeCostCalc } from "./use-recipe-cost-calc";
import { RecipePriceRecommendations } from "./recipe-price-recommendations";

interface RecipeCostFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  readonly computed: RecipeCostCalc;
}

type CostKey = "total_ingredient_cost" | "labor_cost" | "overhead_cost";

const COST_LINES: readonly {
  key: CostKey;
  label: "ingredientCost" | "laborCost" | "overheadCost";
  swatch: string;
}[] = [
  {
    key: "total_ingredient_cost",
    label: "ingredientCost",
    swatch: "bg-foreground",
  },
  { key: "labor_cost", label: "laborCost", swatch: "bg-foreground/55" },
  { key: "overhead_cost", label: "overheadCost", swatch: "bg-foreground/25" },
];

/**
 * ใบคิดต้นทุนของสูตร — section เดียว อ่านเป็นสมการจากบนลงล่าง
 *
 * ต้นทุนทั้งชุด (วัตถุดิบ + แรงงาน + โสหุ้ย) ÷ จำนวนที่ได้ = ต้นทุนต่อเสิร์ฟ
 * → ราคาขาย → food cost เทียบเป้า + กำไรขั้นต้น
 *
 * เดิมแยกเป็น 4 section (ต้นทุน & ราคา / breakdown / margins / ตัวชี้วัดอื่น)
 * ทำให้ต้องเลื่อนผ่านสี่การ์ดกว่าจะเห็นว่าจานนี้ได้กำไรตามเป้าไหม
 */
export function RecipeCostFields({
  form,
  isDisabled,
  computed,
}: RecipeCostFieldsProps) {
  const t = useTranslations("operationPlan.recipe");
  const errors = form.formState.errors;

  const [ingredient, labor, overhead, baseYield, yieldUnitId, target, sell] =
    useWatch({
      control: form.control,
      name: [
        "total_ingredient_cost",
        "labor_cost",
        "overhead_cost",
        "base_yield",
        "base_yield_unit",
        "target_food_cost_percentage",
        "selling_price",
      ],
    });
  // หน่วยเก็บเป็น id เปล่า — query เดียวกับช่อง Yield Unit ใน Recipe Details (cache ร่วม)
  const { data: yieldUnit } = useUnitById(yieldUnitId || undefined);

  const amounts = {
    total_ingredient_cost: Number(ingredient) || 0,
    labor_cost: Number(labor) || 0,
    overhead_cost: Number(overhead) || 0,
  };
  const batchTotal =
    amounts.total_ingredient_cost + amounts.labor_cost + amounts.overhead_cost;
  const share = (n: number) => (batchTotal > 0 ? (n / batchTotal) * 100 : 0);
  const yld = Number(baseYield) || 0;
  const targetPct = Number(target) || 0;
  const hasPrice = (Number(sell) || 0) > 0;

  return (
    <SettingSection plain title={t("costing")} description={t("costingDesc")}>
      {/* 1 · ต้นทุนทั้งชุด */}
      <EyeBrow className="mb-2">{t("batchCost")}</EyeBrow>
      <div
        className="bg-muted mb-3 flex h-1.5 overflow-hidden rounded-full"
        aria-hidden="true"
      >
        {COST_LINES.map((line) => (
          <div
            key={line.key}
            className={cn(line.swatch, "transition-[width]")}
            style={{ width: `${share(amounts[line.key])}%` }}
          />
        ))}
      </div>
      <div className="space-y-1.5">
        {COST_LINES.map((line) => (
          <div
            key={line.key}
            className="grid grid-cols-[0.5rem_minmax(0,1fr)_2.5rem_7rem] items-center gap-2"
          >
            <span
              className={cn("size-2 rounded-sm", line.swatch)}
              aria-hidden="true"
            />
            <label
              htmlFor={`recipe-${line.key}`}
              className="text-foreground truncate text-xs"
            >
              {t(line.label)}
            </label>
            <span className="text-muted-foreground text-micro text-right tabular-nums">
              {share(amounts[line.key]).toFixed(0)}%
            </span>
            <FieldInput
              id={`recipe-${line.key}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              disabled={isDisabled}
              size="sm"
              className="text-right text-xs tabular-nums"
              error={errors[line.key]?.message}
              errorIconAlign="left"
              {...form.register(line.key)}
            />
          </div>
        ))}
      </div>

      {/* 2 · สมการต้นทุนต่อเสิร์ฟ — แสดงที่มาของตัวเลข ไม่ใช่แค่ผลลัพธ์ */}
      <div className="mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t pt-3">
        <span className="text-muted-foreground text-xs tabular-nums">
          ฿{formatCurrency(batchTotal)} ÷ {yld}
          {yieldUnit?.name ? ` ${yieldUnit.name}` : ""}
        </span>
        <span className="flex items-baseline gap-2">
          <EyeBrow>{t("costPerPortion")}</EyeBrow>
          <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
            ฿{formatCurrency(computed.costPerPortion)}
          </span>
        </span>
      </div>

      {/* 3 · ราคาขาย + ราคาแนะนำตามเป้า */}
      <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
        <div>
          <EyeBrow className="mb-1">
            <label htmlFor="recipe-selling-price">{t("sellingPrice")}</label>
          </EyeBrow>
          <div className="flex items-center gap-1.5">
            <span className="text-muted-foreground text-sm">฿</span>
            <FieldInput
              id="recipe-selling-price"
              type="number"
              inputMode="decimal"
              step="0.01"
              disabled={isDisabled}
              size="sm"
              className="w-32 text-sm font-semibold tabular-nums"
              placeholder="0.00"
              error={errors.selling_price?.message}
              errorIconAlign="left"
              {...form.register("selling_price")}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <EyeBrow className="mb-1">
              <label htmlFor="recipe-target-food-cost">
                {t("targetFoodCost")}
              </label>
            </EyeBrow>
            <div className="relative w-32">
              <FieldInput
                id="recipe-target-food-cost"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={100}
                disabled={isDisabled}
                size="sm"
                className="pr-6 text-right text-sm tabular-nums"
                error={errors.target_food_cost_percentage?.message}
                errorIconAlign="left"
                {...form.register("target_food_cost_percentage", {
                  deps: ["max_food_cost_percentage"],
                })}
              />
              <span className="text-muted-foreground text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                %
              </span>
            </div>
          </div>
          <div>
            <EyeBrow className="mb-1">
              <label htmlFor="recipe-max-food-cost">{t("maxFoodCost")}</label>
            </EyeBrow>
            <div className="relative w-32">
              <FieldInput
                id="recipe-max-food-cost"
                type="number"
                inputMode="decimal"
                step="0.1"
                min={0}
                max={100}
                disabled={isDisabled}
                size="sm"
                className="pr-6 text-right text-sm tabular-nums"
                error={errors.max_food_cost_percentage?.message}
                errorIconAlign="left"
                {...form.register("max_food_cost_percentage")}
              />
              <span className="text-muted-foreground text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                %
              </span>
            </div>
          </div>
        </div>
      </div>

      <RecipePriceRecommendations
        form={form}
        computed={computed}
        isDisabled={isDisabled}
      />

      {/* 4 · ผลลัพธ์ — food cost เทียบเป้า + กำไรขั้นต้น */}
      <div className="mt-4 border-t pt-4">
        {hasPrice ? (
          <RecipeCostVerdict computed={computed} targetPct={targetPct} />
        ) : (
          <p className="text-muted-foreground text-xs">{t("noPriceYet")}</p>
        )}
      </div>

      {/* ท้ายใบ — ตัวเลขประกอบ */}
      <div className="text-muted-foreground mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-t pt-3 text-xs">
        {hasPrice && (
          <>
            <span>
              {t("laborCostRatio")}{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {computed.laborCostPct?.toFixed(1) ?? "—"}%
              </span>
            </span>
            <span>
              {t("overhead")}{" "}
              <span className="text-foreground font-semibold tabular-nums">
                {computed.overheadPct?.toFixed(1) ?? "—"}%
              </span>
            </span>
          </>
        )}
        <span className="ml-auto flex items-center gap-2">
          <label htmlFor="recipe-carbon-footprint">
            {t("carbonFootprint")}
          </label>
          <span className="relative w-32">
            <FieldInput
              id="recipe-carbon-footprint"
              type="number"
              inputMode="decimal"
              step="0.01"
              disabled={isDisabled}
              size="sm"
              className="pr-14 text-right text-xs tabular-nums"
              error={errors.carbon_footprint?.message}
              errorIconAlign="left"
              {...form.register("carbon_footprint")}
            />
            <span className="text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
              {t("kgCo2e")}
            </span>
          </span>
        </span>
      </div>
    </SettingSection>
  );
}

/**
 * food cost % ของจริงบนแถบ 0–100% ที่มีขีดเป้า (ภาษาเดียวกับคอลัมน์ในหน้ารายการ)
 * + กำไรขั้นต้น · เกินเป้าหรือขายต่ำกว่าทุนเท่านั้นที่ขึ้นสี
 */
function RecipeCostVerdict({
  computed,
  targetPct,
}: {
  readonly computed: RecipeComputed;
  readonly targetPct: number;
}) {
  const t = useTranslations("operationPlan.recipe");
  const food = computed.actualFoodCostPct ?? 0;
  const margin = computed.grossMargin ?? 0;
  const marginPct = computed.grossMarginPct ?? 0;
  const hasTarget = targetPct > 0;
  const over = hasTarget && food > targetPct;
  const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

  return (
    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
      <div className="min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <EyeBrow>{t("foodCost")}</EyeBrow>
          <span
            className={cn(
              "text-lg font-semibold tracking-tight tabular-nums",
              over && "text-destructive",
            )}
          >
            {food.toFixed(1)}%
          </span>
        </div>
        <div
          className="bg-muted relative mt-1.5 h-2 rounded-full"
          aria-hidden="true"
        >
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width]",
              over ? "bg-destructive" : "bg-muted-foreground/50",
            )}
            style={{ width: `${clamp(food)}%` }}
          />
          {hasTarget && (
            <div
              className="bg-foreground absolute -inset-y-1 w-0.5 rounded-full"
              style={{ left: `${clamp(targetPct)}%` }}
            />
          )}
        </div>
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

      <div className="sm:border-l sm:pl-4 sm:text-right">
        <EyeBrow>{t("grossMargin")}</EyeBrow>
        <div
          className={cn(
            "mt-0.5 text-lg font-semibold tracking-tight tabular-nums",
            margin < 0 && "text-destructive",
          )}
        >
          ฿{formatCurrency(margin)}
        </div>
        <div
          className={cn(
            "text-micro tabular-nums",
            margin < 0 ? "text-destructive" : "text-muted-foreground",
          )}
        >
          {margin < 0 ? t("belowCost") : `${marginPct.toFixed(1)}%`}
        </div>
      </div>
    </div>
  );
}

/** 30 → "30" · 0.5 → "0.5" — ไม่ปัดเป้าทศนิยมทิ้ง (0.5% ไม่ควรขึ้นเป็น 1%) */
function formatPct(n: number): string {
  return String(Number(n.toFixed(1)));
}
