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
 * โครงรอโหลดของหน้าอุปกรณ์ (โหมดดู) — ต้องตรงกับ `EquipmentForm`: การ์ดหัว (ชื่อ +
 * ribbon: รูปย่อ · หมวด · รอบซ่อม · พร้อมใช้ · สถานี) แล้ว General | Specifications, Quantity | Instructions, Maintenance | Additional
 * วางคู่บนจอ ≥1700px (ต่ำกว่านั้นซ้อนกัน)
 */
export function EqFormSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD}>
          <FormPageHeaderSkeleton />
          <div className="mt-4 flex items-start gap-4">
            <Skeleton className="size-16 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <FieldGrid dense>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="space-y-1.5">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </FieldGrid>
            </div>
          </div>
        </div>
      }
    >
      <div aria-busy="true">
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
