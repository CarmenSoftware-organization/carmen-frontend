import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import type { IngredientCostLine, IngredientCostResult } from "@/types/recipe";
import type { RecipeFormValues } from "./recipe-form-schema";
import { computeRecipeCost, type RecipeCostCalc } from "./use-recipe-cost-calc";
import {
  refOf,
  type IngredientDraft,
  type RowCost,
} from "./recipe-ingredients-cost";

interface RecipeIngredientsRecalcDialogProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly computed: RecipeCostCalc;
  readonly drafts: IngredientDraft[];
  /** ต้นทุนบนจอตอนกดปุ่ม — ฝั่ง "เดิม" ของการเทียบ */
  readonly rows: RowCost[];
  readonly result: IngredientCostResult | undefined;
  readonly isPending: boolean;
  readonly error: Error | null;
  readonly onApply: (lines: IngredientCostLine[]) => void;
  readonly onClose: () => void;
}

/** ส่วนต่างเป็น % เทียบของเดิม — เดิมเป็น 0 เทียบไม่ได้ */
const diffPct = (oldV: number | null, newV: number) =>
  oldV != null && oldV > 0 ? ((newV - oldV) / oldV) * 100 : null;

function DiffCell({ pct }: { readonly pct: number | null }) {
  if (pct == null || Math.abs(pct) < 0.05)
    return <span className="text-muted-foreground">—</span>;
  // ต้นทุนขึ้น = ข่าวร้ายของจานนี้
  return (
    <span
      className={cn(
        "tabular-nums",
        pct > 0 ? "text-destructive" : "text-success-ink",
      )}
    >
      {pct > 0 ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

/**
 * "คำนวณใหม่" — ต้นทุนปัจจุบันจากคลังเทียบกับต้นทุนบนจอ ก่อนผู้ใช้ตัดสินใจ
 * กด "ใช้ต้นทุนใหม่" แล้วยังไม่บันทึก — ฟอร์มกลายเป็น dirty ต้องกด Save เอง
 */
export function RecipeIngredientsRecalcDialog({
  form,
  computed,
  drafts,
  rows,
  result,
  isPending,
  error,
  onApply,
  onClose,
}: RecipeIngredientsRecalcDialogProps) {
  const t = useTranslations("operationPlan.recipe");
  const tc = useTranslations("common");
  const [labor, overhead, baseYield, sell, target, max] = useWatch({
    control: form.control,
    name: [
      "labor_cost",
      "overhead_cost",
      "base_yield",
      "selling_price",
      "target_food_cost_percentage",
      "max_food_cost_percentage",
    ],
  });

  const lines = result?.items ?? [];
  const newTotal = Number(result?.total_ingredient_cost) || 0;
  const next = computeRecipeCost({
    ingredientCost: newTotal,
    laborCost: labor,
    overheadCost: overhead,
    baseYield,
    sellingPrice: sell,
    targetFoodCostPct: target,
    maxFoodCostPct: max,
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="gap-3 p-4 sm:max-w-2xl">
        <DialogHeader className="gap-1">
          <DialogTitle className="text-sm">{t("recalcTitle")}</DialogTitle>
          <DialogDescription className="text-xs">
            {t("recalcDesc")}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : error ? (
          <p className="text-destructive text-sm" role="alert">
            {t("recalcFailed")}
            {error.message ? ` — ${error.message}` : ""}
          </p>
        ) : (
          <>
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/60 sticky top-0">
                  <tr className="text-muted-foreground text-left">
                    <th scope="col" className="px-2 py-1.5 font-semibold">
                      {t("ingredientName")}
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-1.5 text-right font-semibold"
                    >
                      {t("recalcOld")}
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-1.5 text-right font-semibold"
                    >
                      {t("recalcNew")}
                    </th>
                    <th
                      scope="col"
                      className="px-2 py-1.5 text-right font-semibold"
                    >
                      {t("recalcDiff")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line, i) => {
                    const row = rows[i];
                    const oldCost = row?.state === "ok" ? row.line_cost : null;
                    const newCost = Number(line.line_cost) || 0;
                    return (
                      <tr
                        key={`${refOf(line)}-${i}`}
                        className="border-border/60 border-t"
                      >
                        <td className="px-2 py-1.5">
                          {line.sub_recipe?.name ??
                            line.product?.name ??
                            drafts[i]?.product_label ??
                            "—"}
                        </td>
                        <td className="text-muted-foreground px-2 py-1.5 text-right tabular-nums">
                          {oldCost == null
                            ? "—"
                            : `฿${formatCurrency(oldCost)}`}
                        </td>
                        <td className="px-2 py-1.5 text-right font-semibold tabular-nums">
                          ฿{formatCurrency(newCost)}
                        </td>
                        <td className="px-2 py-1.5 text-right">
                          <DiffCell pct={diffPct(oldCost, newCost)} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <dl className="grid gap-2 text-xs sm:grid-cols-2">
              <CompareLine
                label={t("costPerPortion")}
                oldText={`฿${formatCurrency(computed.costPerPortion)}`}
                newText={`฿${formatCurrency(next.costPerPortion)}`}
                pct={diffPct(computed.costPerPortion, next.costPerPortion)}
              />
              <CompareLine
                label={t("actualFoodCost")}
                oldText={
                  computed.actualFoodCostPct == null
                    ? "—"
                    : `${computed.actualFoodCostPct.toFixed(1)}%`
                }
                newText={
                  next.actualFoodCostPct == null
                    ? "—"
                    : `${next.actualFoodCostPct.toFixed(1)}%`
                }
                pct={null}
              />
            </dl>
          </>
        )}

        <DialogFooter className="pt-1">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isPending || !!error || lines.length === 0}
            onClick={() => onApply(lines)}
          >
            {t("recalcApply")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CompareLine({
  label,
  oldText,
  newText,
  pct,
}: {
  readonly label: string;
  readonly oldText: string;
  readonly newText: string;
  readonly pct: number | null;
}) {
  return (
    <div className="bg-muted/40 flex flex-wrap items-baseline justify-between gap-2 rounded-md px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex items-baseline gap-1.5 tabular-nums">
        <span className="text-muted-foreground">{oldText}</span>
        <ArrowRight className="size-3 self-center" aria-hidden="true" />
        <span className="text-foreground text-sm font-semibold">{newText}</span>
        <DiffCell pct={pct} />
      </dd>
    </div>
  );
}
