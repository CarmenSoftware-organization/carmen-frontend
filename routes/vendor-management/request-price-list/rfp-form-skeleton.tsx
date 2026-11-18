import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า request for pricing (โหมดดู) — ต้องตรงกับ `RfpForm`:
 * General (template · ช่วงรับราคา + badge) → ตารางผู้ขาย → Custom message
 * แก้ช่องใน `rfp-form.tsx` ต้องแก้โครงนี้ตามด้วย
 */
export function RfpFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true">
        <Skeleton className="mb-2 h-8 w-32" />
        <div className="bg-card rounded-xl border p-4 shadow-sm">
          <FieldGrid>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
          </FieldGrid>
        </div>
        <CompactSectionSkeleton className="h-36" />
        <CompactSectionSkeleton className="h-14" />
      </div>
    </FormPageShell>
  );
}
