import { useState } from "react";
import { Link } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { BellOff, Check, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyComponent from "@/components/empty-component";
import { NotificationDetailDialog } from "@/components/navbar/notification";
import { NotificationItemContent } from "@/components/navbar/notification-item-content";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationsList,
  type NotificationTab,
} from "@/hooks/use-notification";
import { getNotificationHref } from "@/lib/notification-helpers";
import { cn, safeInternalHref } from "@/lib/utils";
import type { Notification } from "@/types/notification";
import { NotificationLoader } from "@/components/loader/noti-loader";

type DateBucket = "today" | "yesterday" | "thisWeek" | "earlier";

const BUCKET_LABEL_KEY: Record<DateBucket, string> = {
  today: "notifications.groupToday",
  yesterday: "notifications.groupYesterday",
  thisWeek: "notifications.groupThisWeek",
  earlier: "notifications.groupEarlier",
};

// เทียบกับเที่ยงคืนตามเวลาเครื่อง ไม่ใช่ 24 ชม. ย้อนหลัง — "เมื่อวาน" ต้องหมายถึงวันปฏิทิน
function bucketOf(createdAt: string | null | undefined, now: Date): DateBucket {
  if (!createdAt) return "earlier";
  const time = new Date(createdAt).getTime();
  if (Number.isNaN(time)) return "earlier";
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const DAY = 24 * 60 * 60 * 1000;
  if (time >= startOfToday.getTime()) return "today";
  if (time >= startOfToday.getTime() - DAY) return "yesterday";
  if (time >= startOfToday.getTime() - 6 * DAY) return "thisWeek";
  return "earlier";
}

// รายการจาก backend เรียงใหม่→เก่าอยู่แล้ว จึงเก็บลำดับตามที่เจอครั้งแรก
function groupByDate(items: Notification[]) {
  const now = new Date();
  const groups = new Map<DateBucket, Notification[]>();
  for (const item of items) {
    const bucket = bucketOf(item.created_at, now);
    const list = groups.get(bucket);
    if (list) list.push(item);
    else groups.set(bucket, [item]);
  }
  return [...groups.entries()];
}

const SEVERITY_EDGE: Record<string, string> = {
  INFO: "border-l-info",
  WARNING: "border-l-warning",
  CRITICAL: "border-l-destructive",
  MAINTENANCE: "border-l-muted-foreground",
};

export default function NotificationsContent() {
  const t = useTranslations("navbar");
  const tRoot = useTranslations();
  const locale = useLocale();
  const [tab, setTab] = useState<NotificationTab>("all");
  const {
    items,
    total,
    summary,
    isLoading,
    error,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = useNotificationsList(tab);
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const [detailId, setDetailId] = useState<string | null>(null);

  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const changeTab = (value: NotificationTab) => {
    if (document.startViewTransition) {
      document.startViewTransition(() => setTab(value));
    } else {
      setTab(value);
    }
  };

  const handleToggleSelectionMode = () => {
    setIsSelectionMode((prev) => !prev);
    setSelectedIds(new Set());
  };

  const handleSelectNotification = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // backend ไม่มี endpoint mark-read แบบหลายรายการ (มีแค่ :id/read กับ mark-all-read)
  // จึงยิงทีละรายการ — optimistic update ของ useMarkNotificationRead ทำให้แถวเปลี่ยนทันที
  const handleBulkMarkAsRead = () => {
    if (selectedIds.size === 0) return;
    for (const item of items) {
      if (selectedIds.has(item.id) && item.is_read === false) {
        markRead.mutate({ id: item.id, source: item.source });
      }
    }
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleMarkAsRead = (notification: Notification) =>
    markRead.mutate({ id: notification.id, source: notification.source });

  // แท็บ "ทั้งหมด" ให้ summary.unread มา ส่วนแท็บ "ยังไม่อ่าน" ไม่มี summary
  // โดยตั้งใจ (จำนวนยังไม่อ่าน = paginate.total ของ endpoint นั้นพอดี)
  // summary หายไป = "นับไม่ได้" ไม่ใช่ศูนย์ — undefined จึงต่างจาก 0 อย่างมีความหมาย
  const unreadCount: number | undefined =
    tab === "unread" ? total : summary?.unread;
  // แสดงปุ่ม/ป้ายเมื่อ "รู้ว่ามี" หรือ "ไม่รู้" (undefined) — ซ่อนเฉพาะเมื่อรู้แน่ว่าเป็นศูนย์
  const hasUnread = unreadCount !== 0;

  const broadcasts = items.filter((i) => i.source === "broadcast");
  const personal = items.filter((i) => i.source !== "broadcast");

  const rowProps = {
    locale,
    onShowDetail: setDetailId,
    onMarkRead: handleMarkAsRead,
    isSelectionMode,
    onToggleSelect: handleSelectNotification,
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-4 pb-[max(2rem,env(safe-area-inset-bottom))] md:py-6">
      <header className="flex min-h-9 flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <h1 className="text-xl font-semibold tracking-tight">
            {t("notifications")}
          </h1>
          <Tabs
            value={tab}
            onValueChange={(value) => changeTab(value as NotificationTab)}
          >
            <TabsList>
              <TabsTrigger value="all">
                {tRoot("notifications.tabAll")}
              </TabsTrigger>
              <TabsTrigger value="unread">
                {tRoot("notifications.tabUnread")}
                {unreadCount !== undefined && unreadCount > 0 && (
                  <span className="bg-primary/15 text-primary text-micro-legal ms-2 rounded-full px-2 py-0.5 font-bold tabular-nums">
                    {unreadCount.toLocaleString()}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {hasUnread && (
          <div className="flex gap-2">
            <Button
              variant={isSelectionMode ? "secondary" : "outline"}
              size="sm"
              onClick={handleToggleSelectionMode}
              aria-pressed={isSelectionMode}
            >
              <CheckSquare aria-hidden="true" />
              {isSelectionMode
                ? tRoot("notifications.cancel")
                : tRoot("notifications.select")}
            </Button>
            {!isSelectionMode && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
              >
                {tRoot("notifications.markAllRead")}
              </Button>
            )}
          </div>
        )}
      </header>

      {error && (
        <p className="text-destructive text-sm">
          {error instanceof Error ? error.message : String(error)}
        </p>
      )}

      <div
        className="flex flex-col gap-4"
        style={{ viewTransitionName: "notification-list" }}
      >
        {isLoading ? (
          <div className="bg-card rounded-lg border p-4">
            <NotificationLoader />
          </div>
        ) : items.length === 0 ? (
          <div className="bg-card flex items-center justify-center rounded-lg border px-4 py-16">
            <EmptyComponent
              icon={BellOff}
              title={
                tab === "unread"
                  ? tRoot("notifications.emptyUnreadTitle")
                  : t("noNotificationsTitle")
              }
              description={
                tab === "unread" ? (
                  <div className="flex flex-col items-center gap-4">
                    <p className="text-muted-foreground">
                      {tRoot("notifications.emptyUnreadDesc")}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changeTab("all")}
                    >
                      {tRoot("notifications.viewAll")}
                    </Button>
                  </div>
                ) : (
                  t("noNotificationsDesc")
                )
              }
            />
          </div>
        ) : (
          <>
            {broadcasts.length > 0 && (
              <section aria-labelledby="notifications-broadcasts">
                <GroupHeading id="notifications-broadcasts">
                  {tRoot("notifications.broadcasts")}
                </GroupHeading>
                <ul className="flex flex-col gap-2">
                  {broadcasts.map((notification) => (
                    <NotificationRow
                      key={notification.id}
                      notification={notification}
                      isSelected={selectedIds.has(notification.id)}
                      variant="broadcast"
                      {...rowProps}
                    />
                  ))}
                </ul>
              </section>
            )}

            {personal.length > 0 && (
              <div className="bg-card overflow-clip rounded-lg border">
                {groupByDate(personal).map(([bucket, bucketItems]) => (
                  <section
                    key={bucket}
                    aria-labelledby={`notifications-${bucket}`}
                  >
                    <GroupHeading
                      id={`notifications-${bucket}`}
                      className="bg-muted sticky top-0 z-10 mb-0 border-b px-4 py-1.5"
                    >
                      {tRoot(BUCKET_LABEL_KEY[bucket])}
                    </GroupHeading>
                    <ul className="divide-y border-b last:border-b-0">
                      {bucketItems.map((notification) => (
                        <NotificationRow
                          key={notification.id}
                          notification={notification}
                          isSelected={selectedIds.has(notification.id)}
                          variant="inbox"
                          {...rowProps}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNextPage}
            disabled={isFetchingNextPage}
          >
            {tRoot("notifications.loadMore")}
          </Button>
        </div>
      )}

      <NotificationDetailDialog
        id={detailId}
        onClose={() => setDetailId(null)}
      />

      {isSelectionMode && selectedIds.size > 0 && (
        <div className="bg-card animate-in slide-in-from-bottom-5 fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-full border py-2 ps-5 pe-2 shadow-lg">
          <span className="text-sm font-semibold whitespace-nowrap tabular-nums">
            {tRoot("notifications.selectedCount", { count: selectedIds.size })}
          </span>
          <Button
            size="sm"
            onClick={handleBulkMarkAsRead}
            className="rounded-full"
          >
            {tRoot("notifications.markSelectedRead")}
          </Button>
        </div>
      )}
    </div>
  );
}

function GroupHeading({
  id,
  className,
  children,
}: {
  readonly id: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className={cn(
        "text-muted-foreground text-micro-eyebrow mb-2 font-semibold tracking-wider uppercase",
        className,
      )}
    >
      {children}
    </h2>
  );
}

interface NotificationRowProps {
  readonly notification: Notification;
  readonly locale: string;
  readonly variant: "inbox" | "broadcast";
  readonly onShowDetail: (id: string) => void;
  readonly onMarkRead: (notification: Notification) => void;
  readonly isSelectionMode: boolean;
  readonly isSelected: boolean;
  readonly onToggleSelect: (id: string) => void;
}

function NotificationRow({
  notification,
  locale,
  variant,
  onShowDetail,
  onMarkRead,
  isSelectionMode,
  isSelected,
  onToggleSelect,
}: NotificationRowProps) {
  const t = useTranslations("navbar");
  const tRoot = useTranslations();
  const safeLink = safeInternalHref(getNotificationHref(notification));
  const isUnread = notification.is_read === false;
  const canSelect = isSelectionMode && isUnread;
  const showRowAction = isUnread && !isSelectionMode;

  const severity = String(
    notification.metadata?.severity || "INFO",
  ).toUpperCase();

  const rowClass = cn(
    "relative flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
    "hover:bg-muted/50 focus-visible:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary",
    variant === "broadcast" &&
      cn(
        "bg-card rounded-lg border border-l-4",
        SEVERITY_EDGE[severity] ?? SEVERITY_EDGE.INFO,
      ),
    // เว้นที่ด้านขวาให้ปุ่ม "อ่านแล้ว" ไม่ทับเวลา/ข้อความ — จอเล็กไม่มีปุ่ม
    // (แตะแถวก็ mark read อยู่แล้ว) ชื่อเรื่องจะได้ไม่ถูกตัดเหลือคำเดียว
    showRowAction && "sm:pe-12",
  );

  const body = (
    <>
      {/* Unread rail — สัญญาณเดียวของ "ยังไม่อ่าน" คู่กับชื่อเรื่องตัวหนา
          หดหายด้วย scale-y ตอนถูก mark read (optimistic) */}
      {variant === "inbox" && (
        <span
          aria-hidden="true"
          className={cn(
            "bg-primary absolute inset-y-0 start-0 w-[3px] origin-center transition-transform duration-150 ease-out",
            isUnread ? "scale-y-100" : "scale-y-0",
          )}
        />
      )}
      {isSelectionMode && (
        // แถวทั้งแถวเป็น <label> ของ checkbox นี้ — กดตรงไหนก็สลับได้
        // โดยไม่ต้องซ้อน <button> ใน <button>
        <Checkbox
          checked={isSelected}
          disabled={!canSelect}
          onCheckedChange={() => onToggleSelect(notification.id)}
          className="shrink-0"
        />
      )}
      <NotificationItemContent
        notification={notification}
        isUnread={isUnread}
        locale={locale}
        unreadLabel={t("unread")}
        commentLabel={tRoot("notifications.commentLabel")}
        clampMessage
        showUnreadDot={false}
      />
    </>
  );

  return (
    <li className="group relative">
      {canSelect ? (
        <label className={cn(rowClass, "cursor-pointer")}>{body}</label>
      ) : isSelectionMode ? (
        // แถวที่อ่านแล้วเลือกไม่ได้ — ไม่ให้กดแล้วหลุดไปหน้าเอกสารกลางโหมดเลือก
        <div className={cn(rowClass, "opacity-60 hover:bg-transparent")}>
          {body}
        </div>
      ) : safeLink ? (
        <Link
          to={safeLink}
          className={rowClass}
          onClick={() => onMarkRead(notification)}
        >
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => {
            onMarkRead(notification);
            onShowDetail(notification.id);
          }}
          className={rowClass}
        >
          {body}
        </button>
      )}

      {showRowAction && (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={tRoot("notifications.markRead")}
          title={tRoot("notifications.markRead")}
          onClick={() => onMarkRead(notification)}
          className="text-muted-foreground hover:text-foreground absolute end-2 top-1/2 hidden -translate-y-1/2 sm:inline-flex"
        >
          <Check aria-hidden="true" />
        </Button>
      )}
    </li>
  );
}
