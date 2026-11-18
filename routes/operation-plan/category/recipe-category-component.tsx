import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
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
  useRecipeCategory,
  useDeleteRecipeCategory,
} from "@/hooks/use-recipe-category";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import type { RecipeCategory } from "@/types/recipe-category";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { StatusFilter } from "@/components/ui/status-filter";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { useRecipeCategoryTable } from "./use-recipe-category-table";
import RecipeCategoryCard from "./recipe-category-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { rowNumber } from "@/lib/row-number";

const PARENT_ENTITY = defineEntitySource<RecipeCategory>({
  fieldKey: "parent_id",
  useListHook: useRecipeCategory,
  getLabel: (c) => c.name,
});

export default function RecipeCategoryComponent() {
  const t = useTranslations("operationPlan.recipeCategory");
  const ts = useTranslations("status");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<RecipeCategory | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deleteCategory = useDeleteRecipeCategory();
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const isGridMode = isMobile || displayMode === "grid";

  const STATUS_OPTIONS = useMemo(
    () => [
      { label: ts("active"), value: "is_active|bool:true" },
      { label: ts("inactive"), value: "is_active|bool:false" },
    ],
    [ts],
  );

  // parent เป็น control "entity" (ค้นที่ server, chip ขึ้นชื่อ)
  const recipeCategoryFilterFields = useMemo<FilterFieldDef[]>(
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
      {
        key: "parent",
        section: "listView.sectionCategory",
        control: "entity",
        entity: PARENT_ENTITY,
        labelKey: "field.parent",
      },
    ],
    [STATUS_OPTIONS],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.RECIPE_CATEGORY,
    fields: recipeCategoryFilterFields,
  });

  const combinedParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useRecipeCategory(
    combinedParams,
    {
      enabled: !isGridMode,
    },
  );

  const grid = useGridPagination<RecipeCategory>({
    useListHook: useRecipeCategory,
    params: combinedParams,
    enabled: isGridMode,
  });

  const categories = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const table = useRecipeCategoryTable({
    categories,
    totalRecords,
    params,
    tableConfig,
    onEdit: (category) =>
      navigate(`/operation-plan/category/${category.id}`, listReturnState()),
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
          onAdd={() =>
            navigate("/operation-plan/category/new", listReturnState())
          }
          addLabel={t("add")}
          hideExportPrint
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={recipeCategoryFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && categories.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((item, i) => (
              <RecipeCategoryCard
                rowNo={rowNumber(undefined, i)}
                key={item.id}
                item={item}
                parentName={item.parent?.name ?? undefined}
                onEdit={(c) =>
                  navigate(
                    `/operation-plan/category/${c.id}`,
                    listReturnState(),
                  )
                }
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
      {isGridMode && !grid.isLoading && categories.length === 0 && (
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

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteCategory.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deleteCategory.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteCategory.mutate(deleteTarget.id, {
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
