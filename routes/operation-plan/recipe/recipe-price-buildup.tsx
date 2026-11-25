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
import { costPctOf, priceForCostPct } from "./recipe-cost-pct";

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
 * (รายได้ที่ร้านได้จริง)
 *
 * Net/Gross Cost (%) ใต้ราคา = ต้นทุนวัตถุดิบ ÷ ราคา — กรอก % ก็คิดราคาให้ (คนที่ตั้งราคาจาก %
 * แบบ Summary Cost ของระบบเก่า ผู้ใช้สั่ง 2026-11-25) แต่ % ไม่ถูกเก็บ: ต้นทุนเปลี่ยนทีหลัง
 * ราคาคงเดิมแล้ว % ขยับตาม — ต่างจากเป้า (Target/Max) ที่เก็บไว้และราคาแนะนำขยับตามต้นทุน
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

  // Net/Gross Cost (%) — ข้อความดิบระหว่างพิมพ์แบบเดียวกับช่อง gross
  const [pctDraft, setPctDraft] = useState<{
    readonly field: "net" | "gross";
    readonly raw: string;
  } | null>(null);
  const netPct = costPctOf(ingredientCost, p.net);
  const grossPct = costPctOf(ingredientCost, p.gross);
  const canPriceFromPct = !isDisabled && ingredientCost > 0;
  const onPctChange = (field: "net" | "gross", raw: string) => {
    setPctDraft({ field, raw });
    if (raw.trim() === "") return setNet(null);
    const price = priceForCostPct(ingredientCost, Number(raw));
    if (price == null) return;
    setNet(field === "net" ? price : solveNetForGross(price, rates).net);
  };
  const typedPct =
    pctDraft != null && pctDraft.raw.trim() !== ""
      ? Number(pctDraft.raw)
      : null;
  const reachedPct = pctDraft?.field === "gross" ? grossPct : netPct;
  const pctOffByRounding =
    typedPct != null &&
    Number.isFinite(typedPct) &&
    reachedPct != null &&
    round2(typedPct) !== reachedPct;
  const pctValue = (field: "net" | "gross", value: number | null) =>
    pctDraft?.field === field
      ? pctDraft.raw
      : value == null
        ? ""
        : value.toFixed(2);
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
      <div
        className="mt-2 space-y-1 border-t pt-1.5"
        title={ingredientCost > 0 ? undefined : t("costPctNeedsIngredient")}
      >
        {(
          [
            ["net", "recipe-net-cost-pct", t("netCostPct"), netPct],
            ["gross", "recipe-gross-cost-pct", t("grossCostPct"), grossPct],
          ] as const
        ).map(([field, id, label, value]) => (
          <div key={field} className={row}>
            <label htmlFor={id} className="text-foreground">
              {label}
            </label>
            <FieldInput
              id={id}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              disabled={!canPriceFromPct}
              size="sm"
              className="text-right text-xs tabular-nums"
              placeholder={ingredientCost > 0 ? "0.00" : "—"}
              value={pctValue(field, value)}
              onChange={(e) => onPctChange(field, e.target.value)}
              onBlur={() => setPctDraft(null)}
            />
          </div>
        ))}
      </div>
      {pctOffByRounding && reachedPct != null && (
        <p className="text-warning-ink text-micro mt-1 text-right tabular-nums">
          {t("costPctNearest", { pct: reachedPct.toFixed(2) })}
        </p>
      )}
      <p className="text-muted-foreground text-micro mt-2">
        {t("costPctHint")}
        <span className="mx-1.5">·</span>
        {t("priceRatesHint")}
      </p>
    </div>
  );
}
