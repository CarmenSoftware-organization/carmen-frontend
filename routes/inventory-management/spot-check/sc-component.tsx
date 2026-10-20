import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { ClipboardCheck, PauseCircle } from "lucide-react";
import { useTranslations } from "use-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { useSpotCheckCurrent } from "./use-sc-current";
import { ErrorState } from "@/components/ui/error-state";
import type {
  SpotCheckLocation,
  SpotCheckLocationLatest,
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
import { ScLocationRow } from "./sc-location-row";
import { ScViewToggle } from "./sc-view-toggle";
import { SC_LIST_PATH } from "./sc-paths";

type StatusKey = "resume" | "not_started";

/** มุมมอง Locations — History อยู่ที่ `sc-history-component.tsx` (route `/history`) */
export default function ScComponent() {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tfl = useTranslations("field");
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [includeNotCount, setIncludeNotCount] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | StatusKey>("all");

  const {
    data: locations = [],
    isLoading,
    error,
    refetch,
  } = useSpotCheckCurrent(includeNotCount);

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

  const handleStart = (item: SpotCheckLocation) => {
    navigate(`${SC_LIST_PATH}/location/${item.location_id}`, listReturnState());
  };

  const handleResume = (
    _item: SpotCheckLocation,
    latest: SpotCheckLocationLatest,
  ) => {
    navigate(`${SC_LIST_PATH}/${latest.id}`, listReturnState());
  };

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={locations.length}
      actions={<ScViewToggle view="locations" />}
    >
      <StatusStrip<StatusKey>
        allLabel={t("tabAll")}
        active={activeFilter}
        onSelect={setActiveFilter}
        segments={[
          {
            key: "resume",
            label: t("tabResume"),
            value: resume.length,
            tone: "warning",
          },
          {
            key: "not_started",
            label: t("tabNotStarted"),
            value: notStarted.length,
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
        isLoading={isLoading}
      />
    </ListPageShell>
  );
}
