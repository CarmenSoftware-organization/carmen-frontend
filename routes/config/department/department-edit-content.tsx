import { useTranslations } from "use-intl";
import { useDepartmentById } from "@/hooks/use-department";
import { DepartmentForm } from "./department-form";
import { ErrorState } from "@/components/ui/error-state";
import { ConfigFormSkeleton } from "../shared/config-form-skeleton";

export function DepartmentEditContent({ id }: { id: string }) {
  const tErr = useTranslations("config.department");
  const { data: department, isLoading, error, refetch } = useDepartmentById(id);

  if (isLoading) return <ConfigFormSkeleton fields={5} />;
  if (error || !department)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/config/department"
      />
    );

  return <DepartmentForm department={department} />;
}
