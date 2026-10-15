import {
  Bell,
  MessageSquare,
  AlertTriangle,
  AlertCircle,
  Wrench,
  Info,
} from "lucide-react";
import { SubTile } from "@/components/icons/tiles";
import { formatMessage, NOTIFICATION_TILE } from "@/lib/notification-helpers";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn, sanitizeText } from "@/lib/utils";
import type { Notification } from "@/types/notification";

interface NotificationItemContentProps {
  readonly notification: Notification;
  readonly isUnread: boolean;
  readonly locale: string;
  readonly unreadLabel: string;
  readonly commentLabel: string;
  readonly clampMessage?: boolean;
  /** หน้า /notifications วาด unread rail ที่ขอบแถวเอง จึงปิดจุดตรงนี้ */
  readonly showUnreadDot?: boolean;
}

export function NotificationItemContent({
  notification,
  isUnread,
  locale,
  unreadLabel,
  commentLabel,
  clampMessage = false,
  showUnreadDot = true,
}: NotificationItemContentProps) {
  const time = notification.created_at
    ? formatRelativeTime(notification.created_at, locale)
    : null;
  const fullTime = notification.created_at
    ? new Date(notification.created_at).toLocaleString(locale, {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const tile = notification.doc_type
    ? NOTIFICATION_TILE[notification.doc_type]
    : undefined;
  const isComment = notification.event === "comment";
  const timeLabel = time && (
    <span
      title={fullTime || undefined}
      className={cn(
        "text-muted-foreground text-micro shrink-0 cursor-default whitespace-nowrap tabular-nums",
        clampMessage && "ms-auto",
      )}
    >
      {time}
    </span>
  );

  let FallbackIcon = Bell;
  const fallbackBg = "bg-primary text-primary-foreground";

  if (!tile && notification.source === "broadcast") {
    const sev = String(notification.metadata?.severity || "INFO").toUpperCase();
    if (sev === "WARNING") {
      FallbackIcon = AlertTriangle;
    } else if (sev === "CRITICAL") {
      FallbackIcon = AlertCircle;
    } else if (sev === "MAINTENANCE") {
      FallbackIcon = Wrench;
    } else if (sev === "INFO") {
      FallbackIcon = Info;
    }
  }

  return (
    <>
      {/* Unread rail — blue dot to the left of the icon (iOS style) with glow */}
      {showUnreadDot && (
        <span
          className="flex w-2 shrink-0 items-center justify-center"
          aria-hidden="true"
        >
          {isUnread && (
            <span className="bg-primary ring-primary/10 size-2 rounded-full shadow-[0_0_8px_var(--primary)] ring-4" />
          )}
        </span>
      )}

      {/* Leading app tile — squircle ชุดเดียวกับ sidebar/dashboard
          doc_type ที่ไม่ใช่เอกสาร (system/business_unit) ตกมาที่กระดิ่ง
          event=comment ติดตราเล็กมุมล่างขวาแทนการเพิ่มบรรทัดข้อความ */}
      <span className="relative flex shrink-0 items-center">
        {tile ? (
          <div className="rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110">
            <SubTile name={tile.name} parentName={tile.parent} size={36} />
          </div>
        ) : (
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-xl shadow-sm transition-transform duration-300 group-hover:scale-110",
              fallbackBg,
            )}
          >
            <FallbackIcon className="size-4.5" />
          </span>
        )}
        {isComment && (
          <span className="bg-background ring-border absolute -inset-e-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-full ring-1">
            <MessageSquare
              className="text-muted-foreground size-2.5"
              aria-hidden="true"
            />
            <span className="sr-only">{commentLabel}</span>
          </span>
        )}
      </span>

      {/* Content + inset bottom border (removed for card layout) */}
      <div className="min-w-0 flex-1">
        {/* Top line: type + title (left) · time (right) */}
        {/* หน้า /notifications (clampMessage) ให้ชื่อเรื่องขึ้นได้ 2 บรรทัด และให้
            ป้าย BU + เวลา wrap ลงบรรทัดถัดไปได้ — จอแคบ + เวลาภาษาไทยยาว ๆ
            เคยเหลือที่ให้ชื่อเรื่องแค่คำเดียว */}
        <div className="flex items-center gap-2">
          {isUnread && <span className="sr-only">{unreadLabel}</span>}
          <div
            className={cn(
              "flex min-w-0 flex-1 items-center gap-2",
              clampMessage ? "flex-wrap gap-y-0.5" : "truncate",
            )}
          >
            <p
              className={cn(
                "group-hover:text-primary text-sm leading-tight transition-colors duration-300",
                clampMessage ? "line-clamp-2 break-words" : "truncate",
                isUnread
                  ? "text-foreground font-semibold"
                  : "text-foreground/80 font-medium",
              )}
            >
              {sanitizeText(notification.title)}
            </p>
            {notification.metadata?.bu_code ? (
              <span className="bg-primary/10 text-primary text-micro-legal shrink-0 rounded-md px-1.5 py-0.5 font-bold tracking-wide uppercase">
                {notification.metadata.bu_code as string}
              </span>
            ) : null}
            {clampMessage && timeLabel}
          </div>
          {!clampMessage && timeLabel}
        </div>

        {/* Message */}
        <p
          className={cn(
            "text-muted-foreground/80 group-hover:text-muted-foreground mt-1 text-xs leading-relaxed transition-colors duration-300",
            // page list → 2 lines; navbar dropdown → single line + ellipsis
            clampMessage ? "line-clamp-2" : "truncate",
          )}
        >
          {formatMessage(notification.message)}
        </p>
      </div>
    </>
  );
}
