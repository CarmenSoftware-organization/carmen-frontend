import {
  ArrowRight,
  CalendarClock,
  CalendarRange,
  PlayCircle,
} from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  usePeriodEndCurrent,
  usePeriodEndReview,
  useStartPeriodCounting,
} from "./use-period-end";
import { usePhysicalCountPeriodCurrent } from "@/hooks/use-physical-count-period";
import { ApiError } from "@/lib/api-error";
import PeHistory from "./pe-history";
import { PeCloseTrack } from "./pe-close-track";
import { PeStartBlockedDialog } from "./pe-start-blocked-dialog";
import { formatLocalizedDate } from "@/lib/date-utils";
import type { StartCountingBlockers } from "@/types/period-end";

const isStartCountingBlockers = (
  value: unknown,
): value is StartCountingBlockers =>
  typeof value === "object" &&
  value !== null &&
  "documents" in value &&
  "total" in value;

export default function PeComponent() {
  const locale = useLocale();
  const navigate = useNavigate();
  const t = useTranslations("inventoryManagement.periodEnd");
  const { data, isLoading, isError } = usePeriodEndCurrent();
  const { data: countingRound } = usePhysicalCountPeriodCurrent();
  const { data: review, isLoading: isReviewLoading } = usePeriodEndReview();
  const startCounting = useStartPeriodCounting();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [blockers, setBlockers] = useState<StartCountingBlockers | null>(null);

  const statusKey = data?.status ?? "open";

  // รอบเปิดแล้ว = ปุ่มพาไปหน้า review ตรง ๆ ไม่ต้อง POST ซ้ำและไม่ต้องถามยืนยัน
  const isCounting = countingRound?.status === "counting";
  const reviewPath = "/inventory-management/period-end/review";

  const handleStart = () => {
    startCounting.mutate(undefined, {
      onSuccess: () => {
        setConfirmOpen(false);
        toast.success(t("startCountingSuccess"));
        navigate(reviewPath);
      },
      onError: (error) => {
        setConfirmOpen(false);
        // 422 พก `{ counts, total, documents }` มาใน error body ให้ลิสต์เอกสารที่ค้างได้
        // ส่วน error อื่นตกไปที่ toast ตามปกติ (5xx จะได้ undefined โดยตั้งใจ ไม่ให้ internal หลุด)
        if (
          error instanceof ApiError &&
          isStartCountingBlockers(error.details)
        ) {
          setBlockers(error.details);
          return;
        }
        toast.error(
          (error instanceof ApiError && error.userFacingServerMessage) ||
            t("startCountingFailed"),
        );
      },
    });
  };

  return (
    <div className="animate-fade-in-up space-y-6 p-3 md:p-4">
      <section className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="bg-primary/10 text-primary inline-flex size-9 items-center justify-center rounded-xl"
        >
          <CalendarRange className="size-5" />
        </span>
        <div>
          <h1 className="text-foreground text-xl font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("desc")}</p>
        </div>
      </section>

      {isLoading && <Skeleton className="h-52 w-full rounded-xl" />}

      {!isLoading && (isError || !data) && (
        <div
          aria-live="polite"
          className="text-muted-foreground flex items-center gap-2 rounded-xl border border-dashed p-4 text-sm"
        >
          <CalendarClock className="size-4" aria-hidden="true" />
          {t("noCurrent")}
        </div>
      )}

      {!isLoading && data && (
        <section
          aria-labelledby="pe-current-period"
          className="bg-card overflow-hidden rounded-xl border"
        >
          <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4 p-4 md:p-5">
            <div className="min-w-0 space-y-1">
              <p className="text-muted-foreground text-micro font-semibold tracking-[0.18em] uppercase">
                {t("current")}
              </p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2
                  id="pe-current-period"
                  className="text-foreground text-3xl font-semibold tracking-tight tabular-nums"
                >
                  {data.period}
                </h2>
                <StatusIconLabel
                  status={statusKey}
                  label={t(`status.${statusKey}`)}
                />
              </div>
              <p className="text-muted-foreground text-sm tabular-nums">
                {formatLocalizedDate(data.start_at, locale)} –{" "}
                {formatLocalizedDate(data.end_at, locale)}
                <span aria-hidden="true"> · </span>
                {t("fields.fiscalYear")} {data.fiscal_year}
                <span aria-hidden="true"> · </span>
                {t("fields.fiscalMonth")} {data.fiscal_month}
              </p>
              {data.note && (
                <p className="text-foreground max-w-prose pt-1 text-sm">
                  {data.note}
                </p>
              )}
            </div>
            <Button
              onClick={() =>
                isCounting ? navigate(reviewPath) : setConfirmOpen(true)
              }
              disabled={statusKey !== "open" || startCounting.isPending}
            >
              {isCounting ? (
                <ArrowRight aria-hidden="true" />
              ) : (
                <PlayCircle aria-hidden="true" />
              )}
              {isCounting ? t("continueCounting") : t("startClose")}
            </Button>
          </div>

          {/* รางสามขั้นอ่านจาก review — ถ้าโหลดไม่ได้ก็แค่ไม่แสดง ไม่บังปุ่มด้านบน */}
          {review && (
            <div className="bg-muted/30 border-t px-4 py-4 md:px-5">
              <PeCloseTrack review={review} />
            </div>
          )}
          {!review && isReviewLoading && (
            <div className="border-t px-4 py-4 md:px-5">
              <Skeleton className="h-12 w-full rounded-lg" />
            </div>
          )}
        </section>
      )}

      <PeHistory />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("startCountingConfirmTitle")}
        description={t("startCountingConfirmDesc")}
        onConfirm={handleStart}
        isPending={startCounting.isPending}
        confirmText={t("startClose")}
      />

      <PeStartBlockedDialog
        open={blockers !== null}
        onOpenChange={(open) => !open && setBlockers(null)}
        blockers={blockers}
      />
    </div>
  );
}
