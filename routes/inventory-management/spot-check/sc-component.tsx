import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { ClipboardCheck, History, MapPin, PauseCircle } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { EntityMultiFilter } from "@/components/filter/entity-multi-filter";
import { useLocation } from "@/hooks/use-location";
import {
  useLookupPagination,
  ACTIVE_ONLY_FILTER,
} from "@/hooks/use-lookup-pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type { Location } from "@/types/location";
import { useSpotCheckCurrent } from "./use-sc-current";
import { useSpotCheck } from "./use-sc";
import { ErrorState } from "@/components/ui/error-state";
import {
  SPOT_CHECK_METHODS,
  getSpotCheckMethodLabel,
} from "@/constant/spot-check-method";
import type {
  SpotCheck,
  SpotCheckLocation,
  SpotCheckLocationLatest,
  SpotCheckStatus,
} from "@/types/spot-check";
import { ListPageShell } from "@/components/share/list-page-shell";
import {
  InvSearchBar,
  InvStatusSectionsList,
  StatusStrip,
  StripMetric,
  type InvStatusSection,
  type SectionTone,
} from "../shared/inv-shared";
import { ScHistoryCard } from "./sc-history-card";
import { ScLocationRow } from "./sc-location-row";

type StatusKey = "resume" | "not_started";
type ViewMode = "locations" | "history";

// ค่าที่ server รับจริง (enum_spot_check_status) — ค่าอื่นได้ 400 ทั้ง request
const HISTORY_STATUS_KEYS: SpotCheckStatus[] = [
  "pending",
  "in_progress",
  "completed",
  "void",
];

export default function ScComponent() {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const navigate = useNavigate();
  const [view, setView] = useState<ViewMode>("locations");
  const [search, setSearch] = useState("");
  const [includeNotCount, setIncludeNotCount] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | StatusKey>("all");
  const [historyLocation, setHistoryLocation] = useState("");
  const [historyStatus, setHistoryStatus] = useState("");
  const [historyMethod, setHistoryMethod] = useState("");

  const {
    data: locations = [],
    isLoading: isLoadingLocations,
    error: locationsError,
    refetch: refetchLocations,
  } = useSpotCheckCurrent(includeNotCount);

  const debouncedSearch = useDebouncedValue(search, 300);
  // ตัวกรองทั้งหมดทำที่ server — หลาย clause คั่นด้วย `,` (AND) ค่าในแต่ละ clause เป็น IN
  const historyFilter =
    [
      historyStatus && `doc_status|string:${historyStatus}`,
      historyMethod && `method|string:${historyMethod}`,
      historyLocation && `location_id|string:${historyLocation}`,
    ]
      .filter(Boolean)
      .join(",") || undefined;
  const {
    items: historyItems,
    isLoading: isLoadingHistory,
    isLoadingMore: isLoadingMoreHistory,
    hasMore: hasMoreHistory,
    loadMore: loadMoreHistory,
    error: historyError,
    refetch: refetchHistory,
  } = useLookupPagination<SpotCheck>({
    useListHook: useSpotCheck,
    // server ค้น spot_check_no + ชื่อ location (ไม่ค้นรหัส location — ใช้ตัวกรอง location แทน)
    search: view === "history" ? debouncedSearch : "",
    serverFilter: historyFilter,
    sort: "created_at:desc",
    enabled: view === "history",
  });

  const resume: SpotCheckLocation[] = [];
  const notStarted: SpotCheckLocation[] = [];
  for (const l of locations) {
    if (l.latest_spot_check === null) {
      notStarted.push(l);
    } else {
      resume.push(l);
    }
  }
  let itemsTotal = 0;
  let itemsCounted = 0;
  for (const l of resume) {
    itemsTotal += l.latest_spot_check?.size ?? 0;
    itemsCounted += l.latest_spot_check?.counted ?? 0;
  }
  const counts = {
    all: locations.length,
    resume: resume.length,
    notStarted: notStarted.length,
  };

  const filterLocationByQuery = (list: SpotCheckLocation[]) => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(
      (l) =>
        l.name.toLowerCase().includes(q) || l.code.toLowerCase().includes(q),
    );
  };

  const allSections: InvStatusSection<SpotCheckLocation>[] = [
    {
      key: "resume",
      title: t("tabResume"),
      icon: PauseCircle,
      tone: "warning" satisfies SectionTone,
      items: filterLocationByQuery(resume),
    },
    {
      key: "not_started",
      title: t("tabNotStarted"),
      icon: ClipboardCheck,
      tone: "info" satisfies SectionTone,
      items: filterLocationByQuery(notStarted),
    },
  ];
  const sections = allSections.filter(
    (s) =>
      (activeFilter === "all" || activeFilter === s.key) &&
      (s.items.length > 0 || activeFilter === s.key),
  );

  const statusOptions = HISTORY_STATUS_KEYS.map((key) => ({
    value: key,
    label: ts(key),
  }));

  const methodOptions = SPOT_CHECK_METHODS.map((m) => ({
    value: m,
    label: getSpotCheckMethodLabel(t, m),
  }));

  const historySections: InvStatusSection<SpotCheck>[] = [
    {
      key: "history",
      title: t("viewHistory"),
      icon: History,
      tone: "info" satisfies SectionTone,
      items: historyItems,
    },
  ];

  const handleStart = (item: SpotCheckLocation) => {
    navigate(
      `/inventory-management/spot-check/location/${item.location_id}`,
      listReturnState(),
    );
  };

  const handleResume = (
    _item: SpotCheckLocation,
    latest: SpotCheckLocationLatest,
  ) => {
    navigate(
      `/inventory-management/spot-check/${latest.id}`,
      listReturnState(),
    );
  };

  const handleHistoryClick = (sc: SpotCheck) => {
    navigate(`/inventory-management/spot-check/${sc.id}`, listReturnState());
  };

  const isLocationsView = view === "locations";
  const error = isLocationsView ? locationsError : historyError;
  const refetch = isLocationsView ? refetchLocations : refetchHistory;

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={locations.length}
      actions={<ViewToggle view={view} setView={setView} t={t} />}
    >
      {isLocationsView && (
        <StatusStrip<StatusKey>
          allLabel={t("tabAll")}
          active={activeFilter}
          onSelect={setActiveFilter}
          segments={[
            {
              key: "resume",
              label: t("tabResume"),
              value: counts.resume,
              tone: "warning",
            },
            {
              key: "not_started",
              label: t("tabNotStarted"),
              value: counts.notStarted,
              tone: "info",
            },
          ]}
          metric={
            <StripMetric
              label={t("checkProgress")}
              done={itemsCounted}
              total={itemsTotal}
              unit={tfl("items").toLowerCase()}
            />
          }
        />
      )}

      <InvSearchBar
        search={search}
        onSearch={setSearch}
        extras={
          isLocationsView ? (
            <label className="border-border/40 bg-card hover:border-foreground/40 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold select-none">
              <Checkbox
                checked={includeNotCount}
                onCheckedChange={(v) => setIncludeNotCount(v === true)}
              />
              {t("includeNotCount")}
            </label>
          ) : (
            <HistoryFilters
              locationValue={historyLocation}
              onLocationChange={setHistoryLocation}
              statusValue={historyStatus}
              onStatusChange={setHistoryStatus}
              statusOptions={statusOptions}
              methodValue={historyMethod}
              onMethodChange={setHistoryMethod}
              methodOptions={methodOptions}
              labels={{
                location: tfl("location"),
                status: tfl("status"),
                method: tfl("method"),
              }}
            />
          )
        }
      />

      {isLocationsView && (
        <InvStatusSectionsList<SpotCheckLocation>
          sections={sections}
          emptyTitle={t("noLocationsInStatus")}
          renderItem={(item, tone) => (
            <ScLocationRow
              item={item}
              tone={tone}
              onStart={handleStart}
              onResume={handleResume}
            />
          )}
          getItemKey={(item) => item.location_id}
          isLoading={isLoadingLocations}
        />
      )}

      {!isLocationsView && (
        <>
          <InvStatusSectionsList<SpotCheck>
            sections={historySections}
            emptyTitle={t("noHistory")}
            renderItem={(sc) => (
              <ScHistoryCard spotCheck={sc} onClick={handleHistoryClick} />
            )}
            getItemKey={(sc) => sc.id}
            isLoading={isLoadingHistory}
            showGlobalEmpty={false}
            layout="cards"
          />
          {hasMoreHistory && (
            <div className="mt-4 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={loadMoreHistory}
                disabled={isLoadingMoreHistory}
              >
                {isLoadingMoreHistory
                  ? t("loadingMoreHistory")
                  : t("loadMoreHistory")}
              </Button>
            </div>
          )}
        </>
      )}
    </ListPageShell>
  );
}

interface FilterOption {
  readonly value: string;
  readonly label: string;
}

function HistoryFilters({
  locationValue,
  onLocationChange,
  statusValue,
  onStatusChange,
  statusOptions,
  methodValue,
  onMethodChange,
  methodOptions,
  labels,
}: {
  readonly locationValue: string;
  readonly onLocationChange: (v: string) => void;
  readonly statusValue: string;
  readonly onStatusChange: (v: string) => void;
  readonly statusOptions: readonly FilterOption[];
  readonly methodValue: string;
  readonly onMethodChange: (v: string) => void;
  readonly methodOptions: readonly FilterOption[];
  readonly labels: { location: string; status: string; method: string };
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <EntityMultiFilter<Location>
        value={locationValue}
        onChange={onLocationChange}
        fieldKey="location_id"
        label={labels.location}
        useListHook={useLocation}
        getId={(l) => l.id}
        getLabel={(l) => `${l.code} · ${l.name}`}
        serverFilter={ACTIVE_ONLY_FILTER}
        bareIds
      />
      <MultiSelectFilter
        value={statusValue}
        onChange={onStatusChange}
        placeholder={labels.status}
        options={[...statusOptions]}
      />
      <MultiSelectFilter
        value={methodValue}
        onChange={onMethodChange}
        placeholder={labels.method}
        options={[...methodOptions]}
      />
    </div>
  );
}

function ViewToggle({
  view,
  setView,
  t,
}: {
  readonly view: ViewMode;
  readonly setView: (v: ViewMode) => void;
  readonly t: (key: string) => string;
}) {
  return (
    <div className="border-border/40 bg-card inline-flex items-center gap-0.5 rounded-full border p-0.5">
      <Button
        type="button"
        size="sm"
        variant={view === "locations" ? "default" : "ghost"}
        onClick={() => setView("locations")}
        className="text-micro h-7 rounded-full px-3 font-semibold tracking-wide"
      >
        <MapPin className="size-3" aria-hidden="true" />
        {t("viewLocations")}
      </Button>
      <Button
        type="button"
        size="sm"
        variant={view === "history" ? "default" : "ghost"}
        onClick={() => setView("history")}
        className="text-micro h-7 rounded-full px-3 font-semibold tracking-wide"
      >
        <History className="size-3" aria-hidden="true" />
        {t("viewHistory")}
      </Button>
    </div>
  );
}
