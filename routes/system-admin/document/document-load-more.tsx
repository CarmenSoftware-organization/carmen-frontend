import { useEffect, useRef } from "react";
import { Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";

interface DocumentLoadMoreProps {
  readonly loaded: number;
  readonly total: number;
  readonly hasMore: boolean;
  readonly isLoadingMore: boolean;
  readonly onLoadMore: () => void;
  readonly className?: string;
}

/**
 * ท้ายรายการแบบ lazy load — เส้นสังเกต (sentinel) ยิง onLoadMore เมื่อเลื่อนมาใกล้
 * พร้อมบอก "แสดง x จาก y" ให้รู้ว่าเหลืออีกเท่าไร (แทนแถบเลขหน้า)
 *
 * observer สร้างใหม่ทุกครั้งที่จำนวนที่โหลดเปลี่ยน: ถ้าโหลดรอบแรกแล้วยังไม่เต็มจอ sentinel
 * ยังอยู่ใน viewport — observer ตัวใหม่จะรายงาน intersecting ทันทีแล้วโหลดรอบถัดไปต่อเอง
 */
export function DocumentLoadMore({
  loaded,
  total,
  hasMore,
  isLoadingMore,
  onLoadMore,
  className,
}: DocumentLoadMoreProps) {
  const t = useTranslations("systemAdmin.document");
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
      {t("loadedOf", { loaded, total })}
    </div>
  );
}
