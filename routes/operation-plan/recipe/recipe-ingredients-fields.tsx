import { useEffect, useRef, useState } from "react";
import {
  Controller,
  useFieldArray,
  useFormState,
  useWatch,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { useQueries } from "@tanstack/react-query";
import { Calculator, Plus, RotateCw, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, FieldInput } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingSection } from "@/components/ui/setting-section";
import { EyeBrow } from "@/components/ui/eye-brow";
import EmptyComponent from "@/components/empty-component";
import { LookupProduct } from "@/components/lookup/lookup-product";
import {
  productIngredientUnitsQuery,
  useProductIngredientUnits,
} from "@/hooks/use-product-units";
import { useBuCode } from "@/hooks/use-bu-code";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency } from "@/lib/currency-utils";
import type {
  IngredientCostLine,
  IngredientCostSource,
  Recipe,
  RecipeIngredientLine,
} from "@/types/recipe";
import { numberInput, type RecipeFormValues } from "./recipe-form-schema";
import type { RecipeCostCalc } from "./use-recipe-cost-calc";
import {
  activeIngredients,
  draftToInput,
  EMPTY_INGREDIENT,
  formatQty,
  pairCostsFrom,
  pairKey,
  pendingPairs,
  resolveRowCosts,
  round5,
  type IngredientDraft,
  type PairCost,
  type RowCost,
} from "./recipe-ingredients-cost";
import { usePreviewIngredientCosts } from "./use-recipe-ingredients";
import { RecipeIngredientsRecalcDialog } from "./recipe-ingredients-recalc-dialog";

interface RecipeIngredientsFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  /** undefined = สูตรใหม่ ยังไม่มี recipe_id ให้ผูกวัตถุดิบ */
  readonly recipe?: Recipe;
  readonly computed: RecipeCostCalc;
}

/** ป้ายบอกว่าต้นทุนบรรทัดนี้ไม่ได้มาจากต้นทุนเฉลี่ยคลัง */
const SOURCE_BADGE: Partial<
  Record<
    IngredientCostSource,
    {
      key: "costSourceLastAverage" | "costSourceStandard" | "costSourceNone";
      variant: "warning-light" | "info-light" | "destructive-light";
    }
  >
> = {
  last_average: { key: "costSourceLastAverage", variant: "warning-light" },
  standard: { key: "costSourceStandard", variant: "info-light" },
  none: { key: "costSourceNone", variant: "destructive-light" },
};

const EPSILON = 1e-6;

/**
 * วัตถุดิบของสูตร — ผูกสินค้าในคลัง บันทึกพร้อมปุ่ม Save ของฟอร์ม (PUT แทนทั้งชุดก่อนหัวสูตร)
 *
 * ต้นทุนเป็นของ server ทั้งหมด: บรรทัดที่สินค้า+หน่วยเดิมแสดงต้นทุนต่อหน่วยที่บันทึกไว้
 * (snapshot — ไม่ขยับเอง) ส่วนบรรทัดใหม่/เปลี่ยนสินค้า/เปลี่ยนหน่วยถาม preview แล้วจำต่อคู่
 * (สินค้า, หน่วย) ไว้ — จำนวนกับ % เสียคำนวณบนจอด้วยสูตรเดียวกับสัญญา API ไม่ต้องยิงซ้ำ
 */
export function RecipeIngredientsFields({
  form,
  isDisabled,
  recipe,
  computed,
}: RecipeIngredientsFieldsProps) {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "ingredients",
    keyName: "key",
  });
  const watched = useWatch({ control: form.control, name: "ingredients" });
  const recalculate = useWatch({
    control: form.control,
    name: "recalculate_ingredients",
  });
  const drafts: IngredientDraft[] = watched ?? [];
  const saved = activeIngredients(recipe?.ingredients);

  // ต้นทุนปัจจุบันต่อคู่ (สินค้า, หน่วย) จาก preview — อยู่ข้างนอกฟอร์มเพราะเป็นค่าแสดงผล
  const [current, setCurrent] = useState<ReadonlyMap<string, PairCost>>(
    () => new Map(),
  );

  // อัตราส่วนแปลงหน่วยแบบไม่ปัดจาก ingredient-units (cache เดียวกับ select หน่วยของแถว) —
  // ให้ inventory_qty บนจอคิดแบบเดียวกับ server ไม่ใช่จาก conversion_factor ที่ปัด 5 ตำแหน่งแล้ว
  const buCode = useBuCode();
  const productIds = [
    ...new Set(drafts.map((d) => d.product_id).filter(Boolean)),
  ];
  const unitQueries = useQueries({
    queries: productIds.map((id) => productIngredientUnitsQuery(buCode, id)),
  });
  const ratios = new Map<string, number>();
  productIds.forEach((pid, idx) => {
    for (const u of unitQueries[idx]?.data ?? []) {
      ratios.set(pairKey(pid, u.id), Number(u.conversion));
    }
  });

  const rows = resolveRowCosts(drafts, saved, current, recalculate, ratios);
  const total = round5(
    rows.reduce((s, r) => (r.state === "ok" ? s + r.line_cost : s), 0),
  );

  // ยอดรวมบรรทัด = Ingredient Cost ใน Costing
  // · มีแถว → ยอดรวมบรรทัด
  // · ลบจนหมดและสูตรเคยบันทึกวัตถุดิบไว้ → 0 (ตรงกับที่ server จะตั้งตอน PUT items ว่าง)
  // · ลบจนหมดและสูตรไม่เคยมีวัตถุดิบ → คืนค่าที่กรอกมือไว้ก่อนเพิ่มแถวแรก
  // ไม่ส่ง shouldDirty — ความ dirty มาจากรายการวัตถุดิบเอง เพิ่มแล้วลบจนหมด = กลับเป็นค่าเดิม
  const hadSavedIngredients = saved.length > 0;
  const manualTotalRef = useRef<number>(
    Number(recipe?.total_ingredient_cost) || 0,
  );
  const prevCountRef = useRef(drafts.length);
  useEffect(() => {
    const prevCount = prevCountRef.current;
    prevCountRef.current = drafts.length;
    const cur = Number(form.getValues("total_ingredient_cost")) || 0;
    let target: number | null = null;
    if (drafts.length > 0) {
      if (prevCount === 0 && !hadSavedIngredients) manualTotalRef.current = cur;
      target = total;
    } else if (hadSavedIngredients) {
      target = 0;
    } else if (prevCount > 0) {
      target = manualTotalRef.current;
    }
    if (target !== null && Math.abs(cur - target) > EPSILON)
      form.setValue("total_ingredient_cost", target);
  }, [drafts.length, total, hadSavedIngredients, form]);

  // ถามต้นทุนปัจจุบันเฉพาะคู่ที่ยังไม่รู้ — debounce กันยิงระหว่างเลือกหลายแถวติดกัน
  const { mutateAsync: previewCosts } = usePreviewIngredientCosts();
  const needKey = pendingPairs(drafts, rows)
    .map((p) => pairKey(p.product_id, p.ingredient_unit_id))
    .join(",");
  const debouncedNeedKey = useDebouncedValue(needKey, 400);
  const inFlight = useRef(new Set<string>());
  const recipeId = recipe?.id;
  const fallbackError = t("costPreviewFailed");
  const requestPair = (key: string) => {
    if (!recipeId || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    const [product_id, ingredient_unit_id] = key.split("|");
    previewCosts({
      recipeId,
      items: [
        { product_id, ingredient_unit_id, qty: 1, wastage_percentage: 0 },
      ],
    })
      .then((res) => {
        const hit = pairCostsFrom(res.items).find(([k]) => k === key);
        setCurrent((prev) =>
          new Map(prev).set(
            key,
            hit ? hit[1] : { ok: false, message: fallbackError },
          ),
        );
      })
      .catch((err: Error) => {
        setCurrent((prev) =>
          new Map(prev).set(key, {
            ok: false,
            message: err.message || fallbackError,
          }),
        );
      })
      .finally(() => inFlight.current.delete(key));
  };
  useEffect(() => {
    if (!recipeId || !debouncedNeedKey) return;
    // ยิงทีละคู่ — คู่ที่หน่วยไม่มี conversion ได้ 400 ต้องไม่พาคู่อื่นล้มไปด้วย
    // เฉพาะคู่ที่ยังรออยู่จริงตอนนี้ (needKey) — ค่า debounce อาจค้างคู่ที่ได้ผลไปแล้ว เช่นจากปุ่มลองใหม่
    const stillNeeded = new Set(needKey.split(","));
    for (const key of debouncedNeedKey.split(",")) {
      if (stillNeeded.has(key)) requestPair(key);
    }
    // requestPair อ่านแค่ recipeId/previewCosts/fallbackError ที่อยู่ใน deps แล้ว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedNeedKey, needKey, recipeId, previewCosts, fallbackError]);
  // ต้นทุนที่ถามไม่สำเร็จไม่จำถาวร — ลบผลเดิมแล้วถามใหม่ทันที (เน็ตหลุด/server ล่มชั่วคราว)
  const retryPair = (key: string) => {
    setCurrent((prev) => {
      const next = new Map(prev);
      next.delete(key);
      return next;
    });
    requestPair(key);
  };

  // คำนวณใหม่ — ต้นทุนปัจจุบันทั้งรายการ เทียบกับบนจอก่อนตัดสินใจ
  const recalc = usePreviewIngredientCosts();
  const [showRecalc, setShowRecalc] = useState(false);
  const canRecalc =
    drafts.length > 0 &&
    drafts.every((d) => d.product_id && d.ingredient_unit_id && d.qty > 0);
  const openRecalc = () => {
    if (!recipeId) return;
    recalc.reset();
    recalc.mutate({ recipeId, items: drafts.map(draftToInput) });
    setShowRecalc(true);
  };
  const applyRecalc = (lines: IngredientCostLine[]) => {
    setCurrent((prev) => {
      const next = new Map(prev);
      for (const [k, v] of pairCostsFrom(lines)) next.set(k, v);
      return next;
    });
    form.setValue("recalculate_ingredients", true, { shouldDirty: true });
    setShowRecalc(false);
  };

  const handleAdd = () => append({ ...EMPTY_INGREDIENT });
  const isNew = !recipe;

  return (
    <SettingSection
      plain
      title={t("ingredients")}
      description={t("ingredientsDesc")}
      action={
        !isNew && !isDisabled && fields.length > 0 ? (
          <Button
            type="button"
            size="xs"
            variant="outline"
            onClick={openRecalc}
            disabled={!canRecalc}
            className="gap-1"
          >
            <Calculator className="size-3" aria-hidden="true" />
            {t("recalculate")}
          </Button>
        ) : undefined
      }
    >
      {isNew ? (
        <p className="text-muted-foreground text-sm">
          {t("ingredientsAfterSave")}
        </p>
      ) : fields.length === 0 ? (
        <EmptyComponent
          title={t("noIngredientsYet")}
          description={t("noIngredientsDesc")}
          content={
            !isDisabled && (
              <Button
                type="button"
                size="sm"
                onClick={handleAdd}
                className="gap-1"
              >
                <Plus className="size-3" aria-hidden="true" />
                {t("addFirstIngredient")}
              </Button>
            )
          }
        />
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <p className="text-muted-foreground">
              {t("ingredientCount", { count: fields.length })}
              {" · "}
              <span className="text-foreground font-semibold tabular-nums">
                ฿{formatCurrency(total)}
              </span>{" "}
              {tfl("total")}
            </p>
            {recalculate && (
              <Badge variant="warning-light">{t("recalcApplied")}</Badge>
            )}
          </div>

          {fields.map((field, i) => (
            <IngredientRow
              key={field.key}
              form={form}
              index={i}
              cost={rows[i] ?? { state: "incomplete" }}
              saved={saved}
              isDisabled={isDisabled}
              onRemove={() => remove(i)}
              onRetryCost={() => {
                const d = drafts[i];
                if (d?.product_id && d.ingredient_unit_id)
                  retryPair(pairKey(d.product_id, d.ingredient_unit_id));
              }}
            />
          ))}

          {!isDisabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
            >
              <Plus />
              {t("addIngredient")}
            </Button>
          )}

          <IngredientCostTable
            drafts={drafts}
            rows={rows}
            saved={saved}
            total={total}
          />
        </div>
      )}

      {showRecalc && (
        <RecipeIngredientsRecalcDialog
          form={form}
          computed={computed}
          drafts={drafts}
          rows={rows}
          result={recalc.data}
          isPending={recalc.isPending}
          error={recalc.error}
          onApply={applyRecalc}
          onClose={() => setShowRecalc(false)}
        />
      )}
    </SettingSection>
  );
}

function IngredientRow({
  form,
  index: i,
  cost,
  saved,
  isDisabled,
  onRemove,
  onRetryCost,
}: {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly index: number;
  readonly cost: RowCost;
  readonly saved: RecipeIngredientLine[];
  readonly isDisabled: boolean;
  readonly onRemove: () => void;
  readonly onRetryCost: () => void;
}) {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  // อ่าน error ผ่าน useFormState — อ่าน form.formState ตรง ๆ แล้ว error ไม่ re-render
  const { errors, isSubmitted } = useFormState({
    control: form.control,
    name: `ingredients.${i}`,
  });
  const rowErrors = errors.ingredients?.[i];
  const [productId, productLabel, unitId] = useWatch({
    control: form.control,
    name: [
      `ingredients.${i}.product_id`,
      `ingredients.${i}.product_label`,
      `ingredients.${i}.ingredient_unit_id`,
    ],
  });
  const { data: units } = useProductIngredientUnits(productId || undefined);
  const firstUnitId = units?.[0]?.id;

  // เปลี่ยนสินค้าแล้วหน่วยว่าง — ตั้งเป็นหน่วยแรก (หน่วย inventory) ให้เลย
  useEffect(() => {
    if (productId && !unitId && firstUnitId) {
      form.setValue(`ingredients.${i}.ingredient_unit_id`, firstUnitId, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
    }
  }, [productId, unitId, firstUnitId, i, form, isSubmitted]);

  // หน่วยที่บันทึกไว้แต่ไม่อยู่ในรายการแล้ว (conversion ถูกปิด) ยังต้องโชว์ชื่อได้
  const savedUnit = saved.find(
    (s) => s.ingredient_unit_id === unitId,
  )?.ingredient_unit;
  const unitOptions = [...(units ?? [])];
  if (unitId && savedUnit && !unitOptions.some((u) => u.id === unitId)) {
    unitOptions.push({ id: unitId, name: savedUnit.name, conversion: 0 });
  }

  const badge =
    cost.state === "ok" ? SOURCE_BADGE[cost.unit.cost_source] : undefined;

  return (
    <div className="rounded-md border p-3">
      {/* สินค้าเต็มแถวบน — การ์ดในฟอร์มแคบ ถ้าอยู่แถวเดียวกับหน่วย/จำนวน ชื่อสินค้าเหลือ ~120px */}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_5rem_7rem_auto] sm:items-start">
        <div className="min-w-0 sm:col-span-full">
          <LookupProduct
            value={productId}
            defaultLabel={productLabel || undefined}
            size="sm"
            // ปุ่ม combobox กว้างตามชื่อสินค้า (shrink-0) — ชื่อยาวล้นทับช่องหน่วย
            className="w-full min-w-0"
            disabled={isDisabled}
            placeholder={t("ingredientName")}
            error={rowErrors?.product_id?.message}
            onValueChange={(id, item) => {
              if (id === productId) return;
              const opts = { shouldDirty: true, shouldValidate: isSubmitted };
              form.setValue(`ingredients.${i}.product_id`, id, opts);
              form.setValue(
                `ingredients.${i}.product_label`,
                item?.name ?? item?.code ?? "",
                opts,
              );
              form.setValue(`ingredients.${i}.ingredient_unit_id`, "", opts);
            }}
          />
        </div>

        <div>
          <Controller
            control={form.control}
            name={`ingredients.${i}.ingredient_unit_id`}
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled || !productId}
              >
                <SelectTrigger
                  size="sm"
                  className="w-full"
                  aria-label={tfl("unit")}
                  aria-invalid={!!rowErrors?.ingredient_unit_id}
                >
                  <SelectValue placeholder={tfl("unit")} />
                </SelectTrigger>
                <SelectContent>
                  {unitOptions.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[rowErrors?.ingredient_unit_id]} />
        </div>

        <FieldInput
          aria-label={tfl("qty")}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          size="sm"
          disabled={isDisabled}
          className="text-right tabular-nums"
          error={rowErrors?.qty?.message}
          errorIconAlign="left"
          {...form.register(`ingredients.${i}.qty`, numberInput)}
        />

        <div className="relative">
          <FieldInput
            aria-label={t("wastagePct")}
            title={t("wastagePct")}
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            step="any"
            size="sm"
            disabled={isDisabled}
            className="pr-6 text-right tabular-nums"
            error={rowErrors?.wastage_percentage?.message}
            errorIconAlign="left"
            {...form.register(
              `ingredients.${i}.wastage_percentage`,
              numberInput,
            )}
          />
          <span className="text-muted-foreground text-micro pointer-events-none absolute top-1/2 right-2 -translate-y-1/2">
            %
          </span>
        </div>

        <div className="flex min-h-8 flex-col items-end justify-center text-right">
          <LineCostValue cost={cost} onRetry={onRetryCost} />
          {badge && (
            <Badge variant={badge.variant} size="xs" className="mt-0.5">
              {t(badge.key)}
            </Badge>
          )}
        </div>

        {!isDisabled && (
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("removeIngredient")}
            onClick={onRemove}
            className="justify-self-end"
          >
            <Trash2 />
          </Button>
        )}
      </div>

      <FieldInput
        aria-label={t("ingredientNote")}
        placeholder={t("ingredientNote")}
        size="sm"
        maxLength={500}
        disabled={isDisabled}
        className="mt-2"
        error={rowErrors?.note?.message}
        {...form.register(`ingredients.${i}.note`)}
      />
    </div>
  );
}

function LineCostValue({
  cost,
  onRetry,
}: {
  readonly cost: RowCost;
  readonly onRetry: () => void;
}) {
  const t = useTranslations("operationPlan.recipe");
  switch (cost.state) {
    case "ok":
      return (
        <span
          className="text-foreground text-sm font-semibold tabular-nums"
          aria-label={t("lineCost")}
        >
          ฿{formatCurrency(cost.line_cost)}
        </span>
      );
    case "pending":
      return (
        <span className="text-muted-foreground text-xs">
          {t("costPending")}
        </span>
      );
    case "error":
      return (
        <span className="flex flex-col items-end gap-0.5">
          <span className="text-destructive text-xs" role="alert">
            {cost.message}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={onRetry}
            className="gap-1"
          >
            <RotateCw className="size-3" aria-hidden="true" />
            {t("retryCost")}
          </Button>
        </span>
      );
    default:
      return <span className="text-muted-foreground text-sm">—</span>;
  }
}

/** ตารางต้นทุนรายวัตถุดิบ เรียงแพง → ถูก — ดูว่าอะไรกินต้นทุนจานนี้ */
function IngredientCostTable({
  drafts,
  rows,
  saved,
  total,
}: {
  readonly drafts: IngredientDraft[];
  readonly rows: RowCost[];
  readonly saved: RecipeIngredientLine[];
  readonly total: number;
}) {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  const lines = drafts
    .map((d, i) => ({ d, r: rows[i], i }))
    .flatMap(({ d, r, i }) =>
      r?.state === "ok" ? [{ d, cost: r.line_cost, i }] : [],
    )
    .sort((a, b) => b.cost - a.cost);
  if (lines.length === 0) return null;

  return (
    <div className="pt-2">
      <EyeBrow className="mb-2">{t("ingredientCostTable")}</EyeBrow>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr className="text-muted-foreground text-left">
              <th scope="col" className="px-2 py-1.5 font-semibold">
                {t("ingredientName")}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                {tfl("qty")}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                {t("cost")}
              </th>
              <th scope="col" className="px-2 py-1.5 text-right font-semibold">
                {t("shareOfTotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map(({ d, cost, i }) => (
              <tr key={i} className="border-border/60 border-t">
                <td className="px-2 py-1.5">{d.product_label || "—"}</td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatQty(d.qty)}{" "}
                  <UnitName
                    productId={d.product_id}
                    unitId={d.ingredient_unit_id}
                    saved={saved}
                  />
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  ฿{formatCurrency(cost)}
                </td>
                <td className="text-muted-foreground px-2 py-1.5 text-right tabular-nums">
                  {total > 0 ? ((cost / total) * 100).toFixed(1) : "0.0"}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** ชื่อหน่วยสูตร — query เดียวกับ select ของแถว (cache ร่วม) สำรองด้วยชื่อที่บันทึกไว้ */
function UnitName({
  productId,
  unitId,
  saved,
}: {
  readonly productId: string;
  readonly unitId: string;
  readonly saved: RecipeIngredientLine[];
}) {
  const { data: units } = useProductIngredientUnits(productId || undefined);
  const name =
    units?.find((u) => u.id === unitId)?.name ??
    saved.find((s) => s.ingredient_unit_id === unitId)?.ingredient_unit?.name;
  return <>{name ?? ""}</>;
}
