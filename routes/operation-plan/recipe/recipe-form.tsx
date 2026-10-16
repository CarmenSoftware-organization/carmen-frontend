import { lazy, Suspense, useState } from "react";
import { type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
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
import { useRecipeCostCalc } from "./use-recipe-cost-calc";
import { RecipeNotesFields } from "./recipe-notes-fields";
import { RecipeStepsFields } from "./recipe-steps-fields";
import { useSyncRecipeSteps } from "./use-recipe-steps-sync";
import { activeSteps } from "./recipe-steps-sync";
import { useRecipeGallery } from "./use-recipe-gallery";
import { FormPageShell } from "@/components/share/form-page-shell";
import { RecipeToolbar } from "./recipe-toolbar";
import { RecipeHeroFields } from "./recipe-hero-fields";
import { RecipeGeneralFields } from "./recipe-general-fields";
import {
  RecipeIngredientsFields,
  type RecipeIngredient,
} from "./recipe-ingredients-fields";
import { RecipeCostFields } from "./recipe-cost-fields";
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
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const syncSteps = useSyncRecipeSteps();
  const isPending =
    createRecipe.isPending || updateRecipe.isPending || syncSteps.isPending;

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

  const onSubmit = (values: RecipeFormValues) => {
    const payload = buildRecipePayload(values);
    const {
      files,
      manifest,
      count,
      isDirty: galleryDirty,
    } = gallery.buildPayload();

    if (isEdit && recipe) {
      // ปิด guard ตั้งแต่ก่อนยิง — save มีสองจังหวะ (หัวสูตร → ขั้นตอน) ระหว่างนั้น
      // recipe ถูก refetch แล้วสถานะ dirty พลิก guard ปิดตัวเองแล้วสั่ง history.back()
      // ทับการ navigate กลับ list ของเรา (เด้งกลับมา /edit) · ปิดเองก่อน back() จะจบไปนานแล้ว
      f.setIsSubmitting(true);
      // Send the full gallery manifest only when it changed (full-sync);
      // omitting it keeps the existing images untouched.
      updateRecipe.mutate(
        {
          id: recipe.id,
          // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
          doc_version: recipe.doc_version,
          ...payload,
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
                      form.setValue(`preparation_steps.${i}.step_id`, ids[k++]);
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
          ingredients={ingredients}
          onChange={setIngredients}
          isDisabled={isDisabled}
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
