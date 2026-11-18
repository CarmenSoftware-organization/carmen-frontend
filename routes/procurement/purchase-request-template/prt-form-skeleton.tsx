import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า PR template — ต้องตรงกับ `PrtForm` โหมดดู (หน้าเปิดมาเป็นโหมดดูเสมอ):
 * การ์ดหัวเอกสาร (ชื่อ + สถานะ + ปุ่ม แล้ว ribbon Workflow · Description แบบ dense + ตาราง audit
 * ชิดขวา) ตามด้วยตารางรายการ · ไม่ใช้ `DocPageSkeleton` เพราะมันมีแถบสรุปยอดด้านล่าง
 * ซึ่งแม่แบบไม่มี · แก้ ribbon ใน `prt-general-fields.tsx` ต้องแก้ตรงนี้ตาม
 */
export function PrtFormSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD} aria-busy="true">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-7 w-40" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-8 w-56 max-w-full rounded-md" />
          </div>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-3 pt-4">
            <div className="min-w-0 flex-1 basis-72">
              <FieldGrid dense>
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    data-wide={i === 1 ? "" : undefined}
                    className="space-y-1.5 @md:col-span-1!"
                  >
                    <Skeleton className="h-3 w-16" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </FieldGrid>
            </div>
            <Skeleton className="ms-auto hidden h-10 w-96 max-w-full sm:block" />
          </div>
        </div>
      }
    >
      <CompactSectionSkeleton className="h-40" />
    </FormPageShell>
  );
}
