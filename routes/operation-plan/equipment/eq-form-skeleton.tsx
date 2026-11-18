import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้าอุปกรณ์ (โหมดดู) — ต้องตรงกับ `EquipmentForm`: แถบสรุป แล้ว
 * General | Specifications, Quantity | Instructions, Maintenance | Additional
 * วางคู่บนจอ ≥1700px (ต่ำกว่านั้นซ้อนกัน)
 */
export function EqFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true">
        <Skeleton className="mb-5 h-28 w-full rounded-xl" />
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton first className="h-36" />
          {/* ตัด mt-5 ตอนวางคู่ ให้ตรงกับหน้าจริง */}
          <div className="min-[1700px]:[&>div]:mt-0">
            <CompactSectionSkeleton className="h-36" />
          </div>
        </div>
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton className="h-24" />
          <CompactSectionSkeleton className="h-24" />
        </div>
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton className="h-24" />
          <CompactSectionSkeleton className="h-24" />
        </div>
      </div>
    </FormPageShell>
  );
}
