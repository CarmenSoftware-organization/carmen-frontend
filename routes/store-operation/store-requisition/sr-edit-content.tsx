import { useTranslations } from "use-intl";
import { useStoreRequisitionById } from "./use-sr";
import { StoreRequisitionForm } from "./sr-form";
import { ErrorState } from "@/components/ui/error-state";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";

export function SrEditContent({ id }: { id: string }) {
  const t = useTranslations("storeOperation.storeRequisition");
  const {
    data: storeRequisition,
    isLoading,
    error,
    refetch,
  } = useStoreRequisitionById(id);

  if (isLoading) return <DocPageSkeleton fields={[1, 1, 1, 1, 2]} />;
  if (error || !storeRequisition)
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo="/store-operation/store-requisition"
      />
    );

  return (
    <StoreRequisitionForm
      key={storeRequisition.audit?.updated?.at ?? storeRequisition.id}
      storeRequisition={storeRequisition}
    />
  );
}
