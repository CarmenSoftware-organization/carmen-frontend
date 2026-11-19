import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า cuisine (โหมดดู) — ต้องตรงกับ `CuisineForm`: การ์ดหัว (ชื่อ +
 * ribbon: region · description · note) แล้ว Details | Recipes วางคู่บนจอ ≥1700px
 */
export function CuisineFormSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD}>
          <FormPageHeaderSkeleton />
          <div className="mt-4">
            <FieldGrid dense>
              {[0, 1, 2].map((i) => (
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
