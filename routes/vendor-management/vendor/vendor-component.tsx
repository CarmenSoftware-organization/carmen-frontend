import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { cn } from "@/lib/utils";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import {
  useVendor,
  useDeleteVendor,
  useExportVendor,
} from "@/hooks/use-vendor";
import { useBusinessType } from "@/hooks/use-business-type";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import type { Vendor, VendorDetail } from "@/types/vendor";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import type { BusinessType } from "@/types/business-type";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { useVendorTable } from "./use-vendor-table";
import VendorCard from "./vendor-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";

const BUSINESS_TYPE_ENTITY = defineEntitySource<BusinessType>({
  fieldKey: "business_type_id",
  useListHook: useBusinessType,
  getLabel: (bt) => bt.name,
});

export default function VendorComponent() {
  const navigate = useNavigate();
  const t = useTranslations("vendorManagement.vendor");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const tt = useTranslations("toast");
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deleteVendor = useDeleteVendor();
  const { exportVendor, isExporting } = useExportVendor();
  const { params, search, setSearch, tableConfig } = useDataGridState();

  const isGridMode = isMobile || displayMode === "grid";

  // filter (status) ไม่ส่ง options — ใช้ default is_active|bool:true/false ของ
  // StatusFilter · business_type เป็น control "entity" (ค้นที่ server, chip ขึ้นชื่อ)
  const vendorFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        control: "status",
        labelKey: "common.status",
        section: "listView.sectionDocument",
      },
      {
        key: "business_type",
        section: "listView.sectionDocument",
        control: "entity",
        entity: BUSINESS_TYPE_ENTITY,
        labelKey: "field.businessType",
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.VENDOR,
    fields: vendorFilterFields,
  });

  const combinedParams = { ...params, filter: lf.filterParam };

  const { data, isLoading, error, refetch } = useVendor(combinedParams, {
    enabled: !isGridMode,
  });

  const grid = useGridPagination<VendorDetail>({
    useListHook: useVendor,
    params: combinedParams,
    enabled: isGridMode,
  });

  const vendors = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportVendor({
        params: combinedParams,
        columns: [
          { header: tfl("code"), value: (r) => r.code, width: 14 },
          { header: tfl("name"), value: (r) => r.name, width: 32 },
          {
            header: tfl("businessType"),
            value: (r) =>
              r.business_type?.map((bt) => bt.name).join(", ") ?? "",
            width: 32,
          },
          {
            header: t("rating"),
            value: (r) => r.rating ?? null,
            width: 10,
          },
          {
            header: tfl("status"),
            value: (r) => (r.is_active ? ts("active") : ts("inactive")),
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

  const table = useVendorTable({
    vendors,
    totalRecords,
    params,
    tableConfig,
    onEdit: (vendor) =>
      navigate(`/vendor-management/vendor/${vendor.id}`, listReturnState()),
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
            navigate("/vendor-management/vendor/new", listReturnState())
          }
          addLabel={t("add")}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={vendorFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && vendors.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {vendors.map((item) => (
              <VendorCard
                key={item.id}
                item={item}
                onEdit={(v) =>
                  navigate(
                    `/vendor-management/vendor/${v.id}`,
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
      {isGridMode && !grid.isLoading && vendors.length === 0 && (
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
          !open && !deleteVendor.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deleteVendor.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteVendor.mutate(deleteTarget.id, {
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
