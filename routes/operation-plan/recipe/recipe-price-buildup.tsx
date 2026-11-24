import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { FieldInput } from "@/components/ui/field";
import { formatCurrency, round2 } from "@/lib/currency-utils";
import {
  computeGrossPrice,
  solveNetForGross,
  type PriceRates,
} from "@/lib/bu-price-rates";
import {
  nullableNumberInput,
  type RecipeFormValues,
} from "./recipe-form-schema";

/** 10 → "10" · 7.5 → "7.5" */
function formatPct(n: number): string {
  return String(Number(n.toFixed(2)));
}

/**
 * ราคาขายแบบคิดได้สองทาง: กรอก net → บวกค่าบริการ แล้ว VAT (คิดบน net + ค่าบริการ) ได้ gross
 * หรือกรอก gross → คิดย้อนเป็น net (ผู้ใช้สั่ง 2026-11-24)
 *
 * ที่บันทึกคือ net (`selling_price`) อย่างเดียว — gross ไม่มีคอลัมน์ คิดจาก net ทุกครั้ง
 * BU เปลี่ยน % ทีหลัง net คงเดิม gross เปลี่ยนตาม · food cost % หลักยังเทียบกับ net
 * (รายได้ที่ร้านได้จริง) gross แสดงคู่ไว้ดูเท่านั้น
 */
export function RecipePriceBuildup({
  form,
  isDisabled,
  error,
  ingredientCost,
  rates,
}: {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  /** error ของช่อง selling_price — ผู้เรียกถือ useFormState อยู่แล้ว */
  readonly error?: string;
  readonly ingredientCost: number;
  readonly rates: PriceRates;
}) {
  const t = useTranslations("operationPlan.recipe");
  const sell = useWatch({ control: form.control, name: "selling_price" });
  const net = Number(sell) || 0;
  const p = computeGrossPrice(net, rates);
  // ข้อความดิบของช่อง gross ระหว่างพิมพ์ — ไม่งั้นพิมพ์ "8" แล้วถูกแทนด้วย "8.00" ทันที
  // ออกจากช่องแล้วล้าง ช่องกลับไปโชว์ gross ที่คิดจาก net (ตรงกับที่พิมพ์ หรือใกล้สุดที่ทำได้)
  const [grossDraft, setGrossDraft] = useState<string | null>(null);
  const typedGross =
    grossDraft != null && grossDraft.trim() !== "" ? Number(grossDraft) : null;
  const offByRounding =
    typedGross != null &&
    Number.isFinite(typedGross) &&
    net > 0 &&
    round2(typedGross) !== p.gross;

  const setNet = (value: number | null) =>
    form.setValue("selling_price", value, {
      shouldDirty: true,
      shouldValidate: true,
    });
  const onGrossChange = (raw: string) => {
    setGrossDraft(raw);
    if (raw.trim() === "") return setNet(null);
    const gross = Number(raw);
    if (!Number.isFinite(gross) || gross < 0) return;
    setNet(solveNetForGross(gross, rates).net);
  };

  const pct = (price: number) =>
    price > 0 ? ((ingredientCost / price) * 100).toFixed(1) : "—";
  // คอลัมน์ขวากว้างเท่าช่องกรอก (w-32) · ยอดที่ไม่ใช่ช่องกรอกเว้น pr-3 = padding ในช่อง ตัวเลขจึงตรงหลักกัน
  const row =
    "grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-x-3 text-xs tabular-nums";
  const inputClass = "text-right text-sm font-semibold tabular-nums";

  return (
    <div data-recipe-price-buildup>
      <div className="space-y-1">
        <div className={row}>
          <label htmlFor="recipe-selling-price" className="text-foreground">
            {t("sellingPriceNet")}
          </label>
          <FieldInput
            id="recipe-selling-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            disabled={isDisabled}
            size="sm"
            className={inputClass}
            placeholder="0.00"
            error={error}
            errorIconAlign="left"
            {...form.register("selling_price", nullableNumberInput)}
          />
        </div>
        <div className={cn(row, "text-muted-foreground")}>
          <span>+ {t("serviceCharge", { pct: formatPct(rates.service) })}</span>
          <span className="pr-3 text-right">฿{formatCurrency(p.service)}</span>
        </div>
        <div className={cn(row, "text-muted-foreground")}>
          <span>+ {t("vatRate", { pct: formatPct(rates.vat) })}</span>
          <span className="pr-3 text-right">฿{formatCurrency(p.vat)}</span>
        </div>
        <div className={cn(row, "border-t pt-1.5")}>
          <label
            htmlFor="recipe-gross-price"
            className="text-foreground text-sm font-semibold"
          >
            = {t("grossPrice")}
          </label>
          <FieldInput
            id="recipe-gross-price"
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            disabled={isDisabled}
            size="sm"
            className={inputClass}
            placeholder="0.00"
            value={grossDraft ?? (net > 0 ? p.gross.toFixed(2) : "")}
            onChange={(e) => onGrossChange(e.target.value)}
            onBlur={() => setGrossDraft(null)}
          />
        </div>
      </div>
      {offByRounding && (
        <p className="text-warning-ink text-micro mt-1 text-right tabular-nums">
          {t("grossNearest", {
            gross: formatCurrency(p.gross),
            net: formatCurrency(p.net),
          })}
        </p>
      )}
      <p className="text-muted-foreground text-micro mt-2 tabular-nums">
        {net > 0 && (
          <>
            {t("foodCostNetGross", { net: pct(p.net), gross: pct(p.gross) })}
            <span className="mx-1.5">·</span>
          </>
        )}
        {t("priceRatesHint")}
      </p>
    </div>
  );
}
