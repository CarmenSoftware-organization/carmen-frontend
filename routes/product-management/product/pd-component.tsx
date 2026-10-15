import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  useProduct,
  useDeleteProduct,
  useExportProduct,
} from "@/hooks/use-product";
import { useCategory } from "@/hooks/use-category";
import { useSubCategory } from "@/hooks/use-sub-category";
import { useItemGroup } from "@/hooks/use-item-group";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { cn } from "@/lib/utils";
import type { Product, ProductDetail } from "@/types/product";
import { getProductStatusLabel } from "@/constant/product-status";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import type {
  CategoryDto,
  ItemGroupDto,
  SubCategoryDto,
} from "@/types/category";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { useProductTable } from "./use-product-table";
import EmptyComponent from "@/components/empty-component";
import ProductCard from "./pd-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";

const CATEGORY_ENTITY = defineEntitySource<CategoryDto>({
  fieldKey: "product_category_id",
  useListHook: useCategory,
  getLabel: (c) => c.name,
});
const SUB_CATEGORY_ENTITY = defineEntitySource<SubCategoryDto>({
  fieldKey: "product_sub_category_id",
  useListHook: useSubCategory,
  getLabel: (c) => c.name,
});
const ITEM_GROUP_ENTITY = defineEntitySource<ItemGroupDto>({
  fieldKey: "product_item_group_id",
  useListHook: useItemGroup,
  getLabel: (c) => c.name,
});

export default function ProductComponent() {
  const t = useTranslations("productManagement.product");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tt = useTranslations("toast");
  const ts = useTranslations("status");
  const tfl = useTranslations("field");
  const navigate = useNavigate();
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deleteProduct = useDeleteProduct();
  const { exportProduct, isExporting } = useExportProduct();
  const { params, search, setSearch, tableConfig } = useDataGridState();

  const isGridMode = isMobile || displayMode === "grid";

  // category/sub_category/item_group เป็น 3 filter อิสระต่อกัน (ไม่มี cascade) —
  // control "entity" ค้นที่ server โหลดทีละหน้าตอนเปิด และ chip ดึงชื่อตาม id เอง
  const productFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        control: "status",
        labelKey: "common.status",
        options: [
          {
            labelKey: "status.active",
            value: "product_status_type|str:active",
          },
          {
            labelKey: "status.inactive",
            value: "product_status_type|str:inactive",
          },
        ],
      },
      {
        key: "category",
        control: "entity",
        entity: CATEGORY_ENTITY,
        labelKey: "field.category",
        section: "listView.sectionCategory",
      },
      {
        key: "sub_category",
        control: "entity",
        entity: SUB_CATEGORY_ENTITY,
        labelKey: "field.subCategory",
        section: "listView.sectionCategory",
      },
      {
        key: "item_group",
        control: "entity",
        entity: ITEM_GROUP_ENTITY,
        labelKey: "field.itemGroup",
        section: "listView.sectionCategory",
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PRODUCT,
    fields: productFilterFields,
  });

  const combinedParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useProduct(combinedParams, {
    enabled: !isGridMode,
  });

  const grid = useGridPagination<ProductDetail>({
    useListHook: useProduct,
    params: combinedParams,
    enabled: isGridMode,
  });

  const products = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportProduct({
        params: combinedParams,
        columns: [
          { header: tfl("code"), value: (r) => r.code, width: 14 },
          { header: tfl("name"), value: (r) => r.name, width: 32 },
          {
            header: tfl("localName"),
            value: (r) => r.local_name ?? "",
            width: 28,
          },
          {
            header: tfl("unit"),
            value: (r) => r.inventory_unit?.name ?? "",
            width: 12,
          },
          {
            header: tfl("category"),
            value: (r) => r.product_category?.name ?? "",
            width: 18,
          },
          {
            header: tfl("subCategory"),
            value: (r) => r.product_sub_category?.name ?? "",
            width: 18,
          },
          {
            header: tfl("itemGroup"),
            value: (r) => r.product_item_group?.name ?? "",
            width: 18,
          },
          {
            header: tfl("status"),
            value: (r) => getProductStatusLabel(ts, r.product_status_type),
            width: 10,
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

  const table = useProductTable({
    products,
    totalRecords,
    params,
    tableConfig,
    onEdit: (product) =>
      navigate(`/product-management/product/${product.id}`, listReturnState()),
    onDelete: setDeleteTarget,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  const handleAddItem = () => {
    navigate("/product-management/product/new", listReturnState());
  };

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <DocumentListActions
          onExport={handleExport}
          isExporting={isExporting}
          onAdd={handleAddItem}
          addLabel={t("add")}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={productFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {/* Content */}
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && grid.error && (
        <ErrorState
          message={grid.error.message}
          onRetry={() => grid.refetch?.()}
        />
      )}
      {isGridMode && !grid.isLoading && !grid.error && products.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((item) => (
              <ProductCard
                key={item.id}
                item={item}
                onEdit={(p) =>
                  navigate(
                    `/product-management/product/${p.id}`,
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
      {isGridMode &&
        !grid.isLoading &&
        !grid.error &&
        products.length === 0 && <EmptyComponent />}
      {!isGridMode && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          tableLayout={{ headerSticky: true }}
          isLoading={isLoading}
          emptyMessage={<EmptyComponent />}
        >
          <DataGridContainer
            className={cn(
              "flex flex-col",
              listGridMaxH(lf.activeFilters.length > 0),
            )}
          >
            <div className="flex-1 overflow-auto">
              {/* 960px: หลังรวมชื่อไทย/หมวดเข้าคอลัมน์เดียว ตารางพอดีจอ 1366 (พื้นที่
                  ~1080px) — เดิม 1200px ดัน Status กับปุ่ม ⋯ ตกขอบขวา */}
              <div className="min-w-240">
                <DataGridTable />
              </div>
            </div>
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteProduct.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deleteProduct.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteProduct.mutate(deleteTarget.id, {
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
