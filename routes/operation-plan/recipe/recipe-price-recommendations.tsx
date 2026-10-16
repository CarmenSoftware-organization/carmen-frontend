import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { EyeBrow } from "@/components/ui/eye-brow";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { RecipeFormValues } from "./recipe-form-schema";
import type { RecipeCostCalc } from "./use-recipe-cost-calc";

interface RecipePriceRecommendationsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly computed: RecipeCostCalc;
  readonly isDisabled: boolean;
}

/**
 * ราคาที่เป้า + ราคาขั้นต่ำ (จากเพดาน food cost) พร้อมกำไรต่อจาน
 * ฐานเดียวกับ food cost: ต้นทุนวัตถุดิบต่อจาน ÷ % · ขายต่ำกว่าขั้นต่ำได้ (เตือนอย่างเดียว)
 */
export function RecipePriceRecommendations({
  form,
  computed,
  isDisabled,
}: RecipePriceRecommendationsProps) {
  const t = useTranslations("operationPlan.recipe");
  const [target, max] = useWatch({
    control: form.control,
    name: ["target_food_cost_percentage", "max_food_cost_percentage"],
  });

  if (computed.suggestedPrice == null) return null;

  const rows = [
    {
      key: "target",
      label: t("priceAtTarget", { pct: formatPct(Number(target) || 0) }),
      price: computed.suggestedPrice,
    },
    ...(computed.minPrice != null
      ? [
          {
            key: "min",
            label: t("priceAtMin", { pct: formatPct(Number(max) || 0) }),
            price: computed.minPrice,
          },
        ]
      : []),
  ];

  const apply = (price: number) =>
    form.setValue("selling_price", price, {
      shouldDirty: true,
      shouldValidate: true,
    });

  return (
    <div className="mt-4 border-t pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <EyeBrow>{t("priceRecommendations")}</EyeBrow>
        <span className="text-muted-foreground text-xs">
          {t("markup")}{" "}
          <span className="text-foreground font-semibold tabular-nums">
            {computed.markup == null ? "—" : `×${computed.markup.toFixed(2)}`}
          </span>
        </span>
      </div>
      <div className="divide-y">
        {rows.map((row) => {
          const profit = computed.profitAt(row.price);
          return (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2"
            >
              <div className="min-w-0">
                <div className="text-foreground truncate text-xs">
                  {row.label}
                </div>
                <div
                  className={cn(
                    "text-micro tabular-nums",
                    profit != null && profit < 0
                      ? "text-destructive"
                      : "text-muted-foreground",
                  )}
                >
                  {t("profitPerPortion")} ฿{formatCurrency(profit ?? 0)}
                </div>
              </div>
              <span className="text-foreground text-sm font-semibold tabular-nums">
                ฿{formatCurrency(row.price)}
              </span>
              <Button
                type="button"
                variant="outline"
                size="xs"
                disabled={isDisabled}
                onClick={() => apply(row.price)}
              >
                {t("useThisPrice")}
              </Button>
            </div>
          );
        })}
      </div>
      {computed.belowMinPrice && computed.minPrice != null && (
        <p className="text-destructive mt-2 text-xs font-semibold">
          {t("belowMinPrice", {
            price: `฿${formatCurrency(computed.minPrice)}`,
          })}
        </p>
      )}
    </div>
  );
}

/** 30 → "30" · 0.5 → "0.5" */
function formatPct(n: number): string {
  return String(Number(n.toFixed(1)));
}
