import { lazy, Suspense, useState } from "react";
import { type Resolver } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { useBuCode } from "@/hooks/use-bu-code";
import { QUERY_KEYS } from "@/constant/query-keys";
import { toast } from "sonner";
import {
  useCreateRecipe,
  useUpdateRecipe,
  useDeleteRecipe,
} from "./use-recipe";
import type { Recipe } from "@/types/recipe";
import {
  createRecipeSchema,
  type RecipeFormValues,
  getDefaultValues,
  textToArray,
  textToObject,
  mergeAllergens,
} from "./recipe-form-schema";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { computeRecipeCost, useRecipeCostCalc } from "./use-recipe-cost-calc";
import { RecipeNotesFields } from "./recipe-notes-fields";
import { RecipeStepsFields } from "./recipe-steps-fields";
import { useSyncRecipeSteps } from "./use-recipe-steps-sync";
import { activeSteps, StepsChangedElsewhereError } from "./recipe-steps-sync";
import { useRecipeGallery } from "./use-recipe-gallery";
import { FormPageShell } from "@/components/share/form-page-shell";
import { RecipeToolbar } from "./recipe-toolbar";
import { RecipeHeroFields } from "./recipe-hero-fields";
import { RecipeGeneralFields } from "./recipe-general-fields";
import { RecipeIngredientsFields } from "./recipe-ingredients-fields";
import { useReplaceIngredients } from "./use-recipe-ingredients";
import {
  activeIngredients,
  draftToInput,
  ingredientsChanged,
} from "./recipe-ingredients-cost";
import { RecipeCostFields } from "./recipe-cost-fields";
import { useRecipeCategoryDefaults } from "./use-recipe-category-defaults";
import { RecipeComplianceFields } from "./recipe-compliance-fields";
import { recipeCommentCrud } from "./use-recipe-comments";

// sheet comment โหลดเมื่อกดเปิดครั้งแรก ไม่ต้องติดมากับหน้าฟอร์ม
const EntityCommentSheet = lazy(() =>
  import("@/components/share/entity-comment-sheet").then((m) => ({
    default: m.EntityCommentSheet,
  })),
);

export type { RecipeComputed } from "./use-recipe-cost-calc";

interface RecipeFormProps {
  readonly recipe?: Recipe;
}

const LIST_PATH = "/operation-plan/recipe";

export function RecipeForm({ recipe }: RecipeFormProps) {
  const t = useTranslations("operationPlan.recipe");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const createRecipe = useCreateRecipe();
  const updateRecipe = useUpdateRecipe();
  const deleteRecipe = useDeleteRecipe();
  const [showDelete, setShowDelete] = useState(false);
  const [showComment, setShowComment] = useState(false);
  const syncSteps = useSyncRecipeSteps();
  const replaceIngredients = useReplaceIngredients();
  const queryClient = useQueryClient();
  const buCode = useBuCode();
  const isPending =
    createRecipe.isPending ||
    updateRecipe.isPending ||
    syncSteps.isPending ||
    replaceIngredients.isPending;

  const defaultValues = getDefaultValues(recipe);

  const recipeSchema = createRecipeSchema(tv, tfl);
  const gallery = useRecipeGallery(recipe?.images);

  const f = useEntityForm<RecipeFormValues>({
    entity: recipe,
    serverFieldErrors: { RECIPE_ALREADY_EXISTS: "code" },
    resolver: zodResolver(recipeSchema) as Resolver<RecipeFormValues>,
    defaultValues,
    listPath: LIST_PATH,
    isPending,
    // รูปใน gallery ที่ยังไม่ได้อัปโหลดก็นับเป็นของที่จะหาย
    extraDirty: gallery.isDirty,
    onResetExtra: gallery.reset,
    initialMode: "edit",
  });
  const { form, isEdit, isDisabled } = f;

  const computed = useRecipeCostCalc(form);
  const categoryDefaults = useRecipeCategoryDefaults(form, isDisabled);

  const onSubmit = (values: RecipeFormValues) => {
    const payload = buildRecipePayload(values);
    const {
      files,
      manifest,
      count,
      isDirty: galleryDirty,
    } = gallery.buildPayload();

    if (isEdit && recipe) {
      // ปิด guard ตั้งแต่ก่อนยิง — save มีหลายจังหวะ (วัตถุดิบ → หัวสูตร → ขั้นตอน) ระหว่างนั้น
      // recipe ถูก refetch แล้วสถานะ dirty พลิก guard ปิดตัวเองแล้วสั่ง history.back()
      // ทับการ navigate กลับ list ของเรา (เด้งกลับมา /edit) · ปิดเองก่อน back() จะจบไปนานแล้ว
      f.setIsSubmitting(true);

      const saveHeader = (
        headerPayload: ReturnType<typeof buildRecipePayload>,
        docVersion: number,
      ) => {
        // Send the full gallery manifest only when it changed (full-sync);
        // omitting it keeps the existing images untouched.
        updateRecipe.mutate(
          {
            id: recipe.id,
            // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
            doc_version: docVersion,
            ...headerPayload,
            ...(galleryDirty ? { images: files, gallery: manifest } : {}),
          },
          {
            onSuccess: () => {
              syncSteps.mutate(
                {
                  recipeId: recipe.id,
                  original: activeSteps(recipe.preparation_steps),
                  drafts: values.preparation_steps,
                  // POST ทั้งก้อนสำเร็จแล้ว — ผูก id ให้ขั้นใหม่ในฟอร์มทันที ถ้าจังหวะ
                  // ถัดไปล้ม กด Save ซ้ำจะ PATCH ไม่ POST ซ้ำ (ไม่รีเซ็ตทั้งรายการ
                  // เพื่อไม่ทิ้งสิ่งที่ผู้ใช้พิมพ์ไว้)
                  onAdded: (ids) => {
                    let k = 0;
                    values.preparation_steps.forEach((d, i) => {
                      if (!d.step_id && ids[k]) {
                        form.setValue(
                          `preparation_steps.${i}.step_id`,
                          ids[k++],
                        );
                      }
                    });
                  },
                },
                {
                  onSuccess: () => {
                    toast.success(tt("updateSuccess", { entity: t("entity") }));
                    f.backToList();
                  },
                  onError: (err) => {
                    f.setIsSubmitting(false);
                    if (err instanceof StepsChangedElsewhereError) {
                      toast.error(t("stepsChangedElsewhere"));
                      return;
                    }
                    toast.error(t("stepsSaveFailed"), {
                      description: err.message,
                    });
                  },
                },
              );
            },
            onError: () => f.setIsSubmitting(false),
          },
        );
      };

      const savedLines = activeIngredients(recipe.ingredients);
      const recalculate = values.recalculate_ingredients;
      if (!recalculate && !ingredientsChanged(values.ingredients, savedLines)) {
        // วัตถุดิบไม่เปลี่ยน — ยอดที่ server บันทึกไว้คือของจริง ยอดบนจอเป็นผลรวมฝั่ง client
        // (อาจคลาดเศษ) ห้ามเขียนทับ · สูตรที่ไม่มีวัตถุดิบ = ช่องกรอกมือ ส่งค่าที่ผู้ใช้เห็น
        saveHeader(
          savedLines.length > 0
            ? withIngredientTotal(
                payload,
                Number(recipe.total_ingredient_cost) || 0,
              )
            : payload,
          recipe.doc_version,
        );
        return;
      }

      // วัตถุดิบก่อน — ล้ม = หยุด ไม่บันทึกหัว (ไม่มีตัวเลขหัวที่ไม่ตรงกับบรรทัด)
      replaceIngredients.mutate(
        {
          recipeId: recipe.id,
          items: values.ingredients.map(draftToInput),
          recalculate,
        },
        {
          onSuccess: (res) => {
            // บันทึกแล้ว — กด Save ซ้ำ (หัวล้ม) ต้องคงราคาที่เพิ่งบันทึก ไม่คำนวณใหม่อีกรอบ
            form.setValue("recalculate_ingredients", false);
            // ยังมีวัตถุดิบ หรือเพิ่งลบวัตถุดิบที่เคยบันทึกไว้จนหมด = ยอดมาจาก server
            // (ลบหมดได้ 0 — ไม่งั้นยอดของบรรทัดที่ลบไปแล้วค้างอยู่ในช่อง แล้วถูกเขียนกลับ)
            // สูตรที่ไม่เคยมีวัตถุดิบเลย = ช่องกรอกมือ ใช้ค่าที่ผู้ใช้เห็น
            const hadSavedIngredients = savedLines.length > 0;
            const total =
              values.ingredients.length > 0 || hadSavedIngredients
                ? res.total_ingredient_cost
                : values.total_ingredient_cost;
            form.setValue("total_ingredient_cost", total);
            // PUT แตะหัวสูตร (total_ingredient_cost) — ถ้า backend ขยับ doc_version
            // ให้ใช้ของที่ refetch มาแล้ว (onSettled ของ PUT รอ refetch จบก่อนถึงตรงนี้)
            const fresh = queryClient.getQueryData<Recipe>([
              QUERY_KEYS.RECIPES,
              buCode,
              recipe.id,
            ]);
            saveHeader(
              withIngredientTotal(payload, total),
              fresh?.doc_version ?? recipe.doc_version,
            );
          },
          onError: (err) => {
            f.setIsSubmitting(false);
            toast.error(t("ingredientsSaveFailed"), {
              description: err.message,
            });
          },
        },
      );
    } else {
      createRecipe.mutate(
        {
          ...payload,
          ...(count > 0 ? { images: files, gallery: manifest } : {}),
        },
        {
          onSuccess: () => {
            toast.success(tt("createSuccess", { entity: t("entity") }));
            f.backToList();
          },
        },
      );
    }
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const handleDelete = () => {
    if (!recipe) return;
    deleteRecipe.mutate(recipe.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <RecipeToolbar
          form={form}
          mode={f.mode}
          isPending={isPending}
          isDeleting={deleteRecipe.isPending}
          onBack={f.handleBack}
          onEdit={f.handleEdit}
          onCancel={f.handleCancel}
          onDelete={recipe ? () => setShowDelete(true) : undefined}
          activity={recipe && { id: recipe.id, label: recipe.code }}
          onComment={recipe ? () => setShowComment(true) : undefined}
        />
      }
    >
      {/* flatten หน้าเดียว: hero บนสุด แล้วแต่ละ section เป็น 2-col แบบ company
          profile (title/desc ซ้าย · เนื้อหาขวา) stack ต่อกันด้วยเส้นคั่น */}
      <form
        id="recipe-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <RecipeHeroFields
          form={form}
          isDisabled={isDisabled}
          computed={computed}
          gallery={gallery}
        />
        <RecipeGeneralFields
          form={form}
          isDisabled={isDisabled}
          recipe={recipe}
        />
        <RecipeIngredientsFields
          form={form}
          isDisabled={isDisabled}
          recipe={recipe}
          computed={computed}
        />
        <RecipeStepsFields
          form={form}
          isDisabled={isDisabled}
          isNew={!recipe}
        />
        <RecipeComplianceFields form={form} isDisabled={isDisabled} />
        <RecipeNotesFields form={form} isDisabled={isDisabled} />
        <RecipeCostFields
          form={form}
          isDisabled={isDisabled}
          computed={computed}
          categoryDefaults={categoryDefaults}
        />
      </form>

      {recipe && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteRecipe.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: recipe.name })}
          isPending={deleteRecipe.isPending}
          onConfirm={handleDelete}
        />
      )}

      {recipe && (
        <Suspense fallback={null}>
          <EntityCommentSheet
            crud={recipeCommentCrud}
            entityId={recipe.id}
            open={showComment}
            onOpenChange={setShowComment}
          />
        </Suspense>
      )}

      <DiscardDialog {...f.discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={f.navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) f.navGuard.cancel();
        }}
        onConfirm={f.navGuard.confirm}
        onCancel={f.navGuard.cancel}
        variant="warning"
      />
    </FormPageShell>
  );
}

function buildRecipePayload(values: RecipeFormValues) {
  return {
    code: values.code,
    name: values.name,
    description: values.description || null,
    note: values.note || null,
    status: values.status,
    difficulty: values.difficulty,
    cuisine_id: values.cuisine_id!,
    category_id: values.category_id!,
    prep_time: values.prep_time,
    cook_time: values.cook_time,
    base_yield: values.base_yield,
    base_yield_unit: values.base_yield_unit!,
    total_ingredient_cost: values.total_ingredient_cost,
    labor_cost: values.labor_cost,
    overhead_cost: values.overhead_cost,
    cost_per_portion: values.cost_per_portion,
    selling_price: values.selling_price,
    suggested_price: values.suggested_price,
    gross_margin: values.gross_margin,
    gross_margin_percentage: values.gross_margin_percentage,
    actual_food_cost_percentage: values.actual_food_cost_percentage,
    target_food_cost_percentage: values.target_food_cost_percentage,
    max_food_cost_percentage: values.max_food_cost_percentage || null,
    plating_instructions: values.plating_instructions || null,
    storage_instructions: values.storage_instructions || null,
    labor_cost_percentage: values.labor_cost_percentage,
    overhead_percentage: values.overhead_percentage,
    allergens: mergeAllergens(values.allergens),
    tags: textToArray(values.tags) ?? [],
    carbon_footprint: values.carbon_footprint,
    deduct_from_stock: values.deduct_from_stock,
    default_variant_id: values.default_variant_id || null,
    info: textToObject(values.info),
    dimension: textToObject(values.dimension),
    is_active: values.is_active,
  };
}

/** ยอดวัตถุดิบจาก server แล้วคิดตัวเลขต่อจานใหม่ด้วยสมการเดียวกับหน้าจอ */
function withIngredientTotal(
  payload: ReturnType<typeof buildRecipePayload>,
  total: number,
): ReturnType<typeof buildRecipePayload> {
  const c = computeRecipeCost({
    ingredientCost: total,
    laborCost: payload.labor_cost,
    overheadCost: payload.overhead_cost,
    baseYield: payload.base_yield,
    sellingPrice: payload.selling_price,
    targetFoodCostPct: payload.target_food_cost_percentage,
    maxFoodCostPct: payload.max_food_cost_percentage,
  });
  return {
    ...payload,
    total_ingredient_cost: total,
    cost_per_portion: c.costPerPortion,
    gross_margin: c.grossMargin,
    gross_margin_percentage: c.grossMarginPct,
    actual_food_cost_percentage: c.actualFoodCostPct,
    labor_cost_percentage: c.laborCostPct,
    overhead_percentage: c.overheadPct,
    suggested_price: c.suggestedPrice,
  };
}
