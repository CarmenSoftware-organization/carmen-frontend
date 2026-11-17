import { useParams, useSearchParams } from "react-router";
import { CoaFormSkeleton } from "./coa-form-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useChartOfAccountById } from "./use-coa";
import { CoaForm } from "./coa-form";
import type { ChartOfAccountDetail } from "@/types/chart-of-accounts";

export function Component() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const query = useChartOfAccountById(id);
  // RHF defaults are read once: wait for an invalidated cached detail before mounting the form.
  if (query.isLoading || (query.isFetching && !query.isFetchedAfterMount))
    return <CoaFormSkeleton />;
  const account = query.data;
  if (
    query.error ||
    !account ||
    !("cost_centers" in account) ||
    !Array.isArray(account.cost_centers) ||
    !("dimensions" in account) ||
    !Array.isArray(account.dimensions)
  ) {
    return (
      <ErrorState
        error={
          query.error ??
          new Error(
            "Account detail is missing Cost Center or Dimension data. Reload after the backend update.",
          )
        }
        onRetry={() => {
          void query.refetch();
        }}
        backTo="/config/chart-of-accounts"
      />
    );
  }

  return (
    <CoaForm
      key={account.id}
      account={account as ChartOfAccountDetail}
      initialEdit={searchParams.get("mode") === "edit"}
    />
  );
}
