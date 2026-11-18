import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";

/**
 * โครงรอโหลดของหน้าหมวดสูตร — ต้องตรงกับ `RecipeCategoryForm`: General คู่กับ
 * Cost & Margin Targets บนจอ ≥1700px (ต่ำกว่านั้นซ้อนกัน)
 */
export function RecipeCategoryFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true" className={SECTION_PAIR}>
        <CompactSectionSkeleton first className="h-28" />
        {/* ตัด mt-5 ตอนวางคู่ ให้ตรงกับหน้าจริง */}
        <div className="min-[1700px]:[&>div]:mt-0">
          <CompactSectionSkeleton className="h-28" />
        </div>
      </div>
    </FormPageShell>
  );
}
