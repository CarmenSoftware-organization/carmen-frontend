import { useTranslations } from "use-intl";
import { usePurchaseRequestById } from "./use-purchase-request";
import { PurchaseRequestForm } from "./pr-form";
import { ErrorState } from "@/components/ui/error-state";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";

export function PrEditContent({ id }: { id: string }) {
  const t = useTranslations("procurement.purchaseRequest");
  const {
    data: purchaseRequest,
    isLoading,
    error,
    refetch,
  } = usePurchaseRequestById(id);

  if (isLoading)
    return (
      <DocPageSkeleton ribbon="text" fields={[1, 2]} tabs={false} toolbar />
    );
  if (error || !purchaseRequest)
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo="/procurement/purchase-request"
      />
    );

  return (
    <PurchaseRequestForm
      key={purchaseRequest.id}
      purchaseRequest={purchaseRequest}
    />
  );
}
