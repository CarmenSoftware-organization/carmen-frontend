import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";

/**
 * โครงรอโหลดของหน้า cuisine — ต้องตรงกับ `CuisineForm`: General | Details แล้ว
 * Additional | Recipes วางคู่บนจอ ≥1700px (ต่ำกว่านั้นซ้อนกัน)
 */
export function CuisineFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true">
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton first className="h-28" />
          {/* ตัด mt-5 ตอนวางคู่ ให้ตรงกับหน้าจริง */}
          <div className="min-[1700px]:[&>div]:mt-0">
            <CompactSectionSkeleton className="h-28" />
          </div>
        </div>
        <div className={SECTION_PAIR}>
          <CompactSectionSkeleton className="h-20" />
          <CompactSectionSkeleton className="h-20" />
        </div>
      </div>
    </FormPageShell>
  );
}
