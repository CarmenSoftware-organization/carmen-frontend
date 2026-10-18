import { useTranslations } from "use-intl";
import { useCuisineById } from "@/hooks/use-cuisine";
import { CuisineForm } from "./cuisine-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";

export function CuisineEditContent({ id }: { id: string }) {
  const tErr = useTranslations("operationPlan.cuisine");
  const { data: cuisine, isLoading, error, refetch } = useCuisineById(id);

  if (isLoading) return <FormPageSkeleton width="wide" />;
  if (error || !cuisine)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/operation-plan/cuisine"
      />
    );

  return <CuisineForm cuisine={cuisine} />;
}
