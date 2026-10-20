import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { PackageCheck, SearchX, X } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { useWastageReport } from "./use-wastage-report";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ListPageShell } from "@/components/share/list-page-shell";
import { WASTAGE_WINDOW_DAYS } from "@/constant/wastage-reporting";
import { useWastageReportTable } from "./use-wr-table";
import { WrSummaryBar } from "./wr-summary-bar";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import type { WastageStatus } from "@/types/wastage-reporting";

const isWastageStatus = (v: string): v is WastageStatus =>
  v === "expired" || v === "expiring";

export default function WrComponent() {
  const navigate = useNavigate();
  const t = useTranslations("storeOperation.wastageReporting");
  const tc = useTranslations("common");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const { params, search, setSearch, tableConfig } = useDataGridState();

  // สถานะคุมด้วย segmented บนหน้า (WrSummaryBar) จึงเป็น field hidden — ยังอยู่ใน
  // URL / saved view ตามปกติ แต่ไม่ซ้ำเป็นเมนูใน Filter และไม่ออก chip
  // ไม่ใช้ filterParam: endpoint นี้อ่าน `?status=` ของตัวเอง ไม่อ่าน `filter`
  // (เดิมส่ง `filter=status|string:expired` ไป backend ทิ้งเงียบ ๆ ได้ทุกแถว)
  const wrFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "status",
        control: "custom",
        labelKey: "common.status",
        hidden: true,
        render: () => null,
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.WASTAGE_REPORTING,
    fields: wrFilterFields,
  });
  const status = isWastageStatus(lf.values.status) ? lf.values.status : "";

  const { data, isLoading, error, refetch } = useWastageReport({
    page: params.page,
    perpage: params.perpage,
    search: params.search,
    days: WASTAGE_WINDOW_DAYS,
    ...(status ? { status } : {}),
  });

  // summary ของ backend คิดหลังกรองสถานะ — กรอง "หมดอายุแล้ว" อยู่ ปุ่ม "ใกล้หมด"
  // จะนับได้ 0 ทั้งที่มีของ จึงยิงอีกครั้งแบบไม่กรอง (แถวเดียว) เฉพาะตอนที่กรองอยู่
  const { data: unfiltered } = useWastageReport(
    {
      page: 1,
      perpage: 1,
      search: params.search,
      days: WASTAGE_WINDOW_DAYS,
    },
    { enabled: !!status },
  );

  const items = data?.data ?? [];
  const totalRecords = data?.paginate?.total ?? 0;
  const counts = status ? unfiltered?.summary : data?.summary;

  const table = useWastageReportTable({
    items,
    totalRecords,
    params,
    tableConfig,
    onOpenGrn: (item) =>
      navigate(`/procurement/goods-receive-note/${item.grn_id}`),
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const emptyMessage = search ? (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <SearchX />
        </EmptyMedia>
        <EmptyTitle>{t("noResultsTitle", { search })}</EmptyTitle>
        <EmptyDescription>{t("noResultsDesc")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline" onClick={() => setSearch("")}>
          <X />
          {tc("clearSearch")}
        </Button>
      </EmptyContent>
    </Empty>
  ) : (
    <Empty className="py-10">
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <PackageCheck />
        </EmptyMedia>
        <EmptyTitle>
          {t(status === "expired" ? "noExpiredTitle" : "allFreshTitle")}
        </EmptyTitle>
        <EmptyDescription>
          {t("allFreshDesc", { days: WASTAGE_WINDOW_DAYS })}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc", { days: WASTAGE_WINDOW_DAYS })}
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={wrFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
        />
      }
    >
      <div className="space-y-3">
        <WrSummaryBar
          counts={counts}
          valueAtRisk={data?.summary?.total_value_at_risk}
          status={status}
          onStatusChange={(next) => lf.setValue("status", next)}
        />

        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          // เซลล์วันหมดอายุมีสามชั้น (คำ · แถบ · วันที่) clamp สองบรรทัดจะตัดวันที่ทิ้ง
          tableLayout={{ cellAlign: "top", rowClamp: false }}
        >
          <DataGridContainer>
            <DataGridTable />
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      </div>

      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}
