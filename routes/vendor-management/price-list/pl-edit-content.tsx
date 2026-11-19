import { useTranslations } from "use-intl";
import { usePriceListById } from "@/hooks/use-price-list";
import { PriceListForm } from "./pl-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { CompactSectionSkeleton } from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export function PlEditContent({ id }: { id: string }) {
  const tErr = useTranslations("vendorManagement.priceList");
  const { data: priceList, isLoading, error, refetch } = usePriceListById(id);

  // โครงเดียวกับหน้าจริง: การ์ดหัว (ชื่อ + ช่อง General) · ตารางสินค้า
  if (isLoading)
    return (
      <FormPageShell
        width="wide"
        header={
          <div className={DOC_HEADER_CARD}>
            <FormPageHeaderSkeleton />
            <Skeleton className="mt-4 h-20 w-full" />
          </div>
        }
      >
        <CompactSectionSkeleton className="h-64" />
      </FormPageShell>
    );
  if (error || !priceList)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/vendor-management/price-list"
      />
    );

  return <PriceListForm priceList={priceList} />;
}
