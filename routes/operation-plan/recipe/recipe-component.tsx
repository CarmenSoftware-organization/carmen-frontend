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
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useEntitiesByIds } from "@/hooks/use-entities-by-ids";
import type { Cuisine } from "@/types/cuisine";
import type { RecipeCategory } from "@/types/recipe-category";
import { useRecipe, useDeleteRecipe } from "./use-recipe";
import { useCuisine } from "@/hooks/use-cuisine";
import { useRecipeCategory } from "@/hooks/use-recipe-category";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import type { Recipe } from "@/types/recipe";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import {
  RECIPE_DIFFICULTY_OPTIONS,
  RECIPE_STATUS_OPTIONS,
} from "@/constant/recipe";
import { recipeStatusKey } from "./recipe-list-cells";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { StatusFilter } from "@/components/ui/status-filter";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { useRecipeTable } from "./use-recipe-table";
import RecipeCard from "./recipe-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";

const CUISINE_ENTITY = defineEntitySource<Cuisine>({
  fieldKey: "cuisine_id",
  useListHook: useCuisine,
  getLabel: (c) => c.name,
});
const RECIPE_CATEGORY_ENTITY = defineEntitySource<RecipeCategory>({
  fieldKey: "category_id",
  useListHook: useRecipeCategory,
  getLabel: (c) => c.name,
});

export default function RecipeComponent() {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tt = useTranslations("toast");
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Recipe | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deleteRecipe = useDeleteRecipe();
  const { params, search, setSearch, tableConfig } = useDataGridState();

  const isGridMode = isMobile || displayMode === "grid";
  const difficultyFilterOptions = useMemo(
    () =>
      RECIPE_DIFFICULTY_OPTIONS.map((o) => ({
        label: o.label,
        value: `difficulty|string:${o.value}`,
      })),
    [],
  );

  const lifecycleFilterOptions = useMemo(
    () =>
      RECIPE_STATUS_OPTIONS.map((o) => ({
        label: ts(recipeStatusKey(o.value)),
        value: `status|string:${o.value}`,
      })),
    [ts],
  );

  const STATUS_OPTIONS = useMemo(
    () => [
      { label: ts("active"), value: "is_active|bool:true" },
      { label: ts("inactive"), value: "is_active|bool:false" },
    ],
    [ts],
  );

  // difficulty/status เป็น label literal จึงห่อ custom · cuisine/category เป็น
  // control "entity" (ค้นที่ server, chip ขึ้นชื่อ)
  const recipeFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
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
        key: "lifecycle",
        control: "custom",
        labelKey: "operationPlan.recipe.lifecycle",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            placeholder={t("lifecycle")}
            options={lifecycleFilterOptions}
            className="w-full"
          />
        ),
      },
      {
        key: "difficulty",
        control: "custom",
        labelKey: "field.difficulty",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            placeholder={tfl("difficulty")}
            options={difficultyFilterOptions}
            className="w-full"
          />
        ),
      },
      {
        key: "cuisine",
        control: "entity",
        entity: CUISINE_ENTITY,
        labelKey: "field.cuisine",
        section: "listView.sectionCategory",
      },
      {
        key: "category",
        control: "entity",
        entity: RECIPE_CATEGORY_ENTITY,
        labelKey: "field.category",
        section: "listView.sectionCategory",
      },
    ],
    [STATUS_OPTIONS, difficultyFilterOptions, lifecycleFilterOptions, t, tfl],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.RECIPE,
    fields: recipeFilterFields,
  });

  const combinedParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useRecipe(combinedParams, {
    enabled: !isGridMode,
  });

  const grid = useGridPagination<Recipe>({
    useListHook: useRecipe,
    params: combinedParams,
    enabled: isGridMode,
  });

  const recipes = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  // ชื่อ cuisine/หมวดของแถวในหน้านี้เท่านั้น (ดึงตาม id) — ไม่ลากทะเบียนทั้ง BU
  const { items: cuisines } = useEntitiesByIds<Cuisine>({
    useListHook: useCuisine,
    ids: recipes.map((r) => r.cuisine_id),
  });
  const { items: recipeCategories } = useEntitiesByIds<RecipeCategory>({
    useListHook: useRecipeCategory,
    ids: recipes.map((r) => r.category_id),
  });

  const table = useRecipeTable({
    recipes,
    cuisines,
    categories: recipeCategories,
    totalRecords,
    params,
    tableConfig,
    onEdit: (recipe) =>
      navigate(`/operation-plan/recipe/${recipe.id}`, listReturnState()),
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
            navigate("/operation-plan/recipe/new", listReturnState())
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
          fields={recipeFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && recipes.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {recipes.map((item) => (
              <RecipeCard
                key={item.id}
                item={item}
                cuisines={cuisines}
                categories={recipeCategories}
                onEdit={(r) =>
                  navigate(`/operation-plan/recipe/${r.id}`, listReturnState())
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
      {isGridMode && !grid.isLoading && recipes.length === 0 && (
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
          !open && !deleteRecipe.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deleteRecipe.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRecipe.mutate(deleteTarget.id, {
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
