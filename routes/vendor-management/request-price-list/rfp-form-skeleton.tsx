import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า request for pricing (โหมดดู) — ต้องตรงกับ `RfpForm`:
 * การ์ดหัว (ชื่อ + ช่อง General: template · ช่วงรับราคา) → ตารางผู้ขาย → Custom message
 * แก้ช่องใน `rfp-form.tsx` ต้องแก้โครงนี้ตามด้วย
 */
export function RfpFormSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD}>
          <FormPageHeaderSkeleton />
          <div className="mt-4">
            <FieldGrid dense>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-44" />
              </div>
            </FieldGrid>
          </div>
        </div>
      }
    >
      <div aria-busy="true">
        <CompactSectionSkeleton className="h-36" />
        <CompactSectionSkeleton className="h-14" />
      </div>
    </FormPageShell>
  );
}
