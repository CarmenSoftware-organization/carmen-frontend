import { lazy, Suspense, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { cn } from "@/lib/utils";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  useEquipmentCategory,
  useDeleteEquipmentCategory,
} from "@/hooks/use-equipment-category";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import type { EquipmentCategory } from "@/types/equipment-category";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { StatusFilter } from "@/components/ui/status-filter";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { useEquipmentCategoryTable } from "./use-equipment-category-table";
import EquipmentCategoryCard from "./equipment-category-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { rowNumber } from "@/lib/row-number";

// แทน next/dynamic ด้วย React.lazy (code-split dialog chunk เหมือนเดิม)
const EquipmentCategoryDialog = lazy(() =>
  import("./equipment-category-dialog").then((mod) => ({
    default: mod.EquipmentCategoryDialog,
  })),
);

export default function EquipmentCategoryComponent() {
  const t = useTranslations("operationPlan.equipmentCategory");
  const ts = useTranslations("status");
  const tt = useTranslations("toast");
  const [deleteTarget, setDeleteTarget] = useState<EquipmentCategory | null>(
    null,
  );
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deleteEquipmentCategory = useDeleteEquipmentCategory();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<EquipmentCategory | null>(
    null,
  );
  const { params, search, setSearch, tableConfig } = useDataGridState();

  const isGridMode = isMobile || displayMode === "grid";

  // STATUS_OPTIONS ใช้ ts() แปลเป็น string จริงแล้วก่อนถึง options (ไม่ใช่
  // i18n key) จึงต้องใช้ control: "custom" ห่อ StatusFilter ตรง ๆ — เหมือน
  // pattern ของ PO_TYPE/CN_TYPE ใน Task 19
  const STATUS_OPTIONS = useMemo(
    () => [
      { label: ts("active"), value: "is_active|bool:true" },
      { label: ts("inactive"), value: "is_active|bool:false" },
    ],
    [ts],
  );

  const equipmentCategoryFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        section: "listView.sectionDocument",
        control: "custom",
        labelKey: "common.status",
        render: (value, onChange) => (
          <StatusFilter
            value={value}
            onChange={onChange}
            options={STATUS_OPTIONS}
            className="w-full"
          />
        ),
      },
    ],
    [STATUS_OPTIONS],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.EQUIPMENT_CATEGORY,
    fields: equipmentCategoryFilterFields,
  });

  const combinedParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useEquipmentCategory(
    combinedParams,
    {
      enabled: !isGridMode,
    },
  );

  const grid = useGridPagination<EquipmentCategory>({
    useListHook: useEquipmentCategory,
    params: combinedParams,
    enabled: isGridMode,
  });

  const equipmentCategories = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleEdit = (ec: EquipmentCategory) => {
    setEditCategory(ec);
    setDialogOpen(true);
  };

  const table = useEquipmentCategoryTable({
    equipmentCategories,
    totalRecords,
    params,
    tableConfig,
    onEdit: handleEdit,
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
          onAdd={() => {
            setEditCategory(null);
            setDialogOpen(true);
          }}
          addLabel={t("add")}
          hideExportPrint
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={equipmentCategoryFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && equipmentCategories.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {equipmentCategories.map((item, i) => (
              <EquipmentCategoryCard
                rowNo={rowNumber(undefined, i)}
                key={item.id}
                item={item}
                onEdit={handleEdit}
                onDelete={setDeleteTarget}
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
      )}
      {isGridMode && !grid.isLoading && equipmentCategories.length === 0 && (
        <EmptyComponent />
      )}

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

      <Suspense fallback={null}>
        <EquipmentCategoryDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          equipmentCategory={editCategory}
        />
      </Suspense>

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteEquipmentCategory.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", {
          name: deleteTarget?.name ?? "",
        })}
        isPending={deleteEquipmentCategory.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteEquipmentCategory.mutate(deleteTarget.id, {
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
