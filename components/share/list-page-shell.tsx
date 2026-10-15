import type { ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { DocumentListHeader } from "@/components/share/document-list-header";
import { useIsMobile } from "@/hooks/use-mobile";
import type { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { cn } from "@/lib/utils";

interface ListPageShellProps {
  readonly title: string;
  readonly description: string;
  readonly count?: number;
  /** หน้านี้ยังเป็นข้อมูลตัวอย่าง → แสดงป้าย MOCK ข้างชื่อ */
  readonly mock?: boolean;
  /** ปกติคือ <DocumentListActions …> — ไม่ส่ง = ไม่มีปุ่มฝั่งขวาของหัว */
  readonly actions?: ReactNode;
  /** ปกติคือ <ListToolbar …> — accounting ส่ง toolbar ของตัวเอง */
  readonly toolbar?: ReactNode;
  /** ผล usePullToRefresh — มีค่า = ผูก containerRef + วาด indicator บนมือถือ */
  readonly pullRefresh?: ReturnType<typeof usePullToRefresh>;
  readonly children: ReactNode;
}

/**
 * โครงหน้า list ของทุกโมดูล — wrapper · บล็อก sticky บนมือถือ · แถวหัว
 * (DocumentListHeader + actions) · toolbar · content
 *
 * เป็นจุดเดียวที่คุมโครงนี้ทั้งแอป (เคยถูกก๊อปจาก ConfigListTemplate 29 หน้า)
 * guard: components/share/__tests__/list-page-shell.usage.test.ts
 * ไม่ใส่ "use no memo" เพราะไม่รับ table instance — หน้าที่มีตารางคุม directive เอง
 */
export function ListPageShell({
  title,
  description,
  count,
  mock = false,
  actions,
  toolbar,
  pullRefresh,
  children,
}: ListPageShellProps) {
  const isMobile = useIsMobile();
  const showPull =
    !!pullRefresh &&
    isMobile &&
    (pullRefresh.distance > 0 || pullRefresh.isRefreshing);

  return (
    <div
      ref={pullRefresh?.containerRef}
      className="pb-[max(1rem,env(safe-area-inset-bottom))]"
    >
      {showPull && (
        <div
          data-testid="pull-refresh-indicator"
          className="text-muted-foreground flex items-center justify-center overflow-hidden transition-all"
          style={{
            height: pullRefresh.isRefreshing ? 48 : pullRefresh.distance,
          }}
          aria-hidden={!pullRefresh.isRefreshing}
        >
          <RefreshCw
            className={cn("size-4", pullRefresh.isRefreshing && "animate-spin")}
            style={{
              transform: pullRefresh.isRefreshing
                ? undefined
                : `rotate(${pullRefresh.progress * 360}deg)`,
            }}
          />
        </div>
      )}
      {/* Sticky top section on mobile */}
      <div className="bg-background sticky top-0 z-20 space-y-3 pb-3 sm:static sm:pb-0">
        <div
          data-testid="list-page-header"
          className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
        >
          <DocumentListHeader
            title={title}
            description={description}
            count={count}
            mock={mock}
          />
          {actions}
        </div>
        {toolbar}
      </div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  );
}
