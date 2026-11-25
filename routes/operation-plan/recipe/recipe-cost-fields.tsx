import { useFormState, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { FieldInput } from "@/components/ui/field";
import { CompactSection } from "@/components/share/compact-section";
import { EyeBrow } from "@/components/ui/eye-brow";
import { formatCurrency, round2 } from "@/lib/currency-utils";
import { useUnitById } from "@/hooks/use-unit";
import {
  nullableNumberInput,
  numberInput,
  type RecipeFormValues,
} from "./recipe-form-schema";
import type { RecipeCostCalc } from "./use-recipe-cost-calc";
import { RecipePriceRecommendations } from "./recipe-price-recommendations";
import { RecipeMarginStatement } from "./recipe-margin-statement";
import { RecipePriceBuildup } from "./recipe-price-buildup";
import { useRecipePriceRates } from "./use-recipe-price-rates";
import type { RecipeCategoryDefaults } from "../shared/recipe-category-defaults";

interface RecipeCostFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  readonly computed: RecipeCostCalc;
  /** ค่าตั้งต้นของหมวดที่เลือก — ใช้แสดงเทียบ (null = ยังไม่เลือก/ยังโหลด) */
  readonly categoryDefaults: RecipeCategoryDefaults | null;
}

type CostKey = "total_ingredient_cost" | "labor_cost" | "overhead_cost";

const COST_LINES: readonly {
  key: CostKey;
  label: "ingredientCost" | "laborCost" | "overheadCost";
  swatch: string;
  /** อัตราของหมวด (% ของราคาขาย) ที่แสดงต่อท้ายชื่อบรรทัด — วัตถุดิบไม่มี (เทียบกับเป้า food cost แทน) */
  categoryRate?: "labor" | "overhead";
}[] = [
  {
    key: "total_ingredient_cost",
    label: "ingredientCost",
    swatch: "bg-foreground",
  },
  {
    key: "labor_cost",
    label: "laborCost",
    swatch: "bg-foreground/55",
    categoryRate: "labor",
  },
  {
    key: "overhead_cost",
    label: "overheadCost",
    swatch: "bg-foreground/25",
    categoryRate: "overhead",
  },
];

/**
 * แท็บ Costing — สามส่วนเรียงตามลำดับคิด (ทุกตัวเลขของทั้งสูตร)
 *
 * 1 ต้นทุน: วัตถุดิบ + แรงงาน + โสหุ้ย = ต้นทุนรวม ÷ จำนวน Portion = ต้นทุนต่อ Portion
 *   ค่าแรง/โสหุ้ยมีอัตราของหมวดต่อท้ายชื่อ กดใช้แล้วช่องได้ ราคาขาย × อัตรา
 * 2 ราคาขาย: ราคาขายทั้งสูตร + เป้า food cost + ราคาแนะนำ
 * 3 กำไรขั้นต้น: ราคาขาย − ต้นทุนแต่ละตัว = กำไร พร้อม % ของราคาขายทุกบรรทัด
 */
export function RecipeCostFields({
  form,
  isDisabled,
  computed,
  categoryDefaults,
}: RecipeCostFieldsProps) {
  const t = useTranslations("operationPlan.recipe");
  // ต้อง subscribe เอง — อ่าน form.formState.errors ตรง ๆ จะ render ใหม่เฉพาะตอน
  // ค่าที่ useWatch เฝ้าเปลี่ยน error จาก superRefine ของช่องเพดานเลยไม่เคยขึ้น
  // และ error ของช่องที่แก้ถูกแล้วค้างอยู่
  const { errors } = useFormState({ control: form.control });

  const [
    ingredient,
    labor,
    overhead,
    baseYield,
    yieldUnitId,
    target,
    max,
    sell,
  ] = useWatch({
    control: form.control,
    name: [
      "total_ingredient_cost",
      "labor_cost",
      "overhead_cost",
      "base_yield",
      "base_yield_unit",
      "target_food_cost_percentage",
      "max_food_cost_percentage",
      "selling_price",
    ],
  });
  // มีวัตถุดิบ = ยอดวัตถุดิบมาจากบรรทัด (server คำนวณ) แก้มือไม่ได้ · ไม่มี = กรอกมือเหมือนเดิม
  const ingredientLines = useWatch({
    control: form.control,
    name: "ingredients",
  });
  const ingredientLocked = (ingredientLines?.length ?? 0) > 0;
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
  const maxPct = Number(max) || 0;
  // กฎเดียวกับ superRefine ของ schema — แต่ error นั้นขึ้นหลังกด Save เท่านั้น
  const maxBelowTarget = targetPct > 0 && maxPct > 0 && maxPct < targetPct;
  const sellingPrice = Number(sell) || 0;
  const hasPrice = sellingPrice > 0;
  const priceRates = useRecipePriceRates();

  return (
    <>
      {/* สามส่วนแยกกัน อ่านทีละขั้น: 1 ต้นทุน (กรอก) · 2 ราคาขาย (กรอก + ราคาแนะนำ) · 3 กำไรขั้นต้น (ผลลัพธ์)
          เดิมรวมในการ์ดเดียว ต้นทุน ราคา markup กำไร และสัดส่วนค่าแรงปนกันจนอ่านยาก (feedback 23/11)
          กล่องกว้างตั้งแต่ 64rem = 1 | 2 เคียงกัน สูงเท่ากัน · แคบกว่านั้นเรียงลงมา */}
      <div className="@container">
        <div className="grid gap-5 @5xl:grid-cols-2">
          <CompactSection
            first
            title={`1 · ${t("costSection")}`}
            description={t("costSectionDesc")}
          >
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
            {/* @container: ตำแหน่งอัตราหมวดขึ้นกับความกว้างการ์ด ไม่ใช่จอ (การ์ดครึ่งจอบน Full HD ก็กว้างพอ) */}
            <div className="@container space-y-1.5">
              {COST_LINES.map((line) => {
                const rate = line.categoryRate
                  ? categoryDefaults?.[line.categoryRate]
                  : null;
                return (
                  // อัตราของหมวดต่อท้ายชื่อ (เดิมอยู่ในส่วนกำไรขั้นต้น ไกลจากช่องที่ต้องแก้)
                  // การ์ดกว้าง ≥ 32rem: คอลัมน์ของตัวเองถัดจากชื่อ · แคบกว่านั้น: บรรทัดที่สองใต้ชื่อ
                  // กินถึงขอบช่องกรอก — อยู่ในคอลัมน์ชื่อตรง ๆ บนมือถือแล้วแตกเป็นสามบรรทัด
                  <div
                    key={line.key}
                    className="grid grid-cols-[0.5rem_minmax(0,1fr)_2.5rem_7rem] items-center gap-x-2 gap-y-0.5 @lg:grid-cols-[0.5rem_auto_minmax(0,1fr)_2.5rem_7rem]"
                  >
                    <span
                      className={cn("size-2 rounded-sm", line.swatch)}
                      aria-hidden="true"
                    />
                    <label
                      htmlFor={`recipe-${line.key}`}
                      className="text-foreground min-w-0 text-xs"
                    >
                      {t(line.label)}
                    </label>
                    {rate != null && (
                      <CategoryRateHint
                        className="col-span-3 col-start-2 row-start-2 @lg:col-span-1 @lg:col-start-3 @lg:row-start-1"
                        label={t(line.label)}
                        pct={rate}
                        sellingPrice={sellingPrice}
                        current={amounts[line.key]}
                        isDisabled={isDisabled}
                        onApply={(v) =>
                          form.setValue(line.key, v, {
                            shouldDirty: true,
                            shouldValidate: true,
                          })
                        }
                      />
                    )}
                    <span className="text-muted-foreground text-micro text-right tabular-nums @lg:col-start-4">
                      {share(amounts[line.key]).toFixed(0)}%
                    </span>
                    <div className="@lg:col-start-5">
                      {line.key === "total_ingredient_cost" &&
                      ingredientLocked ? (
                        <output
                          id={`recipe-${line.key}`}
                          title={t("ingredientCostFromLines")}
                          className="bg-muted text-foreground flex h-8 items-center justify-end rounded-md px-3 text-xs tabular-nums"
                        >
                          ฿{formatCurrency(amounts.total_ingredient_cost)}
                        </output>
                      ) : (
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
                          {...form.register(line.key, numberInput)}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 space-y-1.5 border-t pt-3">
              <div className="flex items-baseline justify-between gap-4">
                <EyeBrow>{t("totalCost")}</EyeBrow>
                <span className="text-foreground text-sm font-semibold tabular-nums">
                  ฿{formatCurrency(batchTotal)}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <span className="text-muted-foreground text-xs tabular-nums">
                  ÷ {yld}
                  {yieldUnit?.name ? ` ${yieldUnit.name}` : ""}
                </span>
                <span className="flex items-baseline gap-2">
                  <EyeBrow>{t("costPerPortion")}</EyeBrow>
                  <span className="text-foreground text-2xl font-semibold tracking-tight tabular-nums">
                    ฿{formatCurrency(computed.costPerPortion)}
                  </span>
                </span>
              </div>
            </div>
            <div className="mt-4 flex justify-end border-t pt-3">
              <span className="text-muted-foreground flex items-center gap-2 text-xs">
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
                    {...form.register("carbon_footprint", nullableNumberInput)}
                  />
                  <span className="text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                    {t("kgCo2e")}
                  </span>
                </span>
              </span>
            </div>
          </CompactSection>

          <CompactSection
            first
            title={`2 · ${t("priceSection")}`}
            description={t("priceSectionDesc")}
          >
            {/* ราคาก่อน (กรอก net หรือ gross ก็ได้ อีกฝั่งคิดตาม) แล้วเป้า food cost คู่กับราคาแนะนำที่คิดจากเป้า */}
            <RecipePriceBuildup
              form={form}
              isDisabled={isDisabled}
              error={errors.selling_price?.message}
              ingredientCost={amounts.total_ingredient_cost}
              rates={priceRates}
            />
            <div className="mt-4 border-t pt-3">
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
                      className="pr-6 text-right text-xs tabular-nums"
                      error={errors.target_food_cost_percentage?.message}
                      errorIconAlign="left"
                      {...form.register("target_food_cost_percentage", {
                        ...nullableNumberInput,
                        deps: ["max_food_cost_percentage"],
                      })}
                    />
                    <span className="text-muted-foreground text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                      %
                    </span>
                  </div>
                  {categoryDefaults?.foodCost != null && (
                    <CategoryFoodCostHint
                      value={categoryDefaults.foodCost}
                      current={targetPct}
                      isDisabled={isDisabled}
                      onApply={(v) =>
                        form.setValue("target_food_cost_percentage", v, {
                          shouldDirty: true,
                          shouldValidate: true,
                        })
                      }
                    />
                  )}
                </div>
                <div>
                  <EyeBrow className="mb-1">
                    <label htmlFor="recipe-max-food-cost">
                      {t("maxFoodCost")}
                    </label>
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
                      className="pr-6 text-right text-xs tabular-nums"
                      error={errors.max_food_cost_percentage?.message}
                      errorIconAlign="left"
                      {...form.register(
                        "max_food_cost_percentage",
                        nullableNumberInput,
                      )}
                    />
                    <span className="text-muted-foreground text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
                      %
                    </span>
                  </div>
                  {/* ราคาที่ food cost เท่าเพดานพอดี — ตัวเดียวกับแถวราคาขั้นต่ำในการ์ดราคาแนะนำ
                      เห็นผลทันทีที่พิมพ์ · ขายต่ำกว่านี้ = ตัวแดง
                      เพดานต่ำกว่าเป้า = ไม่มีราคาให้โชว์ บอกเหตุผลแทน (จนกว่า error ของ schema จะขึ้นตอน Save) */}
                  {computed.minPrice != null ? (
                    <p
                      className={cn(
                        "text-micro mt-1 tabular-nums",
                        computed.belowMinPrice
                          ? "text-destructive font-semibold"
                          : "text-muted-foreground",
                      )}
                    >
                      {t("minPriceHint", {
                        price: `฿${formatCurrency(computed.minPrice)}`,
                      })}
                    </p>
                  ) : (
                    maxBelowTarget &&
                    !errors.max_food_cost_percentage && (
                      <p className="text-destructive text-micro mt-1">
                        {t("maxBelowTargetHint", {
                          pct: formatPct(targetPct),
                        })}
                      </p>
                    )
                  )}
                </div>
              </div>
            </div>
            <RecipePriceRecommendations
              form={form}
              computed={computed}
              isDisabled={isDisabled}
            />
          </CompactSection>
        </div>
      </div>

      <CompactSection
        title={`3 · ${t("grossMargin")}`}
        description={t("grossMarginDesc")}
      >
        {hasPrice ? (
          <RecipeMarginStatement
            computed={computed}
            amounts={{
              ingredient: amounts.total_ingredient_cost,
              labor: amounts.labor_cost,
              overhead: amounts.overhead_cost,
            }}
            sellingPrice={sellingPrice}
            targetPct={targetPct}
            categoryDefaults={categoryDefaults}
          />
        ) : (
          <p className="text-muted-foreground text-xs">{t("noPriceYet")}</p>
        )}
      </CompactSection>
    </>
  );
}

/** เป้า food cost ของหมวด ใต้ช่องเป้า — กดใช้ได้เมื่อค่าในช่องไม่ตรงกับหมวด */
function CategoryFoodCostHint({
  value,
  current,
  isDisabled,
  onApply,
}: {
  readonly value: number;
  readonly current: number;
  readonly isDisabled: boolean;
  readonly onApply: (value: number) => void;
}) {
  const t = useTranslations("operationPlan.recipe");
  return (
    <p className="text-muted-foreground text-micro mt-1 flex items-center gap-1.5">
      <span className="tabular-nums">
        {t("categoryDefaultHint", { pct: formatPct(value) })}
      </span>
      {!isDisabled && current !== value && (
        <button
          type="button"
          className="text-primary font-medium hover:underline"
          onClick={() => onApply(value)}
        >
          {t("applyCategoryDefault")}
        </button>
      )}
    </p>
  );
}

/**
 * อัตราค่าแรง/โสหุ้ยของหมวดต่อท้ายชื่อบรรทัดต้นทุน — อัตราของหมวดเป็น % ของราคาขาย
 * (หน้า Category) ปุ่มใช้ค่าจึงเติม ราคาขาย × อัตรา ลงช่อง และบอกยอดนั้นไว้ก่อนกด
 * ยังไม่มีราคาขาย = แสดงอัตราเฉย ๆ ไม่มีปุ่ม (ไม่มีฐานให้คูณ) · ช่องตรงกับยอดนั้นอยู่แล้ว = ไม่มีปุ่ม
 * เติมครั้งเดียวตอนกด — เปลี่ยนราคาขายทีหลัง ช่องไม่ตามเอง ปุ่มกลับมาให้กดใหม่
 */
function CategoryRateHint({
  className,
  label,
  pct,
  sellingPrice,
  current,
  isDisabled,
  onApply,
}: {
  readonly className?: string;
  readonly label: string;
  readonly pct: number;
  readonly sellingPrice: number;
  readonly current: number;
  readonly isDisabled: boolean;
  readonly onApply: (value: number) => void;
}) {
  const t = useTranslations("operationPlan.recipe");
  const amount = sellingPrice > 0 ? round2((sellingPrice * pct) / 100) : null;
  return (
    <span
      className={cn(
        "text-muted-foreground text-micro flex min-w-0 flex-wrap items-baseline gap-x-1.5",
        className,
      )}
    >
      <span className="whitespace-nowrap tabular-nums">
        {amount == null
          ? t("categoryRateOfPrice", { pct: formatPct(pct) })
          : t("categoryRateAmount", {
              pct: formatPct(pct),
              amount: formatCurrency(amount),
            })}
      </span>
      {!isDisabled && amount != null && current !== amount && (
        <button
          type="button"
          className="text-primary font-medium hover:underline"
          aria-label={t("applyCategoryRateAria", {
            label,
            pct: formatPct(pct),
            amount: formatCurrency(amount),
          })}
          onClick={() => onApply(amount)}
        >
          {t("applyCategoryDefault")}
        </button>
      )}
    </span>
  );
}

/** 30 → "30" · 0.5 → "0.5" — ไม่ปัดเป้าทศนิยมทิ้ง (0.5% ไม่ควรขึ้นเป็น 1%) */
function formatPct(n: number): string {
  return String(Number(n.toFixed(1)));
}
