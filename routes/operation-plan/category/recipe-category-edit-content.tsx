import { useTranslations } from "use-intl";
import { useRecipeCategoryById } from "@/hooks/use-recipe-category";
import { RecipeCategoryForm } from "./recipe-category-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";

export function RecipeCategoryEditContent({ id }: { id: string }) {
  const tErr = useTranslations("operationPlan.recipeCategory");
  const {
    data: category,
    isLoading,
    error,
    refetch,
  } = useRecipeCategoryById(id);

  if (isLoading) return <FormPageSkeleton width="wide" />;
  if (error || !category)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/operation-plan/category"
      />
    );

  return <RecipeCategoryForm category={category} />;
}
