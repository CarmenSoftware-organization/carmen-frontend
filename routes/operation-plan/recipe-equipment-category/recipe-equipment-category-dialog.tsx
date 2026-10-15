import { useEffect } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
} from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  useCreateRecipeEquipmentCategory,
  useUpdateRecipeEquipmentCategory,
} from "./use-recipe-equipment-category";
import type { RecipeEquipmentCategory } from "@/types/recipe-equipment-category";
import {
  createRecipeEquipmentCategorySchema,
  EMPTY_FORM,
  type RecipeEquipmentCategoryFormValues,
} from "./recipe-equipment-category-form-schema";
import { useServerFieldErrors } from "@/hooks/use-server-field-errors";

interface RecipeEquipmentCategoryDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly category?: RecipeEquipmentCategory | null;
}

export function RecipeEquipmentCategoryDialog({
  open,
  onOpenChange,
  category,
}: RecipeEquipmentCategoryDialogProps) {
  const isEdit = !!category;
  const createCategory = useCreateRecipeEquipmentCategory();
  const updateCategory = useUpdateRecipeEquipmentCategory();
  const isPending = createCategory.isPending || updateCategory.isPending;
  const t = useTranslations("operationPlan.recipeEquipmentCategory");
  const tc = useTranslations("common");
  const tf = useTranslations("form");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");

  const schema = createRecipeEquipmentCategorySchema(tv, tfl);
  const form = useForm<RecipeEquipmentCategoryFormValues>({
    resolver: zodResolver(
      schema,
    ) as Resolver<RecipeEquipmentCategoryFormValues>,
    defaultValues: EMPTY_FORM,
  });
  useServerFieldErrors(form, {
    RECIPE_EQUIPMENT_CATEGORY_ALREADY_EXISTS: "name",
  });

  useEffect(() => {
    if (open) {
      form.reset(
        category
          ? {
              name: category.name,
              description: category.description ?? "",
              is_active: category.is_active,
            }
          : EMPTY_FORM,
      );
    }
  }, [open, category, form]);

  const onSubmit = (values: RecipeEquipmentCategoryFormValues) => {
    const payload = {
      name: values.name,
      description: values.description ?? "",
      is_active: values.is_active,
    };

    if (isEdit) {
      updateCategory.mutate(
        // doc_version round-trips the loaded record's version — backend requires it for optimistic-concurrency on update
        { id: category.id, doc_version: category.doc_version, ...payload },
        {
          onSuccess: () => {
            toast.success(tt("updateSuccess", { entity: t("entity") }));
            onOpenChange(false);
          },
        },
      );
    } else {
      createCategory.mutate(payload, {
        onSuccess: () => {
          toast.success(tt("createSuccess", { entity: t("entity") }));
          onOpenChange(false);
        },
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={isPending ? undefined : onOpenChange}>
      <DialogContent className="gap-3 p-4 sm:max-w-sm">
        <DialogHeader className="gap-0 pb-1">
          <DialogTitle className="text-sm">
            {isEdit
              ? tf("editTitle", { entity: t("entity") })
              : tf("addTitle", { entity: t("entity") })}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          <FieldGroup className="gap-3">
            <Field data-invalid={!!form.formState.errors.name}>
              <FieldLabel htmlFor="rec-eq-cat-name" className="text-xs">
                {tfl("name")}
              </FieldLabel>
              <Input
                id="rec-eq-cat-name"
                placeholder={t("namePlaceholder")}
                className="h-8"
                disabled={isPending}
                maxLength={100}
                {...form.register("name")}
              />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </Field>

            <Field>
              <FieldLabel htmlFor="rec-eq-cat-description" className="text-xs">
                {tfl("description")}
              </FieldLabel>
              <Textarea
                id="rec-eq-cat-description"
                placeholder={tfl("optional")}
                disabled={isPending}
                maxLength={256}
                {...form.register("description")}
              />
            </Field>

            <Controller
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <StatusSwitch
                  id="rec-eq-cat-is-active"
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={isPending}
                />
              )}
            />
          </FieldGroup>

          <DialogFooter className="pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {tc("cancel")}
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending
                ? isEdit
                  ? tf("saving")
                  : tf("creating")
                : isEdit
                  ? tc("save")
                  : tc("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
