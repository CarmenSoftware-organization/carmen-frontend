import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ListLoadMoreProps {
  readonly loaded: number;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly className?: string;
  /** ข้อความ "แสดง x จาก y" — ส่งมาจาก namespace ของหน้านั้น */
  readonly label: string;
}

/**
 * ท้ายรายการแบบ lazy load (ใช้กับ useInfiniteQuery) — เส้นสังเกต (sentinel) ยิง onLoadMore เมื่อเลื่อนมาใกล้
 * พร้อมบอก "แสดง x จาก y" ให้รู้ว่าเหลืออีกเท่าไร (แทนแถบเลขหน้า)
 *
 * observer สร้างใหม่ทุกครั้งที่จำนวนที่โหลดเปลี่ยน: ถ้าโหลดรอบแรกแล้วยังไม่เต็มจอ sentinel
 * ยังอยู่ใน viewport — observer ตัวใหม่จะรายงาน intersecting ทันทีแล้วโหลดรอบถัดไปต่อเอง
 */
export function ListLoadMore({
  loaded,
  hasMore,
  isLoadingMore,
  onLoadMore,
  className,
  label,
}: ListLoadMoreProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  });

  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || isLoadingMore) return;
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          onLoadMoreRef.current();
        }
      },
      { rootMargin: "300px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, loaded]);

  return (
    <div
      ref={ref}
      className={cn(
        "text-muted-foreground flex h-10 items-center justify-center gap-2 text-xs tabular-nums",
        className,
      )}
    >
      {isLoadingMore && <Loader2 className="size-4 animate-spin" />}
      {label}
    </div>
  );
}
