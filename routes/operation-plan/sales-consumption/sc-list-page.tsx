import { TriangleAlert } from "lucide-react";
import { useTranslations } from "use-intl";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { setURLParams, useURL } from "@/hooks/use-url";
import { usePosWritable } from "../shared/use-pos-writable";
import { usePosOutlets } from "../shared/use-pos-sale";
import { ScCalendar } from "./sc-calendar";
import { ScMapping } from "./sc-mapping";
import { parseMonth } from "./sc-month";
import { ScSummary } from "./sc-summary";
import { ScTable } from "./sc-table";

type View = "calendar" | "list" | "mapping";
const VIEWS: readonly View[] = ["calendar", "list", "mapping"];

/**
 * หน้า Sales Consumption — ปฏิทิน / ตาราง / Mapping สลับด้วย `?view=` เดือนของปฏิทินอยู่ใน `?month=`
 *
 * @returns React element ของหน้า
 */
export function ScListPage() {
  const tm = useTranslations("modules");
  const t = useTranslations("operationPlan.salesConsumption.list");
  const [viewRaw] = useURL("view");
  const [monthRaw] = useURL("month");
  const view: View = VIEWS.includes(viewRaw as View)
    ? (viewRaw as View)
    : "calendar";
  const month = parseMonth(monthRaw);
  const { canWrite: canEditMapping } = usePosWritable();
  const { data: outlets } = usePosOutlets();
  const unmappedOutlets = outlets?.filter((o) => !o.location).length ?? 0;

  return (
    <ListPageShell
      title={tm("salesConsumption")}
      description={t("description")}
    >
      <div className="space-y-4">
        <ScSummary month={month} />

        {unmappedOutlets > 0 && view !== "mapping" && (
          <div
            role="alert"
            className="border-warning/40 bg-warning/10 flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <TriangleAlert aria-hidden className="text-warning-ink size-4" />
            <span className="text-warning-ink flex-1">
              {t("outletWarning", { count: unmappedOutlets })}
            </span>
            {canEditMapping && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setURLParams({ view: "mapping", map: "outlets" })
                }
              >
                {t("outletWarningAction")}
              </Button>
            )}
          </div>
        )}

        <Tabs
          value={view}
          onValueChange={(v) =>
            setURLParams({
              view: v === "calendar" ? "" : v,
              page: "",
              search: "",
            })
          }
        >
          <TabsList>
            {VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {t(`views.${v}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {view === "calendar" && (
          <ScCalendar
            month={month}
            onMonthChange={(m) => setURLParams({ month: m })}
          />
        )}
        {view === "list" && <ScTable />}
        {view === "mapping" && <ScMapping />}
      </div>
    </ListPageShell>
  );
}
