import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency-utils";
import { computeGrossPrice, type PriceRates } from "@/lib/bu-price-rates";

/** 10 → "10" · 7.5 → "7.5" */
function formatPct(n: number): string {
  return String(Number(n.toFixed(2)));
}

/**
 * ราคาขาย (net) → บวกค่าบริการ แล้ว VAT (คิดบน net + ค่าบริการ) = ราคา gross ที่ลูกค้าจ่าย
 * food cost % หลักยังเทียบกับ net (รายได้ที่ร้านได้จริง) — gross แสดงคู่ไว้ดูเท่านั้น
 */
export function RecipePriceBuildup({
  sellingPrice,
  ingredientCost,
  rates,
}: {
  readonly sellingPrice: number;
  readonly ingredientCost: number;
  readonly rates: PriceRates;
}) {
  const t = useTranslations("operationPlan.recipe");
  if (!(sellingPrice > 0)) return null;
  const p = computeGrossPrice(sellingPrice, rates);
  const pct = (price: number) =>
    price > 0 ? ((ingredientCost / price) * 100).toFixed(1) : "—";
  const row = "flex items-baseline justify-between gap-4 text-xs tabular-nums";

  return (
    <div className="mt-4 border-t pt-3" data-recipe-price-buildup>
      <div className="space-y-1">
        <div className={row}>
          <span className="text-foreground">{t("netPrice")}</span>
          <span className="text-foreground">฿{formatCurrency(p.net)}</span>
        </div>
        <div className={cn(row, "text-muted-foreground")}>
          <span>+ {t("serviceCharge", { pct: formatPct(rates.service) })}</span>
          <span>฿{formatCurrency(p.service)}</span>
        </div>
        <div className={cn(row, "text-muted-foreground")}>
          <span>+ {t("vatRate", { pct: formatPct(rates.vat) })}</span>
          <span>฿{formatCurrency(p.vat)}</span>
        </div>
        <div className={cn(row, "border-t pt-1.5")}>
          <span className="text-foreground text-sm font-semibold">
            = {t("grossPrice")}
          </span>
          <span className="text-foreground text-sm font-semibold">
            ฿{formatCurrency(p.gross)}
          </span>
        </div>
      </div>
      <p className="text-muted-foreground text-micro mt-2 tabular-nums">
        {t("foodCostNetGross", { net: pct(p.net), gross: pct(p.gross) })}
        <span className="mx-1.5">·</span>
        {t("priceRatesHint")}
      </p>
    </div>
  );
}
