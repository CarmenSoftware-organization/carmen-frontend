import { useTranslations } from "use-intl";
import { usePurchaseOrderById } from "../shared/use-purchase-order";
import PoForm from "./po-form";
import { ErrorState } from "@/components/ui/error-state";
import { DocPageSkeleton } from "@/components/loader/doc-page-skeleton";

export function PoEditContent({ id }: { id: string }) {
  const t = useTranslations("procurement.purchaseOrder");
  const {
    data: purchaseOrder,
    isLoading,
    error,
    refetch,
  } = usePurchaseOrderById(id);

  if (isLoading)
    return (
      // หน้าเปิดมาเป็นโหมดดู ช่องหัวใบเป็นข้อความ (FieldGrid dense) — ribbon="text"
      <DocPageSkeleton
        ribbon="text"
        fields={[1, 2, 1, 1, 1, 1, 2, 2]}
        tabs={false}
        toolbar
      />
    );
  if (error || !purchaseOrder)
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo="/procurement/purchase-order"
      />
    );

  return <PoForm key={purchaseOrder.id} purchaseOrder={purchaseOrder} />;
}
