import { useQuery } from "@tanstack/react-query";
import { useBuCode } from "@/hooks/use-bu-code";
import { coaRulesKey, readCoaRules } from "./coa-dimension-rules";
import { useParams, useSearchParams } from "react-router";
import { FormSkeleton } from "@/components/loader/form-skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { useChartOfAccountById } from "./use-coa";
import { CoaForm } from "./coa-form";

export function Component() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const query = useChartOfAccountById(id);
  const bu = useBuCode();
  const rules = useQuery({
    queryKey: coaRulesKey(bu, id),
    enabled: !!bu && !!id,
    queryFn: async () => {
      try {
        return await readCoaRules(bu!, id!);
      } catch (err) {
        console.warn("Unable to load dimension rules, defaulting to empty:", err);
        return [];
      }
    },
    retry: false,
  });

  if (query.isLoading || rules.isLoading) return <FormSkeleton />;
  if (query.error || !query.data) {
    return (
      <ErrorState
        error={query.error}
        onRetry={() => {
          void query.refetch();
          void rules.refetch();
        }}
        backTo="/config/chart-of-accounts"
      />
    );
  }

  return (
    <CoaForm
      account={query.data}
      rules={rules.data ?? []}
      initialEdit={searchParams.get("mode") === "edit"}
    />
  );
}
