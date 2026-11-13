import { useTranslations } from "use-intl";
import {
  BarCard,
  KpiCard,
  LineCard,
  PieCard,
  LazyWidget,
  WidgetSkeleton,
} from "@/components/dashboard-widget/dashboard-widget-grid";
import { BuWidgetSection } from "@/components/dashboard-widget/bu-widget-section";
import { gridClasses } from "@/components/dashboard-widget/widget-display";
import { AppTile } from "@/components/icons/tiles";
import { useOperationPlanWidgets } from "@/hooks/use-dashboard-widgets";

const MODULE_NAME = "operationPlan";

const HIDDEN_DATASETS = new Set<string>([]);

const DATASET_TO_SUB_TILE: Record<string, string> = {
  "recipe.total-active": "operationRecipe",
  "recipe.added-7d": "operationRecipe",
  "recipe.average-ingredients": "operationRecipe",
  "recipe.cuisines-total": "operationCuisine",
  "recipe.by-cuisine-top": "operationCuisine",
  "recipe.by-category-top": "operationCategory",
  "recipe.most-complex": "operationRecipe",
  "recipe.added-daily": "operationRecipe",
  "equipment.total-active": "operationEquipment",
  "equipment.by-category": "operationEquipmentCategory",
};

function subTileFor(datasetId: string): string {
  return DATASET_TO_SUB_TILE[datasetId] ?? "operationRecipe";
}

export default function OperationDashboard() {
  const t = useTranslations("operationPlan.dashboard");
  const td = useTranslations("dashboardWidget");
  const tBu = useTranslations("dashboard.buWidget");
  const { data, isLoading, isError, error } = useOperationPlanWidgets();

  // เรียงจาก config ล้วน — ค่าของแต่ละใบมาทีหลังแยกกัน (ดู `LazyWidget`)
  const widgets = (data?.items ?? [])
    .filter((w) => !HIDDEN_DATASETS.has(w.dataset_id))
    .slice()
    .sort((a, b) => a.order_index - b.order_index);

  const kpis = widgets.filter(
    (w) => w.widget_type === "kpi" || w.widget_type === "gauge",
  );
  const pies = widgets.filter((w) => w.widget_type === "pie");
  const bars = widgets.filter((w) => w.widget_type === "bar");
  const lines = widgets.filter(
    (w) => w.widget_type === "line" || w.widget_type === "area",
  );
  const hasAny = kpis.length + pies.length + bars.length + lines.length > 0;

  return (
    <div className="@container space-y-4 p-3">
      <header className="flex items-center gap-3">
        <AppTile name={MODULE_NAME} size={40} />
        <div className="min-w-0">
          <h1 className="text-lg leading-tight font-semibold tracking-tight">
            {t("title")}
          </h1>
          <p className="text-muted-foreground text-sm leading-snug">
            {t("description")}
          </p>
        </div>
      </header>

      {isError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm"
        >
          {td("loadError", { message: error?.message ?? "Unknown error" })}
        </div>
      )}

      {isLoading && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12"
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <WidgetSkeleton key={`opd-skeleton-${i}`} />
          ))}
        </div>
      )}

      {!isLoading && !isError && !hasAny && (
        <p className="text-muted-foreground bg-muted/30 rounded-lg border border-dashed p-6 text-center text-sm">
          {td("empty")}
        </p>
      )}

      {kpis.length > 0 && (
        <Section heading={td("sectionKpi")}>
          <div className="grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12">
            {kpis.map((w) => (
              <LazyWidget
                key={w.dataset_id}
                config={w}
                className={gridClasses(w.widget_type, w.display)}
              >
                {(rw) => (
                  <KpiCard
                    widget={rw}
                    moduleName={MODULE_NAME}
                    subTileFor={subTileFor}
                  />
                )}
              </LazyWidget>
            ))}
          </div>
        </Section>
      )}

      {lines.length > 0 && (
        <Section heading={td("sectionTrends")}>
          <div className="grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12">
            {lines.map((w) => (
              <LazyWidget
                key={w.dataset_id}
                config={w}
                className={gridClasses(w.widget_type, w.display)}
              >
                {(rw) => (
                  <LineCard
                    widget={rw}
                    moduleName={MODULE_NAME}
                    subTileFor={subTileFor}
                  />
                )}
              </LazyWidget>
            ))}
          </div>
        </Section>
      )}

      {bars.length > 0 && (
        <Section heading={td("sectionComparison")}>
          <div className="grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12">
            {bars.map((w) => (
              <LazyWidget
                key={w.dataset_id}
                config={w}
                className={gridClasses(w.widget_type, w.display)}
              >
                {(rw) => (
                  <BarCard
                    widget={rw}
                    moduleName={MODULE_NAME}
                    subTileFor={subTileFor}
                  />
                )}
              </LazyWidget>
            ))}
          </div>
        </Section>
      )}

      {pies.length > 0 && (
        <Section heading={td("sectionDistribution")}>
          <div className="grid auto-rows-[4rem] grid-cols-1 gap-3 @min-[38rem]:grid-cols-6 @5xl:grid-cols-12">
            {pies.map((w) => (
              <LazyWidget
                key={w.dataset_id}
                config={w}
                className={gridClasses(w.widget_type, w.display)}
              >
                {(rw) => (
                  <PieCard
                    widget={rw}
                    moduleName={MODULE_NAME}
                    subTileFor={subTileFor}
                  />
                )}
              </LazyWidget>
            ))}
          </div>
        </Section>
      )}

      <BuWidgetSection module="operation-plan" title={tBu("sectionModule")} />
    </div>
  );
}

function Section({
  heading,
  children,
}: {
  readonly heading: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="text-muted-foreground text-micro-legal font-bold tracking-[0.16em] uppercase">
        {heading}
      </h2>
      {children}
    </section>
  );
}
