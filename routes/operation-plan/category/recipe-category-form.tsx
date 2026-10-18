import { useState } from "react";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useEntityForm } from "@/hooks/use-entity-form";
import { toast } from "sonner";
import {
  useCreateRecipeCategory,
  useUpdateRecipeCategory,
  useDeleteRecipeCategory,
} from "@/hooks/use-recipe-category";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import type { RecipeCategory } from "@/types/recipe-category";
import type { RecipeCategoryLookup } from "@/types/lookup";
import {
  recipeCategorySchema,
  getDefaultValues,
  mapToPayload,
  type RecipeCategoryFormValues,
} from "./recipe-category-form-schema";
import { FormPageShell } from "@/components/share/form-page-shell";
import { RecipeCategoryToolbar } from "./recipe-category-toolbar";
import { RecipeCategoryGeneralFields } from "./recipe-category-general-fields";
import { RecipeCategoryPricingFields } from "./recipe-category-pricing-fields";

interface RecipeCategoryFormProps {
  readonly category?: RecipeCategory;
}

const LIST_PATH = "/operation-plan/category";

export function RecipeCategoryForm({ category }: RecipeCategoryFormProps) {
  const t = useTranslations("operationPlan.recipeCategory");
  const tt = useTranslations("toast");

  const createCategory = useCreateRecipeCategory();
  const updateCategory = useUpdateRecipeCategory();
  const deleteCategory = useDeleteRecipeCategory();
  const [showDelete, setShowDelete] = useState(false);
  const isPending = createCategory.isPending || updateCategory.isPending;

  const f = useEntityForm<RecipeCategoryFormValues>({
    entity: category,
    serverFieldErrors: { RECIPE_CATEGORY_CODE_ALREADY_EXISTS: "code" },
    resolver: zodResolver(
      recipeCategorySchema,
    ) as Resolver<RecipeCategoryFormValues>,
    defaultValues: getDefaultValues(category),
    listPath: LIST_PATH,
    isPending,
  });
  const { form, isEdit, isDisabled } = f;

  const handleParentChange = (parent?: RecipeCategoryLookup) => {
    form.setValue("level", parent ? (parent.level ?? 1) + 1 : 1);
  };

  const onSubmit = (values: RecipeCategoryFormValues) => {
    const payload = mapToPayload(values);

    if (isEdit && category) {
      updateCategory.mutate(
        // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
        { id: category.id, doc_version: category.doc_version, ...payload },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            f.backToList();
          },
        },
      );
    } else {
      createCategory.mutate(payload, {
        onSuccess: () => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          f.backToList();
        },
      });
    }
  };

  const handleDelete = () => {
    if (!category) return;
    deleteCategory.mutate(category.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        f.backToList();
      },
    });
  };

  const excludeIds = category ? new Set([category.id]) : undefined;

  return (
    <FormPageShell
      header={
        <RecipeCategoryToolbar
          form={form}
          mode={f.mode}
          isPending={isPending}
          isDeleting={deleteCategory.isPending}
          onBack={f.handleBack}
          onEdit={f.handleEdit}
          onCancel={f.handleCancel}
          onDelete={category ? () => setShowDelete(true) : undefined}
          activityId={category?.id}
        />
      }
    >
      <form
        id="recipe-category-form"
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
      >
        <RecipeCategoryGeneralFields
          form={form}
          isDisabled={isDisabled}
          isView={f.isView}
          excludeIds={excludeIds}
          onParentChange={handleParentChange}
        />
        <RecipeCategoryPricingFields
          form={form}
          isDisabled={isDisabled}
          isView={f.isView}
        />
      </form>

      {category && (
        <DeleteDialog
          open={showDelete}
          onOpenChange={(open) =>
            !open && !deleteCategory.isPending && setShowDelete(false)
          }
          title={t("deleteTitle")}
          description={t("deleteConfirm", { name: category.name })}
          isPending={deleteCategory.isPending}
          onConfirm={handleDelete}
        />
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
