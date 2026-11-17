import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useElementWidth } from "@/hooks/use-element-width";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  useCreditNote,
  useDeleteCreditNote,
  useExportCreditNote,
} from "./use-credit-note";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import type { CreditNote } from "@/types/credit-note";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { useCnTable } from "./use-cn-table";
import CnCardList from "./cn-card-list";
import EmptyComponent from "@/components/empty-component";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { useCnFilterFields } from "./use-cn-filter-fields";
import { buildCnExportColumns } from "./cn-export-columns";

export default function CnComponent() {
  const t = useTranslations("procurement.creditNote");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<CreditNote | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const useInfiniteScroll = !!isMobile;
  const deleteCn = useDeleteCreditNote();
  const { exportCreditNote, isExporting } = useExportCreditNote();
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "cn_date:desc",
  });

  const cnFilterFields = useCnFilterFields();

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.CREDIT_NOTE,
    fields: cnFilterFields,
  });

  const queryParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useCreditNote(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<CreditNote>({
    useListHook: useCreditNote,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const creditNotes = useInfiniteScroll ? grid.items : (data?.data ?? []);

  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportCreditNote({
        params: queryParams,
        columns: buildCnExportColumns(tfl),
      });
      if (count === 0) {
        toast.warning(tc("exportNoData"));
        return;
      }
      toast.success(tc("exportSuccess", { count }));
    } catch (err) {
      exportErrorToast(err);
    }
  };

  // ลบขอบ 1px สองข้างของ DataGridContainer ออก ได้ความกว้างที่ตารางใช้จริง
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const table = useCnTable({
    containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2,
    creditNotes,
    totalRecords,
    params,
    tableConfig,
    onEdit: (cn) =>
      navigate(`/procurement/credit-note/${cn.id}`, listReturnState()),
    onDelete: setDeleteTarget,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <DocumentListActions
          onExport={handleExport}
          isExporting={isExporting}
          onAdd={() =>
            navigate("/procurement/credit-note/new", listReturnState())
          }
          addLabel={t("add")}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={cnFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {!isGridMode && (
        <div ref={setGridBox}>
          <DataGrid
            table={table}
            recordCount={totalRecords}
            isLoading={isLoading}
            tableLayout={{ headerSticky: true }}
            emptyMessage={<EmptyComponent />}
          >
            <DataGridContainer
              className={cn(
                "flex flex-col",
                listGridMaxH(lf.activeFilters.length > 0),
              )}
            >
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
              <DataGridPagination />
            </DataGridContainer>
          </DataGrid>
        </div>
      )}

      {isGridMode && useInfiniteScroll && (
        <>
          <CnCardList
            items={creditNotes}
            isLoading={grid.isLoading}
            onEdit={(cn) =>
              navigate(`/procurement/credit-note/${cn.id}`, listReturnState())
            }
            onDelete={setDeleteTarget}
          />
          {grid.hasMore && (
            <div ref={grid.sentinelRef} className="flex justify-center py-4">
              {grid.isLoadingMore && (
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              )}
            </div>
          )}
        </>
      )}

      {isGridMode && !useInfiniteScroll && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true }}
        >
          <DataGridContainer
            // โหมดการ์ด: กล่องนอกไม่ใช่การ์ด เป็นแค่ตัวคุมพื้นที่เลื่อนกับแถบ
            // แบ่งหน้า — ทา `bg-card` ทับการ์ดที่เป็น `bg-card` อยู่แล้วเมื่อไร
            // ก็กลายเป็นการ์ดซ้อนการ์ดที่แยกกันไม่ออก
            border={false}
            className={cn(
              "flex flex-col",
              listGridMaxH(lf.activeFilters.length > 0),
            )}
          >
            <div className="flex-1 overflow-auto">
              <CnCardList
                items={creditNotes}
                isLoading={isLoading}
                onEdit={(cn) =>
                  navigate(
                    `/procurement/credit-note/${cn.id}`,
                    listReturnState(),
                  )
                }
                onDelete={setDeleteTarget}
              />
            </div>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteCn.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { cnNo: deleteTarget?.cn_no ?? "" })}
        isPending={deleteCn.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCn.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
          });
        }}
      />

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
