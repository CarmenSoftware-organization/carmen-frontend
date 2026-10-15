import { useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { Columns3, Loader2 } from "lucide-react";
import { DataGridColumnVisibility } from "@/components/ui/data-grid/data-grid-column-visibility";
import { DataGridSortMenu } from "@/components/ui/data-grid/data-grid-sort-menu";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { Button } from "@/components/ui/button";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { usePullToRefresh } from "@/hooks/use-pull-to-refresh";
import { useListFilters } from "@/hooks/use-list-filters";
import SearchInput from "@/components/search-input";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import EmptyComponent from "@/components/empty-component";
import { ErrorState } from "@/components/ui/error-state";
import { ActiveFilterBar } from "@/components/ui/active-filter-bar";
import { ViewSelector } from "@/components/list-filter/view-selector";
import { ListFilter } from "@/components/list-filter/list-filter";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { cn } from "@/lib/utils";
import { downloadXlsx, buildXlsxFileName } from "@/lib/xlsx-utils";
import { useCan } from "@/hooks/use-can";
import { usePermissionPrefix } from "@/hooks/use-permission-prefix";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { buildPermissionKey } from "@/constant/permissions";
import type { CardRenderProps, ConfigListTemplateProps } from "./types";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";

interface GridContentArgs<TEntity extends { id: string }> {
  readonly isLoading: boolean;
  readonly entities: TEntity[];
  readonly renderCard?: (props: CardRenderProps<TEntity>) => React.ReactNode;
  readonly handleEdit: (entity: TEntity) => void;
  readonly handleDelete: (entity: TEntity) => void;
  readonly useInfiniteScroll: boolean;
  readonly grid: {
    readonly hasMore: boolean;
    readonly isLoadingMore: boolean;
    readonly sentinelRef: (node: HTMLDivElement | null) => void;
  };
}

/**
 * Render การ์ดกริด + infinite-scroll sentinel สำหรับโหมด grid/mobile
 *
 * แยกออกจาก ConfigListTemplate เพื่อหลีกเลี่ยง nested ternaries (S3358)
 */
function renderGridContent<TEntity extends { id: string }>({
  isLoading,
  entities,
  renderCard,
  handleEdit,
  handleDelete,
  useInfiniteScroll,
  grid,
}: GridContentArgs<TEntity>) {
  if (isLoading) return <CardSkeletonGrid />;
  if (entities.length === 0) return <EmptyComponent />;
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {entities.map((item, index) => (
          <div key={item.id}>
            {renderCard?.({
              item,
              onEdit: handleEdit,
              onDelete: handleDelete,
              index,
            })}
          </div>
        ))}
      </div>
      {useInfiniteScroll && grid.hasMore && (
        <div ref={grid.sentinelRef} className="flex justify-center py-4">
          {grid.isLoadingMore && (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          )}
        </div>
      )}
    </>
  );
}

interface DeleteFlowArgs<TEntity extends { id: string }> {
  readonly deleteTarget: TEntity | null;
  readonly setDeleteTarget: (entity: TEntity | null) => void;
  readonly deleteMutation: ReturnType<
    ConfigListTemplateProps<TEntity>["useDelete"]
  >;
  readonly renderDeleteDialog?: ConfigListTemplateProps<TEntity>["renderDeleteDialog"];
  readonly entityNameField: keyof TEntity & string;
  readonly t: ReturnType<typeof useTranslations>;
  readonly tt: ReturnType<typeof useTranslations>;
}

function renderDeleteFlow<TEntity extends { id: string }>({
  deleteTarget,
  setDeleteTarget,
  deleteMutation,
  renderDeleteDialog,
  entityNameField,
  t,
  tt,
}: DeleteFlowArgs<TEntity>) {
  const onOpenChange = (open: boolean) => {
    if (!open && !deleteMutation.isPending) setDeleteTarget(null);
  };
  const onConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        setDeleteTarget(null);
      },
    });
  };

  if (renderDeleteDialog) {
    return renderDeleteDialog({
      target: deleteTarget,
      open: !!deleteTarget,
      onOpenChange,
      isPending: deleteMutation.isPending,
      onConfirm,
    });
  }

  return (
    <DeleteDialog
      open={!!deleteTarget}
      onOpenChange={onOpenChange}
      title={t("deleteTitle")}
      description={t("deleteConfirm", {
        name: deleteTarget ? String(deleteTarget[entityNameField] ?? "") : "",
      })}
      isPending={deleteMutation.isPending}
      onConfirm={onConfirm}
    />
  );
}

/**
 * ConfigListTemplate — generic list page (search/filter/sort/paginate/export/CRUD)
 * ขับเคลื่อนด้วย registry: `pageKey` + `filterFields` เปิด saved views (bu/user
 * scope) และ filter sheet ที่ประกาศ field ผ่าน `FilterFieldDef[]` แทนการเขียน
 * filter bar เฉพาะหน้าเอง
 */
export function ConfigListTemplate<TEntity extends { id: string }>({
  translationNamespace,
  entityNameField,
  useList,
  useDelete,
  useTable,
  renderDialog,
  renderDeleteDialog,
  renderCard,
  extraActions,
  hideExportPrint,
  exportColumns,
  exportFileNamePrefix,
  exportSheetName,
  defaultSort,
  addPath,
  getEditPath,
  permissionPrefix,
  pageKey,
  filterFields,
  fixedColumnWidths,
}: Readonly<ConfigListTemplateProps<TEntity>>) {
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<TEntity | null>(null);
  const deleteMutation = useDelete();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editEntity, setEditEntity] = useState<TEntity | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const isMobile = useIsMobile();
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort,
  });

  const lf = useListFilters({ pageKey, fields: filterFields, defaultSort });

  // useDataGridState ยังให้ pagination/sort/search params อยู่ แต่ filter ต้อง
  // ใช้ค่าที่ encode จาก registry (lf.filterParam) แทน
  const mergedParams = { ...params, filter: lf.filterParam };

  // grid/card view (mobile หรือ desktop grid mode) → infinite scroll
  // (โหลดเพิ่มเมื่อ scroll ถึง sentinel ล่างสุด แทน pagination ของ table)
  const isGridMode = !!renderCard && (!!isMobile || displayMode === "grid");
  const useInfiniteScroll = isGridMode;

  const directQuery = useList(mergedParams, { enabled: !useInfiniteScroll });
  const grid = useGridPagination<TEntity>({
    useListHook: useList as Parameters<
      typeof useGridPagination<TEntity>
    >[0]["useListHook"],
    params: mergedParams,
    enabled: !!useInfiniteScroll,
  });

  const t = useTranslations(translationNamespace);
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tt = useTranslations("toast");

  const entities = useInfiniteScroll
    ? grid.items
    : (directQuery.data?.data ?? []);

  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (directQuery.data?.paginate?.total ?? 0);

  const isLoading = useInfiniteScroll ? grid.isLoading : directQuery.isLoading;
  const error = directQuery.error;
  const refetch = directQuery.refetch;

  const handleEdit = (entity: TEntity) => {
    if (getEditPath) {
      navigate(getEditPath(entity), listReturnState());
      return;
    }
    setEditEntity(entity);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    if (addPath) {
      navigate(addPath, listReturnState());
      return;
    }
    setEditEntity(null);
    setDialogOpen(true);
  };

  const handleExport = () => {
    if (!exportColumns) return;
    if (entities.length === 0) {
      toast.warning(tc("exportNoData"));
      return;
    }
    setIsExporting(true);
    try {
      const prefix =
        exportFileNamePrefix ??
        translationNamespace.split(".").pop() ??
        "export";
      downloadXlsx({
        rows: entities,
        columns: exportColumns,
        sheetName: exportSheetName ?? t("title"),
        fileName: buildXlsxFileName(prefix),
      });
      toast.success(tc("exportSuccess", { count: entities.length }));
    } catch (err) {
      exportErrorToast(err);
    } finally {
      setIsExporting(false);
    }
  };

  const { can, isAdmin, canWrite } = useCan();
  const autoPrefix = usePermissionPrefix();
  const prefix = permissionPrefix ?? autoPrefix;
  const createPermission = prefix
    ? buildPermissionKey(prefix, "create")
    : undefined;
  const createDenied = !!createPermission && !isAdmin && !can(createPermission);
  const updatePermission = prefix
    ? buildPermissionKey(prefix, "update")
    : undefined;
  const updateDenied = !!updatePermission && !isAdmin && !can(updatePermission);
  // สัญญาหมดอายุ/ถูกระงับ → เขียนไม่ได้ทั้งหน้า ไม่ว่าจะมีสิทธิ์ RBAC หรือไม่
  // (license ไม่มี admin bypass) ปุ่มลบของแถวถูกปิดไปแล้วใน useConfigTable —
  // ถ้าไม่รวมตรงนี้ด้วย ปุ่ม Add กับ dialog แก้ไขจะยังใช้ได้แล้วไปเด้ง 403 ตอน save
  // ซึ่งขัดกับปุ่มลบบนแถวเดียวกันในจอเดียวกัน
  const addBlocked = createDenied || !canWrite;
  const handleAddClick = () => {
    if (!canWrite) {
      // license มาก่อน permission เสมอ — แก้คนละวิธี (ต่ออายุ ไม่ใช่ขอสิทธิ์)
      dispatchPermissionDenied(createPermission, undefined, "expired");
      return;
    }
    if (createDenied) {
      dispatchPermissionDenied(createPermission);
      return;
    }
    handleAdd();
  };

  const table = useTable({
    data: entities,
    totalRecords,
    params,
    tableConfig,
    onEdit: handleEdit,
    onDelete: setDeleteTarget,
    permissionPrefix: prefix,
  });

  const pullRefresh = usePullToRefresh({
    onRefresh: refetch,
    disabled: !isMobile,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      pullRefresh={pullRefresh}
      actions={
        <DocumentListActions
          onAdd={handleAddClick}
          addDisabled={addBlocked}
          addLabel={t("add")}
          onExport={handleExport}
          isExporting={isExporting}
          showExport={!!exportColumns}
          hideExportPrint={hideExportPrint}
          extraActions={extraActions}
        />
      }
      toolbar={
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex w-full flex-1 items-center gap-2 sm:w-auto">
              <div className="flex-1 sm:flex-initial">
                <SearchInput defaultValue={search} onSearch={setSearch} />
              </div>
              <span className="bg-border hidden h-4 w-px sm:block" />
              {/* Saved views + registry filter sheet — ทำงานทั้ง desktop และ mobile
                  (ListFilter ปรับ side เอง ผ่าน useIsMobile ภายในตัวมัน) */}
              <ViewSelector
                view={lf.view}
                snapshot={{
                  filters: lf.values,
                  sort: lf.sortParam || undefined,
                }}
              />
              <ListFilter
                fields={filterFields}
                values={lf.values}
                setValue={lf.setValue}
                onClearAll={lf.clearAll}
                onSaveClick={() => setSaveDialogOpen(true)}
                activeCount={lf.activeFilters.length}
              />
            </div>
            <div className="hidden shrink-0 items-center gap-2 sm:flex">
              <DataGridSortMenu table={table} />
              {!isGridMode && (
                <DataGridColumnVisibility
                  table={table}
                  trigger={
                    <Button
                      size="icon-sm"
                      variant="outline"
                      aria-label={tc("aria.toggleColumns")}
                    >
                      <Columns3 className="size-4" />
                    </Button>
                  }
                />
              )}
              {renderCard && (
                <DisplayModeToggle
                  value={displayMode}
                  onChange={setDisplayMode}
                />
              )}
            </div>
          </div>
          {/* Active filter badges — driven by registry field values, not statusOptions */}
          <ActiveFilterBar
            filters={lf.activeFilters}
            onClearAll={lf.clearAll}
          />
        </>
      }
    >
      {isGridMode ? (
        renderGridContent({
          isLoading,
          entities,
          renderCard,
          handleEdit,
          handleDelete: setDeleteTarget,
          useInfiniteScroll,
          grid,
        })
      ) : (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{
            headerSticky: true,
            ...(fixedColumnWidths && { width: "fixed" }),
          }}
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

      {renderDialog?.({
        open: dialogOpen,
        onOpenChange: setDialogOpen,
        entity: editEntity,
        readOnly: !!editEntity && (updateDenied || !canWrite),
      })}

      {renderDeleteFlow({
        deleteTarget,
        setDeleteTarget,
        deleteMutation,
        renderDeleteDialog,
        entityNameField,
        t,
        tt,
      })}

      <SaveViewDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}
