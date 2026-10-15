import {
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  FileText,
  Lock,
  MapPin,
  PackageCheck,
  PackageMinus,
  PackagePlus,
  Receipt,
  RefreshCw,
  ShoppingCart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useState } from "react";
import { toast } from "sonner";
import EmptyComponent from "@/components/empty-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormPageShell } from "@/components/share/form-page-shell";
import { DocFormHeader } from "@/components/share/doc-form-header";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { useClosePeriodEnd, usePeriodEndReview } from "./use-period-end";
import type { ReviewTransactionKey } from "@/types/period-end";
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

const TRANSACTION_KEYS = Object.keys(MODULE_CONFIG) as ReviewTransactionKey[];

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

  const transactionEntries = data
    ? TRANSACTION_KEYS.map((key) => ({
        key,
        stat: data.details.transaction[key],
        isDone: data.details.transaction[key].is_complete,
      }))
    : [];
  const txTotal = transactionEntries.reduce((sum, e) => sum + e.stat.count, 0);
  const txDone = transactionEntries.filter((e) => e.isDone).length;

  const locations = data?.details.physical_count ?? [];
  const locationsDone = locations.filter(
    (p) => p.physical_count_status === "completed",
  ).length;
  const locationsPercent =
    locations.length === 0 ? 0 : (locationsDone / locations.length) * 100;

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
            <Card
              className="border-l-4"
              style={{ borderLeftColor: "var(--primary)" }}
            >
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <CalendarRange
                    className="text-muted-foreground/70 size-4"
                    aria-hidden="true"
                  />
                  {formatLocalizedDate(data.start_date, locale)} –{" "}
                  {formatLocalizedDate(data.end_date, locale)}
                </CardTitle>
                <CardAction>
                  <StatusIconLabel
                    status={data.status}
                    label={t(`status.${data.status}`)}
                  />
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <SummaryStat
                    label={t("transactionsTotal")}
                    value={txTotal}
                    hint={`${txDone}/${TRANSACTION_KEYS.length}`}
                    tone={
                      txDone === TRANSACTION_KEYS.length ? "success" : "warning"
                    }
                  />
                  <SummaryStat
                    label={t("locationsAll")}
                    value={locations.length}
                    hint={t("locationsCompleted", {
                      completed: locationsDone,
                      total: locations.length,
                    })}
                    tone={
                      locations.length > 0 && locationsDone === locations.length
                        ? "success"
                        : "warning"
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <section className="space-y-3">
              <header className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="bg-primary/10 text-primary inline-flex size-7 items-center justify-center rounded-lg"
                >
                  <Sparkles className="size-3.5" />
                </span>
                <h2 className="text-sm font-semibold">{t("transactions")}</h2>
              </header>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
                {transactionEntries.map(({ key, stat, isDone }, index) => {
                  const moduleConfig = MODULE_CONFIG[key];
                  const Icon = moduleConfig.icon;
                  return (
                    <Card
                      key={key}
                      role="button"
                      tabIndex={0}
                      aria-label={t("openDocumentsLabel", {
                        module: t(`modules.${key}`),
                      })}
                      onClick={() => setDocsKey(key)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDocsKey(key);
                        }
                      }}
                      className="animate-fade-in-up group focus-visible:ring-ring hover:border-primary/40 cursor-pointer transition hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span
                            aria-hidden="true"
                            className="inline-flex size-8 items-center justify-center rounded-lg"
                            style={{
                              background: `color-mix(in oklch, ${moduleConfig.color}, transparent 86%)`,
                              color: moduleConfig.color,
                            }}
                          >
                            <Icon className="size-4" />
                          </span>
                          {isDone && (
                            <CheckCircle2
                              className="text-success-ink size-4"
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div>
                          <p className="text-muted-foreground text-micro font-semibold tracking-wide uppercase">
                            {t(`modules.${key}`)}
                          </p>
                          <p className="text-foreground mt-0.5 text-2xl font-semibold tabular-nums">
                            {stat.count}
                          </p>
                        </div>
                        <Badge
                          variant={isDone ? "success-light" : "warning-light"}
                          size="xs"
                        >
                          {isDone ? t("complete") : t("incomplete")}
                        </Badge>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>

            <section className="space-y-3">
              <header className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="bg-primary/10 text-primary inline-flex size-7 items-center justify-center rounded-lg"
                  >
                    <MapPin className="size-3.5" />
                  </span>
                  <h2 className="text-sm font-semibold">
                    {t("physicalCount")}
                  </h2>
                </div>
                {locations.length > 0 && (
                  <Badge
                    variant={
                      locationsDone === locations.length
                        ? "success-light"
                        : "warning-light"
                    }
                    size="xs"
                  >
                    {t("locationsCompleted", {
                      completed: locationsDone,
                      total: locations.length,
                    })}
                  </Badge>
                )}
              </header>
              {locations.length === 0 ? (
                <Card>
                  <CardContent>
                    <EmptyComponent
                      icon={ClipboardList}
                      title={t("noPhysicalCount")}
                    />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-3">
                  <Progress
                    value={locationsPercent}
                    variant="auto"
                    className="h-1.5"
                  />
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

interface SummaryStatProps {
  readonly label: string;
  readonly value: number;
  readonly hint: string;
  readonly tone: "success" | "warning";
}

function SummaryStat({ label, value, hint, tone }: SummaryStatProps) {
  const toneClass =
    tone === "success"
      ? "bg-success/10 text-success-foreground"
      : "bg-warning/10 text-warning-foreground";
  return (
    <div className="border-border/60 bg-muted/30 space-y-1 rounded-lg border p-3">
      <p className="text-muted-foreground text-micro font-semibold tracking-[0.18em] uppercase">
        {label}
      </p>
      <p className="text-foreground text-2xl font-semibold tabular-nums">
        {value}
      </p>
      <span
        className={`text-micro inline-flex items-center rounded-full px-2 py-0.5 font-semibold ${toneClass}`}
      >
        {hint}
      </span>
    </div>
  );
}
