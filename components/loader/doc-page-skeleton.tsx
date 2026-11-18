import { FormPageShell } from "@/components/share/form-page-shell";
import { FieldGrid } from "@/components/share/compact-section";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * loading state ของหน้าเอกสาร (PO/PR/GRN/CN/SR) — โครงต้องตรงกับหน้าจริง ไม่งั้น
 * เนื้อหากระโดดตอนข้อมูลมาถึง (spec 2026-10-02-form-page-shell-documents-design.md §2.3)
 *
 * - `ribbon="inputs"` (ค่าตั้งต้น — PO/GRN/CN/SR) ช่องหัวใบเป็นกล่อง input ใน grid
 *   6 คอลัมน์แบบเดียวกับหน้าจริง · `fields` = ความกว้างของแต่ละช่อง (1 หรือ 2 คอลัมน์)
 *   ตามลำดับบนหน้าจริงโหมดดู จำนวนแถวจึงเท่าของจริง · `tabs` = แท็บเหนือตาราง
 *   (GRN/CN/SR) · `toolbar` = แถวปุ่มชิดขวาเหนือตาราง (PO: Expand all, CN: Collapse all)
 * - `ribbon="text"` (PR, GRN) ช่องหัวใบโหมดดูเป็นข้อความ (ป้าย + ค่า ไม่มีกรอบ)
 *   ใน `FieldGrid` เดียวกับหน้าจริง · `fields` ใช้ความหมายเดิม (2 = `@md:col-span-2`)
 *   · PR: `fields={[1, 2]}` ไม่มีแท็บ มีแต่ปุ่ม Filter ชิดขวา (`toolbar`)
 *
 * แก้ช่องบนหัวเอกสารไหน ให้แก้ `fields` ที่จุดเรียกของเอกสารนั้นด้วย
 */
export function DocPageSkeleton({
  ribbon = "inputs",
  fields = [1, 1, 1, 1, 1, 1],
  tabs = true,
  toolbar = false,
}: {
  readonly ribbon?: "inputs" | "text";
  readonly fields?: readonly (1 | 2)[];
  readonly tabs?: boolean;
  readonly toolbar?: boolean;
}) {
  return (
    <FormPageShell
      width="wide"
      header={<DocHeaderSkeleton />}
      footer={<DocFooterSkeleton />}
    >
      <div className="space-y-4">
        {ribbon === "text" ? (
          <>
            <FieldGrid>
              {fields.map((span, i) => (
                <div key={i} className={cn(span === 2 && "@md:col-span-2")}>
                  <TextFieldSkeleton />
                </div>
              ))}
            </FieldGrid>
            <Skeleton className="h-px w-full" />
            {tabs && (
              <div className="flex h-9 items-center gap-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            )}
            {toolbar && (
              <div className="flex justify-end">
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            )}
          </>
        ) : (
          <>
            {/* track เดียวกับ grid ช่องหัวใบของหน้าจริง (sm:/lg: ตามของจริง) */}
            <div className="grid grid-cols-1 gap-x-2 gap-y-4 sm:grid-cols-2 lg:grid-cols-6">
              {fields.map((span, i) => (
                <div
                  key={i}
                  className={cn("space-y-1.5", span === 2 && "lg:col-span-2")}
                >
                  <Skeleton className="h-3.5 w-20" />
                  <Skeleton className="h-8 w-full" />
                </div>
              ))}
            </div>
            <Skeleton className="h-px w-full" />
            {tabs && (
              <div className="flex h-9 items-center gap-4">
                <Skeleton className="h-6 w-20" />
                <Skeleton className="h-6 w-20" />
              </div>
            )}
            {toolbar && (
              <div className="flex justify-end">
                <Skeleton className="h-8 w-24 rounded-md" />
              </div>
            )}
          </>
        )}
        <div className="space-y-2 rounded-lg border p-3">
          <Skeleton className="h-6 w-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </FormPageShell>
  );
}

/** ป้ายจาง + ค่า ทรงเดียวกับ `SettingField` */
function TextFieldSkeleton() {
  return (
    <div className="space-y-1.5">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-32" />
    </div>
  );
}

/**
 * หัวเอกสาร: เลขที่ใบ + สถานะ · ปุ่มชิดขวา · บรรทัดผู้ขอ/แผนก/วันที่ใต้ชื่อ
 * ห่อตามความกว้างกล่องเหมือนของจริง — หัวแคบ (มือถือ) แถวปุ่มตกลงบรรทัดใต้ชื่อ
 * และบรรทัดผู้ขอ/วันที่ห่อเป็นสองบรรทัด
 */
function DocHeaderSkeleton() {
  return (
    <div className="@container">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-8 w-64 max-w-full rounded-md" />
      </div>
      <div className="mt-1 space-y-1.5">
        <Skeleton className="h-3 w-56 max-w-full" />
        <Skeleton className="h-3 w-24 @xl:hidden" />
      </div>
    </div>
  );
}

/**
 * แถบสรุปยอด + ปุ่ม workflow ด้านล่าง ตำแหน่งเดียวกับ `SummaryFooterBar` —
 * แถบแคบ สรุปยอดห่อสองบรรทัดและปุ่มตกลงบรรทัดถัดไปเหมือนของจริง
 */
function DocFooterSkeleton() {
  return (
    <div className="bg-background @container sticky bottom-0 z-20 mt-auto flex flex-wrap items-center justify-between gap-3 border-t p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="w-72 max-w-full space-y-1.5">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-40 @4xl:hidden" />
      </div>
      <Skeleton className="h-8 w-24 rounded-md" />
    </div>
  );
}
