import { FormPageShell } from "@/components/share/form-page-shell";
import { Skeleton } from "@/components/ui/skeleton";

const STAGE_ROWS = 5;
const METRICS = 6;
const TABLE_ROWS = 5;

/**
 * loading state ของหน้าแก้ workflow — โครงเดียวกับ WfDetail (หัว · รางขั้น 20rem ·
 * การ์ดแท็บที่เปิด Overview) แทน FormPageSkeleton ที่เป็นหน้า settings สองการ์ด
 * ซึ่งพอโหลดเสร็จทั้งจอกระโดดเปลี่ยนโครง
 */
export function WfDetailSkeleton() {
  return (
    <FormPageShell
      width="wide"
      header={
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="size-5 rounded-md" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="hidden h-4 w-28 md:block" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="hidden h-8 w-20 rounded-md sm:block" />
            <Skeleton className="hidden h-8 w-24 rounded-md sm:block" />
          </div>
        </div>
      }
    >
      <div
        aria-busy="true"
        className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] lg:items-start"
      >
        {/* รางขั้น */}
        <div className="bg-card space-y-4 rounded-xl border p-4">
          <div className="space-y-2">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-3 w-48" />
          </div>
          {Array.from({ length: STAGE_ROWS }, (_, i) => (
            <div key={i} className="flex items-start gap-3">
              <Skeleton className="size-6 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-36" />
              </div>
            </div>
          ))}
        </div>

        {/* การ์ดแท็บ — Overview */}
        <div className="bg-card overflow-hidden rounded-xl border">
          <div className="bg-muted/20 flex gap-6 border-b px-4 py-3 md:px-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
          </div>
          <div className="space-y-6 p-4 md:p-6">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              {Array.from({ length: METRICS }, (_, i) => (
                <div key={i} className="space-y-1.5">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-12" />
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-3 w-32" />
              <div className="divide-y rounded-lg border">
                {Array.from({ length: TABLE_ROWS + 1 }, (_, i) => (
                  <div key={i} className="flex items-center gap-4 px-3 py-2.5">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="ml-auto h-4 w-10" />
                    <Skeleton className="hidden h-4 w-10 md:block" />
                    <Skeleton className="hidden h-4 w-24 md:block" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FormPageShell>
  );
}
