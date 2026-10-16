import {
  CalendarRange,
  ChevronRight,
  ClipboardList,
  FileText,
  Lock,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useState } from "react";
import { toast } from "sonner";
import EmptyComponent from "@/components/empty-component";
import { Button } from "@/components/ui/button";
import { FormPageShell } from "@/components/share/form-page-shell";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { useClosePeriodEnd, usePeriodEndReview } from "./use-period-end";
import type {
  PeriodEndReview,
  ReviewTransactionKey,
  ReviewTransactionStat,
} from "@/types/period-end";
import { cn } from "@/lib/utils";
import { PeCloseTrack } from "./pe-close-track";
import { formatLocalizedDate } from "@/lib/date-utils";
import type { PhysicalCountLocation } from "@/types/physical-count";
import { PeDocumentsDialog } from "./pe-documents-dialog";
import { PcLocationRow } from "../shared/pc-location-row";
import { useOpenPhysicalCount } from "../shared/use-open-physical-count";

interface ModuleConfig {
  readonly icon: LucideIcon;
  readonly color: string;
}

const MODULE_CONFIG: Record<ReviewTransactionKey, ModuleConfig> = {
  pr: { icon: FileText, color: "var(--primary)" },
  po: { icon: ShoppingCart, color: "var(--primary)" },
  grn: { icon: PackageCheck, color: "var(--primary)" },
  cn: { icon: Receipt, color: "var(--primary)" },
  sr: { icon: ClipboardList, color: "var(--primary)" },
  si: { icon: PackagePlus, color: "var(--status-stock-in)" },
  so: { icon: PackageMinus, color: "var(--status-stock-out)" },
};

/* ที่ backend นับใน `close_blocking` — ค้างเมื่อไรปิดงวดไม่ได้ ส่วน PR/PO ไม่อยู่ในนั้น
   (ใบขอซื้อ/ใบสั่งซื้อที่ยังเปิดไม่ขยับสต๊อก) หน้าเดิมขึ้นป้าย Incomplete สีเหลืองให้
   ทุกโมดูลเท่ากัน ผู้ใช้จึงไล่เคลียร์ PR/PO ที่ไม่ได้กันอะไรเลย */
const CLOSE_BLOCKING_KEY = {
  grn: "grn",
  si: "stock_in",
  so: "stock_out",
  sr: "sr",
  cn: "cn",
} as const satisfies Partial<
  Record<ReviewTransactionKey, keyof PeriodEndReview["close_blocking"]>
>;

type BlockingKey = keyof typeof CLOSE_BLOCKING_KEY;

const BLOCKING_KEYS = Object.keys(CLOSE_BLOCKING_KEY) as BlockingKey[];
const REFERENCE_KEYS: ReviewTransactionKey[] = ["pr", "po"];

export default function PeReview() {
  const navigate = useNavigate();
  const locale = useLocale();
  const t = useTranslations("inventoryManagement.periodEnd");
  const tc = useTranslations("common");
  const { data, isLoading, isFetching, refetch } = usePeriodEndReview();
  const closeMutation = useClosePeriodEnd();
  const { open: openPhysicalCount, pendingLocationId } = useOpenPhysicalCount();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [docsKey, setDocsKey] = useState<ReviewTransactionKey | null>(null);

  const locations = data?.details.physical_count ?? [];
  const locationsDone = locations.filter(
    (p) => p.physical_count_status === "completed",
  ).length;
  const blockingDocs = data
    ? BLOCKING_KEYS.reduce(
        (sum, key) => sum + data.close_blocking[CLOSE_BLOCKING_KEY[key]],
        0,
      )
    : 0;

  /* กติกาการปิดงวดมาจาก backend ไม่คำนวณซ้ำที่นี่ — เดิมหน้านี้คิดเองว่า "ทุกโมดูล
     is_complete และทุกคลังนับครบ" แต่ backend คืน is_complete เป็น false เมื่อโมดูลนั้น
     ไม่มีเอกสารเลย (count > 0 && ...) งวดที่ไม่มีใบลดหนี้จึงกดปิดไม่ได้ตลอดกาล */
  const canClose = data?.can_close ?? false;

  const isCounting = data?.physical_count_period?.status === "counting";

  const handleClose = () => {
    closeMutation.mutate(undefined, {
      onSuccess: () => {
        toast.success(t("closeSuccess"));
        setConfirmOpen(false);
        navigate("/inventory-management/period-end");
      },
    });
  };

  /* เปิดใบนับของคลังนั้น — สร้างใบใหม่ให้ถ้ายังไม่มี เดิม branch นี้ `if (physical_count_id)`
     เฉย ๆ ไม่มี else ปุ่ม Start บนแถวที่ยังไม่มีใบจึงกดแล้วเงียบสนิท */
  const handleLocationAction = (item: PhysicalCountLocation) => {
    const periodId = data?.physical_count_period?.id;
    if (!periodId) return;
    openPhysicalCount(item, periodId);
  };

  return (
    <FormPageShell
      width="wide"
      header={
        <DocFormHeader
          leading={
            <span
              aria-hidden="true"
              className="inline-flex size-9 items-center justify-center rounded-xl"
              style={{
                background:
                  "color-mix(in oklch, var(--primary), transparent 88%)",
                color: "var(--primary)",
              }}
            >
              <CalendarRange className="size-5" />
            </span>
          }
          title={t("review")}
          subtitle={t("reviewDesc")}
          backLabel={tc("goBack")}
          onBack={() => navigate("/inventory-management/period-end")}
          actions={
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
                aria-label={tc("refresh")}
              >
                <RefreshCw
                  className={isFetching ? "animate-spin" : undefined}
                  aria-hidden="true"
                />
                <span className="hidden sm:inline">{tc("refresh")}</span>
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirmOpen(true)}
                disabled={!canClose || closeMutation.isPending}
                title={!canClose ? t("notReadyToClose") : undefined}
              >
                <Lock aria-hidden="true" />
                {t("closePeriod")}
              </Button>
            </>
          }
          flush
        />
      }
    >
      <div className="animate-fade-in-up space-y-5">
        {isLoading && (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        )}

        {!isLoading && data && (
          <>
            <section
              aria-label={t("track.title")}
              className="bg-card overflow-hidden rounded-xl border"
            >
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 md:px-5">
                <p className="text-foreground flex items-center gap-2 text-sm font-medium tabular-nums">
                  <CalendarRange
                    className="text-muted-foreground size-4"
                    aria-hidden="true"
                  />
                  {formatLocalizedDate(data.start_date, locale)} –{" "}
                  {formatLocalizedDate(data.end_date, locale)}
                </p>
                <StatusIconLabel
                  status={data.status}
                  label={t(`status.${data.status}`)}
                />
              </div>
              <div className="bg-muted/30 border-t px-4 py-4 md:px-5">
                <PeCloseTrack review={data} />
              </div>
            </section>

            <section aria-labelledby="pe-review-tx" className="space-y-3">
              <header className="flex items-baseline justify-between gap-2">
                <h2 id="pe-review-tx" className="text-sm font-semibold">
                  {t("transactions")}
                </h2>
                <span
                  className={cn(
                    "text-xs tabular-nums",
                    blockingDocs > 0 ? "text-warning-ink" : "text-success-ink",
                  )}
                >
                  {blockingDocs > 0
                    ? t("reviewList.blockersTotal", { count: blockingDocs })
                    : t("reviewList.noBlockers")}
                </span>
              </header>
              <div className="bg-card overflow-hidden rounded-xl border">
                <TxGroupLabel>{t("reviewList.blocksClosing")}</TxGroupLabel>
                <ul className="divide-y">
                  {BLOCKING_KEYS.map((key) => (
                    <TxRow
                      key={key}
                      moduleKey={key}
                      stat={data.details.transaction[key]}
                      blocking={data.close_blocking[CLOSE_BLOCKING_KEY[key]]}
                      onOpen={setDocsKey}
                    />
                  ))}
                </ul>
                <TxGroupLabel>{t("reviewList.reference")}</TxGroupLabel>
                <ul className="divide-y">
                  {REFERENCE_KEYS.map((key) => (
                    <TxRow
                      key={key}
                      moduleKey={key}
                      stat={data.details.transaction[key]}
                      onOpen={setDocsKey}
                    />
                  ))}
                </ul>
              </div>
            </section>

            <section aria-labelledby="pe-review-pc" className="space-y-3">
              <header className="flex items-baseline justify-between gap-2">
                <h2 id="pe-review-pc" className="text-sm font-semibold">
                  {t("physicalCount")}
                </h2>
                {locations.length > 0 && (
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      locationsDone === locations.length
                        ? "text-success-ink"
                        : "text-muted-foreground",
                    )}
                  >
                    {t("locationsCompleted", {
                      completed: locationsDone,
                      total: locations.length,
                    })}
                  </span>
                )}
              </header>
              {locations.length === 0 ? (
                <div className="bg-muted/20 rounded-xl border border-dashed">
                  <EmptyComponent
                    icon={ClipboardList}
                    title={t("noPhysicalCount")}
                  />
                </div>
              ) : (
                <div className="bg-card divide-y overflow-hidden rounded-xl border">
                  {locations.map((item) => (
                    <PcLocationRow
                      key={item.id}
                      item={item}
                      onAction={handleLocationAction}
                      disabled={!isCounting}
                      disabledReason={t("notCountingYet")}
                      pending={pendingLocationId === item.id}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title={t("closeConfirmTitle")}
          description={t("closeConfirmDesc")}
          onConfirm={handleClose}
          isPending={closeMutation.isPending}
          confirmText={t("closePeriod")}
          variant="destructive"
        />

        <PeDocumentsDialog
          open={docsKey !== null}
          onOpenChange={(o) => !o && setDocsKey(null)}
          moduleKey={docsKey}
          stat={docsKey && data ? data.details.transaction[docsKey] : null}
          icon={docsKey ? MODULE_CONFIG[docsKey].icon : ClipboardList}
          color={docsKey ? MODULE_CONFIG[docsKey].color : "var(--primary)"}
        />
      </div>
    </FormPageShell>
  );
}

/** คอลัมน์กว้างคงที่ทุกแถว — ตัวเลขกับแถบต้องตรงกันทั้งตาราง (แบบเดียวกับ `PC_ROW_GRID`) */
const TX_ROW_GRID =
  "grid grid-cols-[minmax(0,1fr)_auto_1rem] items-center gap-x-4 sm:grid-cols-[minmax(0,14rem)_4rem_10rem_minmax(0,1fr)_1rem]";

function TxGroupLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="text-muted-foreground text-micro bg-muted/40 border-y px-4 py-1.5 font-semibold tracking-wide uppercase first:border-t-0">
      {children}
    </p>
  );
}

interface TxRowProps {
  readonly moduleKey: ReviewTransactionKey;
  readonly stat: ReviewTransactionStat;
  /** จำนวนที่กันการปิดงวด (จาก `close_blocking`) — ไม่ส่ง = โมดูลดูประกอบ ไม่กันอะไร */
  readonly blocking?: number;
  readonly onOpen: (key: ReviewTransactionKey) => void;
}

function TxRow({ moduleKey, stat, blocking, onOpen }: TxRowProps) {
  const t = useTranslations("inventoryManagement.periodEnd");
  const { icon: Icon, color } = MODULE_CONFIG[moduleKey];
  const isReference = blocking === undefined;
  const donePercent =
    stat.count === 0 ? 0 : (stat.complete_count / stat.count) * 100;

  let stateText: string;
  let stateClass: string;
  if (stat.count === 0) {
    stateText = t("reviewList.noDocs");
    stateClass = "text-muted-foreground";
  } else if (!isReference && blocking > 0) {
    stateText = t("reviewList.pendingCount", { count: blocking });
    stateClass = "text-warning-ink font-medium";
  } else if (stat.incomplete_count > 0) {
    /* ยังมีใบเปิดแต่ backend ไม่นับว่ากัน (โมดูลดูประกอบ หรือใบที่สถานะไม่ขยับสต๊อก)
       — ห้ามขึ้น "Complete" คู่แถบ 15/17 ที่อยู่ข้าง ๆ */
    stateText = t(
      isReference ? "reviewList.openCount" : "reviewList.openNotBlocking",
      { count: stat.incomplete_count },
    );
    stateClass = "text-muted-foreground";
  } else {
    stateText = t("complete");
    stateClass = "text-success-ink";
  }

  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(moduleKey)}
        aria-label={t("openDocumentsLabel", {
          module: t(`modules.${moduleKey}`),
        })}
        className={`${TX_ROW_GRID} hover:bg-muted/30 focus-visible:ring-ring w-full px-4 py-2.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset`}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <Icon
            className="size-4 shrink-0"
            style={{ color }}
            aria-hidden="true"
          />
          <span className="text-foreground sm:truncate">
            {t(`modules.${moduleKey}`)}
          </span>
        </span>
        <span className="text-foreground hidden text-right font-semibold tabular-nums sm:block">
          {stat.count}
        </span>
        <span className="hidden items-center gap-2 sm:flex">
          <span className="bg-muted h-1.5 flex-1 overflow-hidden rounded-full">
            <span
              className={cn(
                "block h-full rounded-full",
                isReference ? "bg-muted-foreground/40" : "bg-success",
              )}
              style={{ width: `${donePercent}%` }}
            />
          </span>
          <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
            {stat.complete_count}/{stat.count}
          </span>
        </span>
        <span
          className={cn(
            "text-right text-xs tabular-nums sm:text-left",
            stateClass,
          )}
        >
          {stateText}
        </span>
        <ChevronRight
          className="text-muted-foreground size-4"
          aria-hidden="true"
        />
      </button>
    </li>
  );
}
