import {
  AlertTriangle,
  CheckCircle2,
  SendHorizontal,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ReviewStatTile } from "./review-stat-tile";
import { VarianceGrid, type VarianceGridItem } from "./variance-grid";
import { DocFormHeader } from "@/components/share/doc-form-header";

interface ReviewComponentProps<T extends VarianceGridItem> {
  readonly translationNamespace: string;
  readonly locationCode?: string;
  readonly locationName?: string;
  readonly matches: number;
  readonly variances: number;
  readonly overages: number;
  readonly shortages: number;
  readonly varianceItems: readonly T[];
  readonly getSystemQty: (item: T) => number;
  readonly getActualQty: (item: T) => number | null;
  readonly getVariance: (item: T) => number;
  readonly getUnitName: (item: T) => string;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
  readonly isSubmitting: boolean;
  readonly submitLabel: string;
  readonly submittingLabel: string;
}

export function ReviewComponent<T extends VarianceGridItem>({
  translationNamespace,
  locationCode,
  locationName,
  matches,
  variances,
  overages,
  shortages,
  varianceItems,
  getSystemQty,
  getActualQty,
  getVariance,
  getUnitName,
  onBack,
  onSubmit,
  isSubmitting,
  submitLabel,
  submittingLabel,
}: ReviewComponentProps<T>) {
  const t = useTranslations(translationNamespace);

  // ไม่ full-bleed (-mx-3) แล้ว — ขอบ p-3 ของ main + px-4 เท่าหน้าเอกสารอื่น
  // ปุ่มย้อนกลับของ DocFormHeader ยื่นออกซ้ายได้โดยไม่โดนขอบจอตัด
  return (
    <div className="relative isolate">
      <div
        className="relative flex min-h-[calc(100vh-4rem-3rem-1.5rem)] flex-col px-4 pt-4"
        style={{
          paddingBottom: "max(7rem, calc(env(safe-area-inset-bottom) + 6rem))",
        }}
      >
        <div className="mb-4">
          <DocFormHeader
            flush
            title={t("reviewTitle")}
            onBack={onBack}
            subtitle={
              (locationCode ?? locationName) && (
                <span className="text-micro-legal tracking-wide uppercase">
                  {locationCode}
                  {locationCode && locationName && (
                    <>
                      {" "}
                      <span className="text-muted-foreground/60">·</span>{" "}
                    </>
                  )}
                  {locationName}
                </span>
              )
            }
          />
        </div>

        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
          <ReviewStatTile
            icon={CheckCircle2}
            tone="success"
            label={t("reviewMatches")}
            value={matches}
            desc={t("reviewMatchesDesc")}
          />
          <ReviewStatTile
            icon={AlertTriangle}
            tone="warning"
            label={t("reviewVariances")}
            value={variances}
            desc={t("reviewVariancesDesc")}
          />
          <ReviewStatTile
            icon={TrendingUp}
            tone="success"
            label={t("reviewOverages")}
            value={overages}
            desc={t("reviewOveragesDesc")}
          />
          <ReviewStatTile
            icon={TrendingDown}
            tone="destructive"
            label={t("reviewShortages")}
            value={shortages}
            desc={t("reviewShortagesDesc")}
          />
        </div>

        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <AlertTriangle
              className="text-warning-ink size-4"
              aria-hidden="true"
            />
            <h2 className="text-foreground text-sm font-semibold tracking-tight">
              {t("varianceDetails")}
            </h2>
            <span className="bg-muted/60 text-muted-foreground text-micro-legal rounded-full px-2 py-0.5 font-semibold tabular-nums">
              {variances}
            </span>
          </div>

          {variances === 0 ? (
            <div className="border-success/30 bg-success/5 flex items-center justify-center gap-2 rounded-xl border border-dashed py-8">
              <CheckCircle2 className="text-success-ink size-4" />
              <span className="text-foreground/80 text-xs">
                {t("noVariances")}
              </span>
            </div>
          ) : (
            <VarianceGrid<T>
              items={varianceItems}
              getSystemQty={getSystemQty}
              getActualQty={getActualQty}
              getVariance={getVariance}
              getUnitName={getUnitName}
              translationNamespace={translationNamespace}
            />
          )}
        </section>

        <div className="border-border/60 bg-card/80 fixed inset-x-0 bottom-0 z-30 border-t px-4 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button size="sm" onClick={onSubmit} disabled={isSubmitting}>
              <SendHorizontal aria-hidden="true" />
              {isSubmitting ? submittingLabel : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
