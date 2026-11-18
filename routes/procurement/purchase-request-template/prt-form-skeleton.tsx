import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า PR template — ต้องตรงกับ `PrtForm` (ข้อมูลทั่วไป 4 ช่อง โดยคำอธิบาย
 * กว้าง 2 ช่อง + ตารางรายการ) ไม่งั้นเนื้อหากระโดดตอนข้อมูลมา · แก้ช่องใน
 * `prt-general-fields.tsx` ต้องแก้ `SPANS` ตามด้วย
 */
const SPANS = [1, 1, 2, 1] as const;

export function PrtFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true">
        <Skeleton className="mb-2 h-8 w-32" />
        <div className="bg-card rounded-xl border p-4 shadow-sm">
          <FieldGrid>
            {SPANS.map((span, i) => (
              <div
                key={i}
                className={
                  span === 2 ? "space-y-1.5 @md:col-span-2" : "space-y-1.5"
                }
              >
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-8 w-full" />
              </div>
            ))}
          </FieldGrid>
        </div>
        <CompactSectionSkeleton className="h-40" />
      </div>
    </FormPageShell>
  );
}
