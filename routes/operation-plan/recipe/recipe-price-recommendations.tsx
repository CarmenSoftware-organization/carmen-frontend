import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { EyeBrow } from "@/components/ui/eye-brow";
import { formatCurrency } from "@/lib/currency-utils";
import type { RecipeFormValues } from "./recipe-form-schema";
import type { RecipeCostCalc } from "./use-recipe-cost-calc";

interface RecipePriceRecommendationsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly computed: RecipeCostCalc;
  readonly isDisabled: boolean;
}

/**
 * ราคาที่เป้า + ราคาขั้นต่ำ (จากเพดาน food cost) ของทั้งสูตร — กดใช้แล้วกำไรขึ้นในส่วนกำไรขั้นต้นข้างล่าง
 * ฐานเดียวกับ food cost: ต้นทุนวัตถุดิบทั้งสูตร ÷ % · ขายต่ำกว่าขั้นต่ำได้ (เตือนอย่างเดียว)
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

  // การ์ดขึ้นเมื่อมีราคาอย่างน้อยหนึ่งแถว — ตั้งแค่เพดาน (ไม่มีเป้า) ก็ยังเห็นราคาขั้นต่ำ
  // และคำเตือนขายต่ำกว่าขั้นต่ำ · กฎ "เพดาน < เป้า ไม่โชว์ขั้นต่ำ" อยู่ใน computeRecipeCost
  const rows = [
    ...(computed.suggestedPrice != null
      ? [
          {
            key: "target",
            label: t("priceAtTarget", { pct: formatPct(Number(target) || 0) }),
            price: computed.suggestedPrice,
          },
        ]
      : []),
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

  if (rows.length === 0) return null;

  const apply = (price: number) =>
    form.setValue("selling_price", price, {
      shouldDirty: true,
      shouldValidate: true,
    });

  return (
    <div className="mt-4 border-t pt-4">
      <EyeBrow className="mb-2">{t("priceRecommendations")}</EyeBrow>
      <div className="divide-y">
        {rows.map((row) => {
          return (
            <div
              key={row.key}
              className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 py-2"
            >
              <div className="text-foreground min-w-0 truncate text-xs">
                {row.label}
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
