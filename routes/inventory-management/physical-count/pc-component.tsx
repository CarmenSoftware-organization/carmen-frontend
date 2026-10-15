import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import {
  Calendar,
  CalendarRange,
  CheckCircle2,
  ClipboardCheck,
  Construction,
  PauseCircle,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { STATUS_DOT_CHIP } from "@/constant/status-config";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LookupPhysicalCountPeriod } from "@/components/lookup/lookup-physical-count-period";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  usePhysicalCountPeriodCurrent,
  usePhysicalCountPeriodDetail,
} from "@/hooks/use-physical-count-period";
import { useOpenPhysicalCount } from "../shared/use-open-physical-count";
import { useLocale } from "@/hooks/use-locale";
import { formatDate as formatDateUtil } from "@/lib/date-utils";
import { ErrorState } from "@/components/ui/error-state";
import type {
  PhysicalCountLocation,
  PhysicalCountStatus,
} from "@/types/physical-count";
import { ListPageShell } from "@/components/share/list-page-shell";
import {
  InvSearchBar,
  InvStatusSectionsList,
  StatusStrip,
  StripMetric,
  type InvStatusSection,
  type SectionTone,
} from "../shared/inv-shared";
import { PcLocationRow } from "../shared/pc-location-row";

type StatusKey = PhysicalCountStatus;

// periodCode รูปแบบ "YYYY-MM" (เช่น "2026-05")
const formatPeriodTitle = (periodCode: string): string => {
  const [year, month] = periodCode.split("-").map(Number);
  if (!year || !month) return periodCode;
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric" });
};

interface PeriodHeaderProps {
  readonly title: string;
  readonly endDate: string;
  readonly hasPeriod: boolean;
  readonly isLoading: boolean;
  readonly isPreviousPeriod: boolean;
  readonly previousPeriodId: string;
  readonly onPeriodChange: (id: string) => void;
}

function PeriodHeader({
  title,
  endDate,
  hasPeriod,
  isLoading,
  isPreviousPeriod,
  previousPeriodId,
  onPeriodChange,
}: PeriodHeaderProps) {
  const t = useTranslations("inventoryManagement.physicalCount");
  const tfl = useTranslations("field");

  const periodBadge = (
    <Badge
      size="xs"
      className={cn(
        STATUS_DOT_CHIP,
        isPreviousPeriod ? "before:bg-muted-foreground/40" : "before:bg-info",
      )}
    >
      {isPreviousPeriod ? t("previousPeriod") : t("currentPeriod")}
    </Badge>
  );

  const emptyText = isLoading ? "" : t("noPeriod");

  return (
    <>
      {hasPeriod ? (
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-foreground text-base font-semibold tracking-tight">
              {title}
            </h2>
            {periodBadge}
          </div>
          <div className="text-muted-foreground text-micro flex flex-wrap items-center gap-1.5">
            <Calendar className="size-2.5 shrink-0" aria-hidden="true" />
            <span>{t("periodEnds", { date: endDate })}</span>
          </div>
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{emptyText}</p>
      )}
      <div>
        <label className="text-muted-foreground text-micro-eyebrow mb-1 flex items-center gap-1 font-semibold tracking-widest uppercase">
          <CalendarRange className="size-2.5" aria-hidden="true" />
          {tfl("physicalCountPeriod")}
        </label>
        <LookupPhysicalCountPeriod
          value={previousPeriodId}
          onValueChange={onPeriodChange}
        />
      </div>
    </>
  );
}

export default function PcComponent() {
  const t = useTranslations("inventoryManagement.physicalCount");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const { dateFormat } = useLocale();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [includeNotCount, setIncludeNotCount] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | StatusKey>("all");
  const [showNotImplemented, setShowNotImplemented] = useState(false);
  const [showNotCounting, setShowNotCounting] = useState(false);
  const [previousPeriodId, setPreviousPeriodId] = useState("");

  const {
    data: currentPeriod,
    isLoading: isLoadingCurrent,
    error: errorCurrent,
    refetch,
  } = usePhysicalCountPeriodCurrent(includeNotCount);
  const {
    data: selectedPeriod,
    isLoading: isLoadingSelected,
    error: errorSelected,
  } = usePhysicalCountPeriodDetail(
    previousPeriodId || undefined,
    includeNotCount,
  );
  const { open: openPhysicalCount, pendingLocationId } = useOpenPhysicalCount();

  const period = previousPeriodId ? selectedPeriod : currentPeriod;
  const isLoading = previousPeriodId ? isLoadingSelected : isLoadingCurrent;
  const error = previousPeriodId ? errorSelected : errorCurrent;
  const isPreviousPeriod = !!previousPeriodId;

  const locations = period?.locations ?? [];

  const inProgress: PhysicalCountLocation[] = [];
  const notStarted: PhysicalCountLocation[] = [];
  const complete: PhysicalCountLocation[] = [];
  for (const l of locations) {
    if (l.physical_count_status === "in_progress") inProgress.push(l);
    else if (l.physical_count_status === "completed") complete.push(l);
    else notStarted.push(l);
  }
  let itemsTotal = 0;
  let itemsCounted = 0;
  for (const l of locations) {
    itemsTotal += l.product_total ?? 0;
    itemsCounted += l.product_counted ?? 0;
  }
  const counts = {
    all: locations.length,
    inProgress: inProgress.length,
    notStarted: notStarted.length,
    complete: complete.length,
  };

  const filterByQuery = (list: PhysicalCountLocation[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (l) =>
        l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  };

  const allSections: InvStatusSection<PhysicalCountLocation>[] = [
    {
      key: "in_progress",
      title: t("tabInProgress"),
      icon: PauseCircle,
      tone: "warning" satisfies SectionTone,
      items: filterByQuery(inProgress),
    },
    {
      key: "not_started",
      title: t("tabNotStarted"),
      icon: ClipboardCheck,
      tone: "info" satisfies SectionTone,
      items: filterByQuery(notStarted),
    },
    {
      key: "completed",
      title: t("tabComplete"),
      icon: CheckCircle2,
      tone: "success" satisfies SectionTone,
      items: filterByQuery(complete),
    },
  ];
  const sections = allSections.filter(
    (s) =>
      (activeFilter === "all" || activeFilter === s.key) &&
      (s.items.length > 0 || activeFilter === s.key),
  );

  const handleAction = (item: PhysicalCountLocation) => {
    if (item.physical_count_status === "completed") {
      setShowNotImplemented(true);
      return;
    }

    if (item.physical_count_id) {
      navigate(
        `/inventory-management/physical-count/${item.physical_count_id}/entry`,
        listReturnState(),
      );
      return;
    }

    if (!period) return;

    // ใบนับสร้างได้ต่อเมื่อรอบตรวจนับเป็น `counting` — บอกให้ไปเปิดรอบที่หน้า Period End
    // ดีกว่าปล่อยให้ยิงแล้วโดน 400 ตีกลับเป็น toast ที่อ่านไม่รู้เรื่อง
    if (period.status !== "counting") {
      setShowNotCounting(true);
      return;
    }

    openPhysicalCount(item, period.id);
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const periodTitle = period
    ? formatPeriodTitle(period.tb_inventory_period.period)
    : "";

  const periodEndDate = period
    ? formatDateUtil(period.tb_inventory_period.end_at, dateFormat)
    : "";

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={locations.length}
    >
      <StatusStrip<StatusKey>
        allLabel={t("tabAll")}
        active={activeFilter}
        onSelect={setActiveFilter}
        segments={[
          {
            key: "in_progress",
            label: t("tabInProgress"),
            value: counts.inProgress,
            tone: "warning",
          },
          {
            key: "not_started",
            label: t("tabNotStarted"),
            value: counts.notStarted,
            tone: "info",
          },
          {
            key: "completed",
            label: t("tabComplete"),
            value: counts.complete,
            tone: "success",
          },
        ]}
        header={
          <PeriodHeader
            title={periodTitle}
            endDate={periodEndDate}
            hasPeriod={!!period}
            isLoading={isLoading}
            isPreviousPeriod={isPreviousPeriod}
            previousPeriodId={previousPeriodId}
            onPeriodChange={setPreviousPeriodId}
          />
        }
        metric={
          period && (
            <StripMetric
              label={t("checkProgress")}
              done={itemsCounted}
              total={itemsTotal}
              unit={tfl("items").toLowerCase()}
            />
          )
        }
      />

      {period && (
        <InvSearchBar
          search={search}
          onSearch={setSearch}
          extras={
            <label className="border-border/40 bg-card hover:border-foreground/40 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold select-none">
              <Checkbox
                checked={includeNotCount}
                onCheckedChange={(v) => setIncludeNotCount(v === true)}
              />
              {t("includeNotCount")}
            </label>
          }
        />
      )}

      {period && (
        <InvStatusSectionsList<PhysicalCountLocation>
          sections={sections}
          emptyTitle={t("noLocationsInStatus")}
          renderItem={(item) => (
            <PcLocationRow
              item={item}
              onAction={handleAction}
              pending={pendingLocationId === item.id}
            />
          )}
          getItemKey={(item) => item.id}
          isLoading={isLoading}
        />
      )}

      <Dialog open={showNotCounting} onOpenChange={setShowNotCounting}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <CalendarRange className="size-4" aria-hidden="true" />
              {t("countingNotStarted")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("countingNotStartedDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNotCounting(false)}
            >
              {tc("close")}
            </Button>
            <Button asChild size="sm">
              <Link to="/inventory-management/period-end">
                {t("goToPeriodEnd")}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showNotImplemented} onOpenChange={setShowNotImplemented}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Construction className="size-4" aria-hidden="true" />
              {tc("comingSoon")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {t("notImplemented")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" onClick={() => setShowNotImplemented(false)}>
              {tc("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ListPageShell>
  );
}
