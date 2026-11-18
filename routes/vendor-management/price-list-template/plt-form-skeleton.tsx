import { FormPageHeaderSkeleton } from "@/components/loader/form-page-skeleton";
import {
  CompactSectionSkeleton,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * โครงรอโหลดของหน้า price list template (โหมดดู) — ต้องตรงกับ `PriceListTemplateForm`:
 * General (สกุลเงิน · อายุราคา · คำอธิบายกว้าง 2 ช่อง) คู่กับ Instructions to vendor
 * บนจอ ≥1700px แล้วตามด้วยตารางสินค้า · แก้ช่องใน `plt-form.tsx` ต้องแก้ `SPANS` ตามด้วย
 */
const SPANS = [1, 1, 2] as const;

export function PltFormSkeleton() {
  return (
    <FormPageShell width="wide" header={<FormPageHeaderSkeleton />}>
      <div aria-busy="true">
        <div className={SECTION_PAIR}>
          <div>
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
                    <Skeleton className="h-4 w-32" />
                  </div>
                ))}
              </FieldGrid>
            </div>
          </div>
          <div className="mt-5 min-[1700px]:mt-0">
            <Skeleton className="mb-2 h-8 w-40" />
            <div className="bg-card rounded-xl border p-4 shadow-sm">
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        </div>
        <CompactSectionSkeleton className="h-40" />
      </div>
    </FormPageShell>
  );
}
