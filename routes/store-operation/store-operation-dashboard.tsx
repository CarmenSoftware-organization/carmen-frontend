import { useTranslations } from "use-intl";
import { BuWidgetSection } from "@/components/dashboard-widget/bu-widget-section-lazy";
import { DashboardWidgetGrid } from "@/components/dashboard-widget/dashboard-widget-grid-lazy";
import { useStoreOperationWidgets } from "@/hooks/use-dashboard-widgets";

const DATASET_TO_SUB_TILE: Record<string, string> = {
  "document.sr-pending": "storeRequisition",
  "document.sr-count": "storeRequisition",
  "document.sr-by-status": "storeRequisition",
  "document.sr-created-series": "storeRequisition",
  "document.sr-issued": "storeRequisition",
  "inventory.below-par-count": "stockReplenishment",
  "inventory.below-par-items": "stockReplenishment",
};

function subTileFor(datasetId: string): string {
  return DATASET_TO_SUB_TILE[datasetId] ?? "storeRequisition";
}

export default function StoreOperationDashboard() {
  const t = useTranslations("storeOperation.dashboard");
  const tBu = useTranslations("dashboard.buWidget");
  const query = useStoreOperationWidgets();
  return (
    <>
      <DashboardWidgetGrid
        title={t("title")}
        description={t("description")}
        moduleName="storeOperations"
        subTileFor={subTileFor}
        query={query}
      />
      <BuWidgetSection
        className="px-3 pb-3"
        module="store-operation"
        title={tBu("sectionModule")}
      />
    </>
  );
}
