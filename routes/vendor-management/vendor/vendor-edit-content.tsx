import { useTranslations } from "use-intl";
import { useVendorById } from "@/hooks/use-vendor";
import { VendorForm } from "./vendor-form";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";

export function VendorEditContent({ id }: { id: string }) {
  const tErr = useTranslations("vendorManagement.vendor");
  const { data: vendor, isLoading, error, refetch } = useVendorById(id);

  // โครงเดียวกับหน้าจริง: General · ที่อยู่ | ผู้ติดต่อ · ข้อมูลเพิ่มเติม · ใบรับรอง
  if (isLoading)
    return (
      <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
        <CompactSectionSkeleton first className="h-28" />
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton className="h-28" />
          <CompactSectionSkeleton className="h-28" />
        </div>
        <CompactSectionSkeleton className="h-16" />
        <CompactSectionSkeleton className="h-32" />
      </FormPageShell>
    );
  if (error || !vendor)
    return (
      <ErrorState
        error={error}
        notFoundMessage={tErr("notFound")}
        onRetry={() => refetch()}
        backTo="/vendor-management/vendor"
      />
    );

  return <VendorForm vendor={vendor} />;
}
