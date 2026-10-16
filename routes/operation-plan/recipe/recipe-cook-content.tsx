import { useTranslations } from "use-intl";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";
import { useRecipeById } from "./use-recipe";
import { RecipeCookView } from "./recipe-cook-view";

export function RecipeCookContent({ id }: { id: string }) {
  const t = useTranslations("operationPlan.recipe");
  const { data: recipe, isLoading, error, refetch } = useRecipeById(id);

  if (isLoading) return <FormPageSkeleton />;
  if (error || !recipe)
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo="/operation-plan/recipe"
      />
    );

  return <RecipeCookView recipe={recipe} />;
}
