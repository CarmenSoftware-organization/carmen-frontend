import { useTranslations } from "use-intl";
import { Progress } from "@/components/ui/progress";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import type { RequestPriceList } from "@/types/request-price-list";
import { countSubmitted, getRfpWindow } from "./rfp-window";

// ใกล้ปิดรับ = เหลือไม่เกินกี่วัน (0 = ปิดวันนี้) — ขึ้นสี warning ให้ตามผู้ขายทัน
const CLOSING_SOON_DAYS = 3;

/** "ตอบกลับแล้ว / ที่เชิญ" + แถบความคืบหน้า — ครบทุกรายแถบเป็นสี success */
export function RfpResponses({ item }: { readonly item: RequestPriceList }) {
  const t = useTranslations("vendorManagement.requestPriceList");
  const total = item.vendor_count ?? item.vendors?.length ?? 0;

  if (total === 0) {
    return <span className="text-muted-foreground">{t("noVendors")}</span>;
  }

  const submitted = countSubmitted(item.vendors);
  const percent = Math.round((submitted / total) * 100);

  return (
    <div data-slot="cell-stack" className="flex w-28 flex-col gap-1">
      <span className="tabular-nums">
        {t("responsesOf", { submitted, total })}
      </span>
      <Progress
        value={percent}
        variant={submitted >= total ? "success" : "primary"}
        className="h-1"
        aria-label={t("responsesAria", { submitted, total })}
      />
    </div>
  );
}

/** Upcoming / Open (เหลือ N วัน) / Closed — คืน null ถ้าวันที่ไม่ครบ */
export function RfpWindowBadge({
  item,
  size = "xs",
}: {
  readonly item: RequestPriceList;
  readonly size?: "xs" | "sm";
}) {
  const t = useTranslations("vendorManagement.requestPriceList.window");
  const win = getRfpWindow(item.start_date, item.end_date);
  if (!win) return null;

  let tone: DotTone = "neutral";
  let label = t("closed");
  if (win.state === "upcoming") {
    tone = "info";
    label = t("upcoming");
  } else if (win.state === "open") {
    const days = win.daysLeft ?? 0;
    tone = days <= CLOSING_SOON_DAYS ? "warning" : "success";
    label = days === 0 ? t("closesToday") : t("daysLeft", { count: days });
  }

  return (
    <StatusDotBadge tone={tone} size={size}>
      {label}
    </StatusDotBadge>
  );
}
