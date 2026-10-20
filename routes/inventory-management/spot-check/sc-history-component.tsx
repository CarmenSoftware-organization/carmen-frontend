import { useState } from "react";
import { useNavigate } from "react-router";
import { History, SearchX, X } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { listReturnState } from "@/hooks/use-list-return";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { cn } from "@/lib/utils";
import { useSpotCheck } from "./use-sc";
import { useScHistoryTable } from "./use-sc-history-table";
import { SC_HISTORY_FILTER_FIELDS } from "./sc-history-filter-fields";
import { ScViewToggle } from "./sc-view-toggle";
import { SC_LIST_PATH } from "./sc-paths";

export default function ScHistoryComponent() {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tc = useTranslations("common");
  const navigate = useNavigate();
  const isMobile = useIsMobile() === true;
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "created_at:desc",
  });
  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.SPOT_CHECK,
    fields: SC_HISTORY_FILTER_FIELDS,
  });

  const { data, isLoading, error, refetch } = useSpotCheck({
    ...params,
    filter: lf.filterParam,
  });
  const items = data?.data ?? [];
  const totalRecords = data?.paginate?.total ?? 0;

  const table = useScHistoryTable({
    items,
    totalRecords,
    params,
    tableConfig,
    onOpen: (sc) => navigate(`${SC_LIST_PATH}/${sc.id}`, listReturnState()),
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const hasActiveFilters = lf.activeFilters.length > 0;
  const emptyMessage =
    search || hasActiveFilters ? (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <SearchX />
          </EmptyMedia>
          <EmptyTitle>{t("noHistoryMatch")}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSearch("");
              lf.clearAll();
            }}
          >
            <X />
            {tc("clearSearch")}
          </Button>
        </EmptyContent>
      </Empty>
    ) : (
      <Empty className="py-10">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <History />
          </EmptyMedia>
          <EmptyTitle>{t("noHistory")}</EmptyTitle>
          <EmptyDescription>{t("noHistoryDesc")}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={<ScViewToggle view="history" />}
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={SC_HISTORY_FILTER_FIELDS}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
        />
      }
    >
      <DataGrid
        table={table}
        recordCount={totalRecords}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        // มือถือเป็นเซลล์เดียวสองบรรทัด — clamp จะตัดบรรทัดล่างทิ้ง
        tableLayout={{ headerSticky: true, rowClamp: !isMobile }}
      >
        <DataGridContainer
          className={cn("flex flex-col", listGridMaxH(hasActiveFilters))}
        >
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>

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
