import { Suspense } from "react";
import { useTranslations } from "use-intl";
import { useProductById } from "@/hooks/use-product";
import { ProductForm } from "./pd-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import { FormPageShell } from "@/components/share/form-page-shell";
import {
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงตอนโหลด — ทรงเดียวกับหน้าจริง: หัวในการ์ด (DOC_HEADER_CARD เหมือน PR) + แถวแท็บ +
 * หมวด General (ตัวระบุสินค้า · คู่การจัดประเภท/ภาษี · flag) ข้อมูลมาแล้วเนื้อหาไม่กระโดด
 */
function PdPageSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD}>
          <FormPageHeaderSkeleton />
          <Skeleton className="mt-2 h-3.5 w-80 max-w-full" />
        </div>
      }
    >
      <div className="flex h-9 items-center gap-4">
        <Skeleton className="h-6 w-20" />
        <Skeleton className="h-6 w-16" />
        <Skeleton className="h-6 w-32" />
      </div>
      <CompactSectionSkeleton first className="h-32" />
      <div className={SECTION_PAIR}>
        <CompactSectionSkeleton className="h-20" />
        <CompactSectionSkeleton className="h-20" />
      </div>
      <CompactSectionSkeleton className="h-16" />
    </FormPageShell>
  );
}

const PdEditInner = ({ id }: { id: string }) => {
  const t = useTranslations("productManagement.product");
  const { data: product, isLoading, error, refetch } = useProductById(id);

  if (isLoading) return <PdPageSkeleton />;
  if (error || !product)
    return (
      <ErrorState
        error={error}
        notFoundMessage={t("notFound")}
        onRetry={() => refetch()}
        backTo="/product-management/product"
      />
    );

  return <ProductForm product={product} />;
};

export function PdEditContent({ id }: { id: string }) {
  return (
    <Suspense fallback={<PdPageSkeleton />}>
      <PdEditInner id={id} />
    </Suspense>
  );
}
