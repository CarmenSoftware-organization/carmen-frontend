import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { listReturnState } from "@/hooks/use-list-return";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { cn } from "@/lib/utils";
import type { FilterFieldDef } from "@/types/list-filter";
import type { JournalVoucher } from "@/types/journal-voucher";
import {
  useDeleteJournalVoucher,
  useExportJournalVoucher,
  useJournalVouchers,
} from "./use-journal-voucher";
import { useJvTable } from "./use-jv-table";
import JvCardList from "./jv-card-list";
import {
  JV_SOURCE_OPTIONS,
  JV_STATUS_OPTIONS,
  jvSourceLabel,
  jvStatusLabel,
} from "./jv-status";

/** ใหม่สุดขึ้นก่อน — ตรงกับค่าเรียงเริ่มต้นของ backend (`jv_date:desc`) */
const DEFAULT_SORT = "jv_date:desc";

/**
 * หน้ารายการใบสำคัญลงบัญชี (JV) — โครงเดียวกับหน้า list ของ PO
 * (`routes/procurement/purchase-order/po-component.tsx`) ตัดส่วนที่ JV ไม่มีออก:
 * ไม่มีแท็บ "รอฉันดำเนินการ" (ไม่มี endpoint my-pending) และไม่มีคอลัมน์ audit
 */
export default function JournalVoucherList() {
  const t = useTranslations("accounting.journalVoucher");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const exportErrorToast = useExportErrorToast();
  const [deleteTarget, setDeleteTarget] = useState<JournalVoucher | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  const useInfiniteScroll = !!isMobile;
  const deleteJv = useDeleteJournalVoucher();
  const { exportJournalVoucher, isExporting } = useExportJournalVoucher();

  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: DEFAULT_SORT,
  });

  const filterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        control: "custom",
        labelKey: "common.status",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={JV_STATUS_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "source",
        control: "custom",
        labelKey: "accounting.journalVoucher.source",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={JV_SOURCE_OPTIONS}
            className="w-full"
          />
        ),
      },
      {
        key: "jv_date",
        control: "date-range",
        labelKey: "accounting.journalVoucher.jvDate",
        fieldKey: "jv_date",
        section: "listView.sectionDate",
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.JOURNAL_VOUCHER,
    fields: filterFields,
    defaultSort: DEFAULT_SORT,
  });

  const queryParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useJournalVouchers(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<JournalVoucher>({
    useListHook: useJournalVouchers,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const journals = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const openJournal = (journal: JournalVoucher) =>
    navigate(`/accounting/journal-voucher/${journal.id}`, listReturnState());

  const handleExport = async () => {
    try {
      const count = await exportJournalVoucher({
        params: queryParams,
        columns: [
          { header: t("jvNo"), value: (r) => r.display_no, width: 20 },
          {
            header: t("jvDate"),
            value: (r) => r.jv_date.slice(0, 10),
            width: 12,
          },
          {
            header: tfl("description"),
            value: (r) => r.description ?? "",
            width: 40,
          },
          {
            header: t("source"),
            value: (r) => jvSourceLabel(r.source_type),
            width: 12,
          },
          {
            header: tfl("status"),
            value: (r) => jvStatusLabel(r.jv_status),
            width: 12,
          },
          { header: t("debit"), value: (r) => r.total_debit, width: 16 },
          { header: t("credit"), value: (r) => r.total_credit, width: 16 },
        ],
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

  const table = useJvTable({
    journals,
    totalRecords,
    params,
    tableConfig,
    onEdit: openJournal,
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
          onAdd={() => navigate("/accounting/journal-voucher/new")}
          addLabel={t("add")}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={filterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => (useInfiniteScroll ? grid.refetch?.() : refetch())}
              aria-label={tc("refresh")}
              title={tc("refresh")}
            >
              <RefreshCw className="size-4" />
            </Button>
          }
        />
      }
    >
      {!isGridMode && (
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
      )}

      {isGridMode && (
        <>
          <JvCardList
            items={journals}
            isLoading={useInfiniteScroll ? grid.isLoading : isLoading}
            onEdit={openJournal}
            onDelete={setDeleteTarget}
          />
          {useInfiniteScroll && grid.hasMore && (
            <div ref={grid.sentinelRef} className="flex justify-center py-4">
              {grid.isLoadingMore && (
                <Loader2 className="text-muted-foreground size-5 animate-spin" />
              )}
            </div>
          )}
        </>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteJv.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", {
          jvNo: deleteTarget?.display_no ?? "",
        })}
        isPending={deleteJv.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteJv.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
            },
            onError: (err) => {
              toast.error(err instanceof Error ? err.message : String(err));
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
