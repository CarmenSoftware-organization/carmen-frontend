import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { cn } from "@/lib/utils";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { usePrt, useDeletePrt, useExportPrt } from "./use-prt";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useElementWidth } from "@/hooks/use-element-width";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { PurchaseRequestTemplate } from "@/types/purchase-request";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { usePrtTable } from "./use-prt-table";
import PrtCard from "./prt-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";

export default function PrtComponent() {
  const t = useTranslations("procurement.purchaseRequestTemplate");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const ts = useTranslations("status");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] =
    useState<PurchaseRequestTemplate | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const { dateTimeFormat } = useProfile();
  const deletePrt = useDeletePrt();
  const { exportPrt, isExporting } = useExportPrt();
  const { params, search, setSearch, tableConfig } = useDataGridState();

  const isGridMode = isMobile || displayMode === "grid";
  const useInfiniteScroll = !!isMobile;

  const prtFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        section: "listView.sectionDocument",
        control: "status",
        labelKey: "common.status",
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PURCHASE_REQUEST_TEMPLATE,
    fields: prtFilterFields,
  });

  const queryParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = usePrt(queryParams, {
    enabled: !useInfiniteScroll,
  });

  const grid = useGridPagination<PurchaseRequestTemplate>({
    useListHook: usePrt as Parameters<
      typeof useGridPagination<PurchaseRequestTemplate>
    >[0]["useListHook"],
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const templates = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportPrt({
        params: queryParams,
        columns: [
          { header: tfl("name"), value: (r) => r.name, width: 28 },
          {
            header: tfl("workflow"),
            value: (r) => r.workflow?.name,
            width: 22,
          },
          {
            header: tfl("description"),
            value: (r) => r.description ?? "",
            width: 40,
          },
          {
            header: tfl("createdBy"),
            value: (r) => r.audit?.created?.name ?? "",
            width: 22,
          },
          {
            header: tfl("status"),
            value: (r) => (r.is_active ? ts("active") : ts("inactive")),
            width: 10,
          },
          {
            header: tfl("created"),
            value: (r) =>
              r.audit?.created?.at
                ? formatDate(r.audit.created.at, dateTimeFormat)
                : "",
            width: 18,
          },
          {
            header: tfl("updated"),
            value: (r) =>
              r.audit?.updated?.at
                ? formatDate(r.audit.updated.at, dateTimeFormat)
                : "",
            width: 18,
          },
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

  // ตารางเลือกคอลัมน์จากความกว้างของกล่องตัวเอง (ลบขอบ 1px สองข้างของ DataGridContainer)
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const table = usePrtTable({
    templates,
    totalRecords,
    params,
    tableConfig,
    onEdit: (template) =>
      navigate(
        `/procurement/purchase-request-template/${template.id}`,
        listReturnState(),
      ),
    onDelete: setDeleteTarget,
    containerWidth: gridBoxWidth == null ? undefined : gridBoxWidth - 2,
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
            navigate(
              "/procurement/purchase-request-template/new",
              listReturnState(),
            )
          }
          addLabel={t("add")}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={prtFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {/* Content */}
      {isGridMode &&
        useInfiniteScroll &&
        (grid.isLoading ? (
          <CardSkeletonGrid />
        ) : templates.length === 0 ? (
          <EmptyComponent />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {templates.map((item) => (
                <PrtCard
                  key={item.id}
                  item={item}
                  onEdit={(t) =>
                    navigate(
                      `/procurement/purchase-request-template/${t.id}`,
                      listReturnState(),
                    )
                  }
                  onDelete={setDeleteTarget}
                  compact
                />
              ))}
            </div>
            {grid.hasMore && (
              <div ref={grid.sentinelRef} className="flex justify-center py-4">
                {grid.isLoadingMore && (
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                )}
              </div>
            )}
          </>
        ))}

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
              {isLoading ? (
                <CardSkeletonGrid />
              ) : templates.length === 0 ? (
                <EmptyComponent />
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {templates.map((item) => (
                    <PrtCard
                      key={item.id}
                      item={item}
                      onEdit={(t) =>
                        navigate(
                          `/procurement/purchase-request-template/${t.id}`,
                          listReturnState(),
                        )
                      }
                      onDelete={setDeleteTarget}
                    />
                  ))}
                </div>
              )}
            </div>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}
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

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deletePrt.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deletePrt.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePrt.mutate(deleteTarget.id, {
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
