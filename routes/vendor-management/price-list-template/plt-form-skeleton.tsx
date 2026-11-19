import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import { DOC_HEADER_CARD } from "@/components/loader/doc-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า price list template (โหมดดู) — ต้องตรงกับ `PriceListTemplateForm`:
 * การ์ดหัว (ชื่อ + ช่อง General: สกุลเงิน · อายุราคา · คำอธิบายกว้าง 2 ช่อง) แล้วตามด้วย
 * Instructions to vendor และตารางสินค้า · แก้ช่องใน `plt-form.tsx` ต้องแก้ `SPANS` ตามด้วย
 */
const SPANS = [1, 1, 2] as const;

export function PltFormSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className={DOC_HEADER_CARD}>
          <FormPageHeaderSkeleton />
          <div className="mt-4">
            <FieldGrid dense>
              {SPANS.map((span, i) => (
                <div
                  key={i}
                  data-wide={span === 2 ? "" : undefined}
                  className={
                    span === 2 ? "space-y-1.5 @md:col-span-2" : "space-y-1.5"
                  }
                >
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
        <Skeleton className="mb-2 h-8 w-40" />
        <div className="bg-card rounded-xl border p-4 shadow-sm">
          <Skeleton className="h-4 w-48" />
        </div>
        <CompactSectionSkeleton className="h-40" />
      </div>
    </FormPageShell>
  );
}
