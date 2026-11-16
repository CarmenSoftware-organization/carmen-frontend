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
import {
  Calculator,
  ChefHat,
  Package,
  Plus,
  RotateCcw,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { FieldError, FieldInput } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CompactSection } from "@/components/share/compact-section";
import { EyeBrow } from "@/components/ui/eye-brow";
import EmptyComponent from "@/components/empty-component";
import { LookupProduct } from "@/components/lookup/lookup-product";
import { LookupRecipe } from "@/components/lookup/lookup-recipe";
import { useUnitById } from "@/hooks/use-unit";
import { getUserErrorMessage } from "@/lib/error-message";
import {
  productIngredientUnitsQuery,
  useProductIngredientUnits,
} from "@/hooks/use-product-units";
import { useBuCode } from "@/hooks/use-bu-code";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
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
  decimalsFor,
  formatQty,
  formatQtyFixed,
  inventoryEquivalentOf,
  manualCostOf,
  pairCostsFrom,
  isDraftComplete,
  pairKey,
  parsePairKey,
  pendingPairs,
  refOf,
  resolveRowCosts,
  round5,
  type IngredientDraft,
  type PairCost,
  type RowCost,
} from "./recipe-ingredients-cost";
import { usePreviewIngredientCosts } from "./use-recipe-ingredients";
import { RecipeIngredientsRecalcDialog } from "./recipe-ingredients-recalc-dialog";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
      key:
        | "costSourceLastAverage"
        | "costSourceStandard"
        | "costSourceNone"
        | "costSourceRecipe"
        | "costSourceManual";
      variant: "warning-light" | "info-light" | "destructive-light";
    }
  >
> = {
  last_average: { key: "costSourceLastAverage", variant: "warning-light" },
  standard: { key: "costSourceStandard", variant: "info-light" },
  none: { key: "costSourceNone", variant: "destructive-light" },
  recipe: { key: "costSourceRecipe", variant: "info-light" },
  manual: { key: "costSourceManual", variant: "info-light" },
};

/**
 * ตารางวัตถุดิบ — หัวตารางกับทุกแถวใช้ grid ชุดเดียวกัน คอลัมน์จึงตรงกันโดยไม่ต้องเป็น <table>
 * (ช่องในแถวเป็น lookup/select/input ที่ต้องยืดหดตามกล่อง)
 *
 * ตัดสินจากความกว้างของกล่องรายการเอง (`@container/ing`) ไม่ใช่ของจอ:
 * - กว้าง 42rem ขึ้นไป = ตาราง ทุกช่องของวัตถุดิบหนึ่งตัวอยู่แถวเดียว หน่วยอยู่ในคอลัมน์ของตัวเองเสมอ
 *   (เดิมช่วง 36–56rem ชื่อสินค้ากินทั้งแถวแล้วหน่วย/จำนวนตกลงไปบรรทัดล่าง — ผู้ใช้สั่งแก้ 2026-11-16)
 * - แคบกว่านั้น (มือถือ) = การ์ดต่อวัตถุดิบ มีป้ายกำกับทุกช่อง — ตาราง 7 คอลัมน์บีบลงจอ 390px ไม่ได้
 * - คอลัมน์ตัวเลขกว้างขึ้นเป็นขั้นที่ 48rem และ 56rem ส่วนที่เหลือเป็นของชื่อวัตถุดิบเสมอ
 *   (ขั้นแคบสุด 42–48rem: ช่องในเซลล์ลด padding และซ่อนลูกศรของ select หน่วย ให้ "GRAM" ไม่โดนตัด)
 *
 * คอลัมน์: ประเภท · ชื่อ · หน่วย · จำนวน · จำนวนในหน่วยสต๊อก · % เสีย · ต้นทุนบรรทัด · ลบ
 * (จำนวนในหน่วยสต๊อกเป็นคอลัมน์ของตัวเอง — ผู้ใช้สั่ง 2026-11-16 · ขั้นแคบสุดแสดงแค่ผลลัพธ์ "0.4 KG"
 *  อัตราแปลง "(1 KG = 1000 GRAM)" อยู่ใน title เพราะคอลัมน์ 5.5rem ใส่ไม่พอ ตั้งแต่ 48rem จึงแสดงเป็นบรรทัดที่สอง)
 * (ไม่มีคอลัมน์ต้นทุน/หน่วย — ผู้ใช้สั่งซ่อน 2026-11-16: ดูและกรอกเป็นต้นทุนของจำนวนนั้นทั้งบรรทัดพอ)
 */
const ING_GRID =
  "grid grid-cols-2 gap-x-1.5 gap-y-1 @2xl/ing:grid-cols-[4.25rem_minmax(0,1fr)_4.5rem_4rem_5.5rem_3rem_5.25rem_1.75rem] @3xl/ing:grid-cols-[4.25rem_minmax(0,1fr)_5.5rem_4.5rem_8rem_3.75rem_6rem_1.75rem] @4xl/ing:grid-cols-[4.25rem_minmax(0,1fr)_7rem_5.5rem_8.5rem_4.5rem_7rem_1.75rem]";

/**
 * ช่องกรอกในตาราง — ดูเป็นข้อความในเซลล์ กดแล้วจึงเป็นช่องกรอก (ผู้ใช้สั่ง: "คล้ายตาราง แล้วกดเพื่อใส่ค่า")
 * โหมดการ์ด (กล่องแคบ) ยังเป็นช่องมีกรอบตามปกติ — บนจอสัมผัสไม่มี hover บอกว่าช่องไหนกดได้
 */
const CELL_INPUT =
  "@2xl/ing:px-1.5 @3xl/ing:px-2.5 @2xl/ing:border-transparent @2xl/ing:bg-transparent @2xl/ing:dark:bg-transparent @2xl/ing:shadow-none @2xl/ing:hover:border-input @2xl/ing:hover:bg-background @2xl/ing:focus-visible:border-ring @2xl/ing:focus-visible:bg-background @2xl/ing:data-[state=open]:border-ring @2xl/ing:data-[state=open]:bg-background aria-invalid:border-destructive!";

/** ป้ายกำกับของช่องในโหมดการ์ด — โหมดตารางใช้หัวตารางแทน */
const CARD_LABEL = "text-muted-foreground mb-0.5 block text-xs @2xl/ing:hidden";

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
  // แถวสูตร (r:) หน่วย 1:1 กับหน่วยผลผลิต ไม่ต้องใช้อัตราส่วน — มีแต่แถวสินค้า
  productIds.forEach((pid, idx) => {
    for (const u of unitQueries[idx]?.data ?? []) {
      ratios.set(pairKey(`p:${pid}`, u.id), Number(u.conversion));
    }
  });

  const rows = resolveRowCosts(drafts, saved, current, recalculate, ratios);
  const total = round5(
    rows.reduce((s, r) => (r.state === "ok" ? s + r.line_cost : s), 0),
  );
  // ทศนิยมของคอลัมน์ต้นทุนเท่ากันทุกแถว: 2 ตำแหน่ง เว้นแต่มีแถวที่ผู้ใช้พิมพ์ละเอียดกว่านั้น
  // (ต้นทุนที่ระบบคิดปัดแสดง 2 ตำแหน่งเสมอ — ไม่ดันทั้งคอลัมน์เป็น 5 ตำแหน่งเพราะเศษของการคูณ)
  const costDecimals = Math.max(
    2,
    decimalsFor(drafts.map((d) => manualCostOf(d))),
  );
  // ทศนิยมของคอลัมน์ "ในหน่วยสต๊อก" เท่ากันทุกแถว = ของแถวที่ละเอียดที่สุด (ค่าเดียวกับที่แต่ละแถวแสดง)
  const inventoryDecimals = decimalsFor(
    drafts.map((d, i) => {
      if (d.ingredient_type === "recipe" || !d.ingredient_unit_id) return null;
      const r = rows[i];
      return inventoryEquivalentOf(
        d.qty,
        ratios.get(pairKey(refOf(d), d.ingredient_unit_id)),
        r?.state === "ok" ? r.unit : undefined,
      );
    }),
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
  const needKey = pendingPairs(drafts, rows).join(",");
  const debouncedNeedKey = useDebouncedValue(needKey, 400);
  const inFlight = useRef(new Set<string>());
  const recipeId = recipe?.id;
  const tErr = useTranslations("errors");
  const fallbackError = t("costPreviewFailed");
  const requestPair = (key: string) => {
    if (!recipeId || inFlight.current.has(key)) return;
    inFlight.current.add(key);
    previewCosts({ recipeId, items: [parsePairKey(key)] })
      .then((res) => {
        const hit = pairCostsFrom(res.items).find(([k]) => k === key);
        setCurrent((prev) =>
          new Map(prev).set(
            key,
            hit ? hit[1] : { ok: false, message: fallbackError },
          ),
        );
      })
      .catch((err: unknown) => {
        // ข้อความจาก catalog ของ server (เช่น RECIPE_SUB_RECIPE_CYCLE) ขึ้นที่บรรทัดนั้น
        const message = getUserErrorMessage(err, tErr) || fallbackError;
        setCurrent((prev) => new Map(prev).set(key, { ok: false, message }));
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
    drafts.length > 0 && drafts.every((d) => isDraftComplete(d) && d.qty > 0);
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
    <CompactSection
      first
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
        // การ์ดกว้าง (80rem+) = บรรทัดวัตถุดิบซ้าย ตารางต้นทุนขวา — ไม่ยืดบรรทัดเต็มจอแล้วต้องเลื่อนลงไปหาตาราง
        <div className="@container">
          <div className="grid gap-x-6 gap-y-3 @7xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @7xl:items-start">
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

              <div className="@container/ing">
                <div className="bg-card overflow-hidden rounded-md @2xl/ing:border">
                  <div
                    className={cn(
                      ING_GRID,
                      "bg-muted/60 text-muted-foreground hidden px-2 py-1.5 text-xs font-semibold @2xl/ing:grid",
                    )}
                  >
                    <span className="col-span-2">{t("ingredientName")}</span>
                    <span className="px-2">{tfl("unit")}</span>
                    <span className="px-2 text-right">{tfl("qty")}</span>
                    <span className="px-2 text-right">
                      {t("inventoryQtyCol")}
                    </span>
                    <span className="px-1 text-right">{t("wastagePct")}</span>
                    <span className="text-right">{t("cost")}</span>
                    <span />
                  </div>
                  <div className="space-y-2 @2xl/ing:space-y-0">
                    {fields.map((field, i) => (
                      <IngredientRow
                        key={field.key}
                        form={form}
                        index={i}
                        cost={rows[i] ?? { state: "incomplete" }}
                        inventoryDecimals={inventoryDecimals}
                        costDecimals={costDecimals}
                        saved={saved}
                        recipeId={recipeId}
                        isDisabled={isDisabled}
                        onRemove={() => remove(i)}
                        onRetryCost={() => {
                          const d = drafts[i];
                          if (d && isDraftComplete(d))
                            retryPair(pairKey(refOf(d), d.ingredient_unit_id));
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

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
            </div>

            <IngredientCostTable
              drafts={drafts}
              rows={rows}
              saved={saved}
              total={total}
            />
          </div>
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
    </CompactSection>
  );
}

function IngredientRow({
  form,
  index: i,
  cost,
  inventoryDecimals,
  costDecimals,
  saved,
  recipeId,
  isDisabled,
  onRemove,
  onRetryCost,
}: {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly index: number;
  readonly cost: RowCost;
  /** ทศนิยมของคอลัมน์ "ในหน่วยสต๊อก" — เท่ากันทุกแถว */
  readonly inventoryDecimals: number;
  /** ทศนิยมของคอลัมน์ต้นทุน — เท่ากันทุกแถว */
  readonly costDecimals: number;
  readonly saved: RecipeIngredientLine[];
  /** id ของสูตรที่กำลังแก้ — ห้ามเลือกตัวเองเป็นสูตรย่อย */
  readonly recipeId?: string;
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
  const [ingredientType, productId, subRecipeId, productLabel, unitId, qty] =
    useWatch({
      control: form.control,
      name: [
        `ingredients.${i}.ingredient_type`,
        `ingredients.${i}.product_id`,
        `ingredients.${i}.sub_recipe_id`,
        `ingredients.${i}.product_label`,
        `ingredients.${i}.ingredient_unit_id`,
        `ingredients.${i}.qty`,
      ],
    });
  const isRecipe = ingredientType === "recipe";
  // หน่วยเก่าที่ไม่ใช่ UUID (เช่น "PCS") ห้ามยิง useUnitById — ถือว่าสูตรฐานยังไม่มีหน่วยผลผลิต
  const recipeUnitValid = isRecipe && !!unitId && UUID_RE.test(unitId);
  const { data: recipeUnit } = useUnitById(
    recipeUnitValid ? unitId : undefined,
  );
  const recipeMissingUnit = isRecipe && !!subRecipeId && !recipeUnitValid;
  const excludeSelf = new Set(recipeId ? [recipeId] : []);
  const opts = { shouldDirty: true, shouldValidate: isSubmitted };
  // เปลี่ยนประเภท = ล้างตัวอ้างอิง ชื่อ และหน่วยของแถวทั้งหมด (หน่วยของสินค้ากับสูตรไม่เกี่ยวกัน)
  const changeType = (next: "product" | "recipe") => {
    if (next === (isRecipe ? "recipe" : "product")) return;
    form.setValue(`ingredients.${i}.ingredient_type`, next, opts);
    form.setValue(`ingredients.${i}.product_id`, "", opts);
    form.setValue(`ingredients.${i}.sub_recipe_id`, "", opts);
    form.setValue(`ingredients.${i}.product_label`, "", opts);
    form.setValue(`ingredients.${i}.ingredient_unit_id`, "", opts);
  };
  const { data: units } = useProductIngredientUnits(
    !isRecipe && productId ? productId : undefined,
  );
  const firstUnitId = units?.[0]?.id;

  // เปลี่ยนสินค้าแล้วหน่วยว่าง — ตั้งเป็นหน่วยแรก (หน่วย inventory) ให้เลย
  useEffect(() => {
    if (!isRecipe && productId && !unitId && firstUnitId) {
      form.setValue(`ingredients.${i}.ingredient_unit_id`, firstUnitId, {
        shouldDirty: true,
        shouldValidate: isSubmitted,
      });
    }
  }, [isRecipe, productId, unitId, firstUnitId, i, form, isSubmitted]);

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
  const isManual = cost.state === "ok" && cost.unit.cost_source === "manual";

  // จำนวนในหน่วย inventory ใต้ช่องจำนวน — ทุกแถวสินค้าที่เลือกหน่วยและกรอกจำนวนแล้ว
  // (เลือกหน่วย inventory เอง = โชว์ 1:1 ให้ช่องอยู่ที่เดิมทุกแถว)
  // หาหน่วย inventory: รายการ ingredient-units เรียงตามชื่อ ไม่ได้เอาหน่วย inventory ขึ้นก่อน —
  // ใช้ inventory_unit_id ของแถวที่บันทึกไว้ของสินค้าเดียวกันก่อน ไม่มีค่อยใช้หน่วยที่ conversion = 1
  // (backend ไม่ให้หน่วยวัตถุดิบซ้ำกับหน่วย inventory จึงมีหน่วย inventory ตัวเดียวที่เป็น 1 เสมอ)
  const savedInventoryUnitId = saved.find(
    (s) => s.product_id === productId,
  )?.inventory_unit_id;
  const inventoryUnit = isRecipe
    ? undefined
    : (units?.find((u) => u.id === savedInventoryUnitId) ??
      units?.find((u) => Number(u.conversion) === 1));
  const unitRatio = units?.find((u) => u.id === unitId)?.conversion;
  const inventoryQty =
    inventoryUnit && unitId
      ? inventoryEquivalentOf(
          qty,
          unitRatio,
          cost.state === "ok" ? cost.unit : undefined,
        )
      : undefined;

  const unitName = unitOptions.find((u) => u.id === unitId)?.name ?? "";
  const removeButton = (className: string) =>
    !isDisabled && (
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={t("removeIngredient")}
        title={t("removeIngredient")}
        onClick={onRemove}
        className={className}
      >
        <Trash2 />
      </Button>
    );

  return (
    <div
      role="group"
      aria-label={productLabel || t("ingredientName")}
      className={cn(
        ING_GRID,
        "rounded-md border p-3 @2xl/ing:items-start @2xl/ing:rounded-none @2xl/ing:border-x-0 @2xl/ing:border-t @2xl/ing:border-b-0 @2xl/ing:px-2 @2xl/ing:py-1.5",
      )}
    >
      {/* ประเภท + ชื่อ (+ หมายเหตุใต้ชื่อ) */}
      <div className="col-span-2 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-1.5 gap-y-1 @2xl/ing:grid-cols-subgrid">
        <div
          role="group"
          aria-label={t("ingredientType")}
          className="flex shrink-0 items-center gap-1 @2xl/ing:h-8"
        >
          <Toggle
            variant="outline"
            size="sm"
            pressed={!isRecipe}
            disabled={isDisabled}
            aria-label={t("ingredientTypeProduct")}
            title={t("ingredientTypeProduct")}
            onPressedChange={() => changeType("product")}
          >
            <Package aria-hidden="true" />
          </Toggle>
          <Toggle
            variant="outline"
            size="sm"
            pressed={isRecipe}
            disabled={isDisabled}
            aria-label={t("ingredientTypeRecipe")}
            title={t("ingredientTypeRecipe")}
            onPressedChange={() => changeType("recipe")}
          >
            <ChefHat aria-hidden="true" />
          </Toggle>
        </div>
        <div className="min-w-0">
          {isRecipe ? (
            <LookupRecipe
              value={subRecipeId}
              defaultLabel={productLabel || undefined}
              size="sm"
              className={cn("w-full min-w-0", CELL_INPUT)}
              disabled={isDisabled}
              placeholder={t("ingredientName")}
              excludeIds={excludeSelf}
              error={rowErrors?.sub_recipe_id?.message}
              onValueChange={(id) => {
                if (id === subRecipeId) return;
                form.setValue(`ingredients.${i}.sub_recipe_id`, id, opts);
              }}
              onItemChange={(r) => {
                form.setValue(
                  `ingredients.${i}.product_label`,
                  r.name ?? r.code ?? "",
                  opts,
                );
                // หน่วยของสูตรคือหน่วยผลผลิตเสมอ — ว่างแปลว่าแถวยังไม่ครบ (server ก็ปฏิเสธ)
                form.setValue(
                  `ingredients.${i}.ingredient_unit_id`,
                  r.base_yield_unit ?? "",
                  opts,
                );
              }}
            />
          ) : (
            <LookupProduct
              value={productId}
              defaultLabel={productLabel || undefined}
              size="sm"
              // ปุ่ม combobox กว้างตามชื่อสินค้า (shrink-0) — ชื่อยาวล้นทับช่องหน่วย
              className={cn("w-full min-w-0", CELL_INPUT)}
              disabled={isDisabled}
              placeholder={t("ingredientName")}
              error={rowErrors?.product_id?.message}
              onValueChange={(id, item) => {
                if (id === productId) return;
                form.setValue(`ingredients.${i}.product_id`, id, opts);
                form.setValue(
                  `ingredients.${i}.product_label`,
                  item?.name ?? item?.code ?? "",
                  opts,
                );
                form.setValue(`ingredients.${i}.ingredient_unit_id`, "", opts);
              }}
            />
          )}
        </div>
        {removeButton("@2xl/ing:hidden")}
        <div className="col-span-full min-w-0 @2xl/ing:col-span-1 @2xl/ing:col-start-2">
          {isRecipe && subRecipeId && (
            <a
              href={`/operation-plan/recipe/${subRecipeId}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary inline-block px-2 text-xs underline-offset-2 hover:underline"
            >
              {t("openSubRecipe")}
            </a>
          )}
          <FieldInput
            aria-label={t("ingredientNote")}
            placeholder={t("ingredientNote")}
            size="xs"
            maxLength={500}
            disabled={isDisabled}
            className={cn("text-muted-foreground text-xs", CELL_INPUT)}
            error={rowErrors?.note?.message}
            {...form.register(`ingredients.${i}.note`)}
          />
        </div>
      </div>

      {/* หน่วย + จำนวน + จำนวนในหน่วย inventory (ตาราง = คอลัมน์ที่สาม · การ์ด = บรรทัดใต้สองช่องนี้) */}
      <div className="col-span-2 grid grid-cols-2 gap-x-1.5 gap-y-1 @2xl/ing:col-span-3 @2xl/ing:grid-cols-subgrid">
        <div className="min-w-0">
          <span className={CARD_LABEL}>{tfl("unit")}</span>
          {isRecipe ? (
            <div
              className="text-muted-foreground flex h-8 items-center truncate px-2 text-sm"
              aria-label={tfl("unit")}
            >
              {recipeUnit?.name ?? savedUnit?.name ?? "—"}
            </div>
          ) : (
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
                    className={cn(
                      "w-full min-w-0 @2xl/ing:[&>svg]:hidden @3xl/ing:[&>svg]:block",
                      CELL_INPUT,
                    )}
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
          )}
          {recipeMissingUnit ? (
            <p className="text-destructive mt-1 text-xs" role="alert">
              {t("subRecipeNoYieldUnit")}
            </p>
          ) : (
            <FieldError errors={[rowErrors?.ingredient_unit_id]} />
          )}
        </div>
        <div className="min-w-0">
          <span className={CARD_LABEL}>{tfl("qty")}</span>
          <FieldInput
            aria-label={tfl("qty")}
            type="number"
            inputMode="decimal"
            min={0}
            step="any"
            size="sm"
            disabled={isDisabled}
            className={cn("text-right tabular-nums", CELL_INPUT)}
            error={rowErrors?.qty?.message}
            errorIconAlign="left"
            {...form.register(`ingredients.${i}.qty`, numberInput)}
          />
        </div>
        {inventoryUnit && inventoryQty !== undefined ? (
          <p
            aria-label={t("inventoryQtyLabel")}
            title={`${formatQtyFixed(inventoryQty, inventoryDecimals)} ${inventoryUnit.name} ${t(
              "inventoryQtyRatio",
              {
                inventoryUnit: inventoryUnit.name,
                ratio: formatQty(unitRatio),
                unit: unitName,
              },
            )}`}
            className="text-muted-foreground col-span-2 min-w-0 px-2 text-right text-xs break-words tabular-nums @2xl/ing:col-span-1 @2xl/ing:pt-2"
          >
            <span className="text-foreground font-medium @2xl/ing:hidden">
              {t("inventoryQtyValue", {
                qty: formatQtyFixed(inventoryQty, inventoryDecimals),
                unit: inventoryUnit.name,
              })}
            </span>
            <span className="text-foreground hidden font-medium @2xl/ing:block">
              {formatQtyFixed(inventoryQty, inventoryDecimals)}{" "}
              {inventoryUnit.name}
            </span>{" "}
            <span className="text-micro @2xl/ing:hidden @3xl/ing:block">
              {t("inventoryQtyRatio", {
                inventoryUnit: inventoryUnit.name,
                ratio: formatQty(unitRatio),
                unit: unitName,
              })}
            </span>
          </p>
        ) : (
          // ตารางต้องมีเซลล์ครบทุกคอลัมน์ — แถวสูตรย่อย/ยังไม่เลือกหน่วยไม่มีค่าให้แสดง
          <span className="hidden @2xl/ing:block" aria-hidden="true" />
        )}
      </div>

      {/* % เสีย + ต้นทุนบรรทัด (กรอกเองได้) — ที่มาของต้นทุนอยู่ใต้สองช่องนี้ (ป้ายกว้างกว่าคอลัมน์ต้นทุนช่องเดียว) */}
      <div className="contents @2xl/ing:col-span-2 @2xl/ing:grid @2xl/ing:grid-cols-subgrid @2xl/ing:gap-y-1">
        <div className="relative min-w-0">
          <span className={CARD_LABEL}>{t("wastagePct")}</span>
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
            className={cn("text-right tabular-nums", CELL_INPUT)}
            error={rowErrors?.wastage_percentage?.message}
            errorIconAlign="left"
            {...form.register(
              `ingredients.${i}.wastage_percentage`,
              numberInput,
            )}
          />
        </div>
        <div className="min-w-0">
          <span className={CARD_LABEL}>{t("lineCost")}</span>
          <LineCostInput
            form={form}
            index={i}
            auto={cost.state === "ok" ? cost.line_cost : undefined}
            decimals={costDecimals}
            isDisabled={isDisabled || cost.state === "incomplete"}
            error={rowErrors?.line_cost?.message}
          />
        </div>
        {(badge || cost.state === "pending" || cost.state === "error") && (
          <div className="col-span-2 flex min-w-0 flex-wrap items-center justify-end gap-x-1.5 gap-y-0.5">
            {(cost.state === "pending" || cost.state === "error") && (
              <LineCostValue cost={cost} onRetry={onRetryCost} />
            )}
            {badge && (
              <Badge variant={badge.variant} size="xs">
                {t(badge.key)}
              </Badge>
            )}
            {isManual && !isDisabled && (
              <button
                type="button"
                title={t("resetManualCost")}
                aria-label={t("resetManualCost")}
                onClick={() =>
                  form.setValue(`ingredients.${i}.line_cost`, null, opts)
                }
                className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 rounded-sm outline-none focus-visible:ring-2"
              >
                <RotateCcw className="size-3" aria-hidden="true" />
              </button>
            )}
          </div>
        )}
      </div>

      {removeButton("hidden justify-self-end @2xl/ing:inline-flex")}
    </div>
  );
}

/**
 * ช่องต้นทุนของบรรทัด — ปกติแสดงต้นทุนที่ระบบคิด (จำนวน × ต้นทุนต่อหน่วย + ของเสีย)
 * พิมพ์ทับ = กำหนดเอง: "จำนวนนี้ราคาเท่านี้" เช่น 400 GRAM = 20 (`line_cost` ของแถว ส่งไปกับ PUT →
 * server เก็บค่านั้นตรง ๆ แล้วหารย้อนเป็นต้นทุนต่อหน่วยเอง ไม่แสดงบนจอ) · ลบจนว่าง = กลับไปใช้ของระบบ
 * ผู้ใช้สั่ง 2026-11-16: ช่องที่กรอกเองคือต้นทุนรวมของจำนวนนั้น ไม่ใช่ต้นทุนต่อหน่วย
 *
 * ระหว่างพิมพ์เก็บข้อความไว้ในช่องเอง — ผูกค่าตัวเลขจากฟอร์มตรง ๆ แล้ว "12." จะถูกเขียนกลับเป็น "12"
 */
function LineCostInput({
  form,
  index: i,
  auto,
  decimals,
  isDisabled,
  error,
}: {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly index: number;
  /** ทศนิยมที่แสดงตอนไม่ได้พิมพ์ — ค่าเดียวกันทั้งคอลัมน์ ("20.00" ไม่ใช่ "20") */
  readonly decimals: number;
  /** ต้นทุนบรรทัดที่แถวใช้อยู่ตอนนี้ — undefined = ยังไม่รู้ (แถวไม่ครบ/กำลังถาม) */
  readonly auto: number | undefined;
  readonly isDisabled: boolean;
  readonly error?: string;
}) {
  const t = useTranslations("operationPlan.recipe");
  const { isSubmitted } = useFormState({ control: form.control });
  const stored = useWatch({
    control: form.control,
    name: `ingredients.${i}.line_cost`,
  });
  const manual = manualCostOf({ line_cost: stored });
  const [typing, setTyping] = useState<string | null>(null);
  // ไม่มีตัวคั่นหลักพัน — ช่อง type=number รับไม่ได้
  const resting = formatQtyFixed(manual ?? auto, decimals);

  return (
    <FieldInput
      aria-label={t("lineCost")}
      type="number"
      inputMode="decimal"
      min={0}
      step="any"
      size="sm"
      disabled={isDisabled}
      className={cn("text-right font-semibold tabular-nums", CELL_INPUT)}
      error={error}
      errorIconAlign="left"
      value={typing ?? resting}
      onFocus={(e) => {
        setTyping(resting);
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const text = e.target.value;
        setTyping(text);
        const n = Number(text);
        // ว่าง = เลิกกำหนดเอง · พิมพ์ค่าเดิมของระบบซ้ำก็นับเป็นกำหนดเอง (ผู้ใช้ตั้งใจล็อกราคานี้)
        form.setValue(
          `ingredients.${i}.line_cost`,
          text.trim() === "" || !Number.isFinite(n) ? null : n,
          { shouldDirty: true, shouldValidate: isSubmitted },
        );
      }}
      onBlur={() => setTyping(null)}
    />
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
  // ทศนิยมของคอลัมน์จำนวนเท่ากันทุกแถว
  const qtyDecimals = decimalsFor(lines.map(({ d }) => d.qty));

  return (
    <div className="pt-2 @7xl:pt-0">
      <EyeBrow className="mb-2">{t("ingredientCostTable")}</EyeBrow>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="bg-muted/60">
            <tr className="text-muted-foreground text-left">
              <th
                scope="col"
                className="w-px py-1.5 pr-1 pl-2 text-right font-semibold"
              >
                #
              </th>
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
            {lines.map(({ d, cost, i }, order) => (
              <tr key={i} className="border-border/60 border-t">
                {/* ลำดับตามที่แสดง (แพง → ถูก) — ผู้ใช้สั่งใส่เลข 1, 2, 3 … 2026-11-16 */}
                <td className="text-muted-foreground w-px py-1.5 pr-1 pl-2 text-right tabular-nums">
                  {order + 1}
                </td>
                <td className="px-2 py-1.5">
                  {d.product_label || "—"}
                  {d.ingredient_type === "recipe" && (
                    <Badge variant="info-light" size="xs" className="ml-1.5">
                      {t("subRecipeBadge")}
                    </Badge>
                  )}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums">
                  {formatQtyFixed(d.qty, qtyDecimals)}{" "}
                  <UnitName
                    productId={
                      d.ingredient_type === "recipe" ? "" : d.product_id
                    }
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
  // แถวสูตรไม่มีรายการหน่วยของสินค้า — ใช้ชื่อหน่วยผลผลิตตาม id
  const { data: unit } = useUnitById(
    !productId && unitId && UUID_RE.test(unitId) ? unitId : undefined,
  );
  const name =
    units?.find((u) => u.id === unitId)?.name ??
    unit?.name ??
    saved.find((s) => s.ingredient_unit_id === unitId)?.ingredient_unit?.name;
  return <>{name ?? ""}</>;
}
