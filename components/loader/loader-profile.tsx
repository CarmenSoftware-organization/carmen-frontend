import { CompactSectionSkeleton } from "@/components/share/compact-section";
import { Skeleton } from "../ui/skeleton";

/** โครงรอโหลดของหน้า /profile — โครงเดียวกับหน้าจริง (หัว · ข้อมูลส่วนตัว · BU) เนื้อหาจึงไม่กระโดดตอนข้อมูลมา */
export default function LoaderProfile() {
  return (
    <div className="w-full">
      <div className="bg-card flex items-center gap-3 rounded-xl border p-4 shadow-sm">
        <Skeleton className="size-14 shrink-0 rounded-full" />
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-3.5 w-64 max-w-full" />
        </div>
      </div>
      <CompactSectionSkeleton className="h-20" />
      <CompactSectionSkeleton className="h-72" />
    </div>
  );
}
