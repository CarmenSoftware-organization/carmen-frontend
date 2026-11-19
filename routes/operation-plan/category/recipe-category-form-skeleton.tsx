import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้าหมวดสูตร (โหมดดู) — ต้องตรงกับ `RecipeCategoryForm`: การ์ดหัว
 * (ชื่อ + ribbon: หมวดแม่ · คำอธิบาย) แล้วตามด้วย Cost & Margin Targets หมวดเดียว
 */
export function RecipeCategoryFormSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD}>
          <FormPageHeaderSkeleton />
          <div className="mt-4">
            <FieldGrid dense>
              {[0, 1].map((i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-32" />
                </div>
              ))}
            </FieldGrid>
          </div>
        </div>
      }
    >
      <div aria-busy="true">
        <CompactSectionSkeleton first className="h-28" />
      </div>
    </FormPageShell>
  );
}
