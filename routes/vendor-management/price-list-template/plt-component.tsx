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
  usePriceListTemplate,
  useDeletePriceListTemplate,
  useExportPriceListTemplate,
} from "@/hooks/use-price-list-template";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import type { PriceListTemplate } from "@/types/price-list-template";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { usePriceListTemplateTable } from "./use-plt-table";
import PltCard from "./plt-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { useElementWidth } from "@/hooks/use-element-width";
import { rowNumber } from "@/lib/row-number";

export default function PriceListTemplateComponent() {
  const navigate = useNavigate();
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const ts = useTranslations("status");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const [deleteTarget, setDeleteTarget] = useState<PriceListTemplate | null>(
    null,
  );
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deletePriceListTemplate = useDeletePriceListTemplate();
  const { exportPriceListTemplate, isExporting } = useExportPriceListTemplate();
  const { params, search, setSearch, tableConfig } = useDataGridState();
  // ตารางเลือกคอลัมน์จากความกว้างกล่องของมันเอง (ลบขอบ 1px สองข้างของ DataGridContainer)
  const [setGridBox, gridBoxWidth] = useElementWidth();

  // ป้ายเป็น i18n ให้ตรงกับป้ายในตาราง — ค่าเป็น clause เต็มต่อตัว
  // MultiSelectFilter join เองเมื่อเลือกหลายตัว
  const statusOptions = useMemo(
    () =>
      (["draft", "active", "inactive"] as const).map((status) => ({
        label: ts(status),
        value: `status|string:${status}`,
      })),
    [ts],
  );

  // field เดียว — ไม่มี vendor/business_type/date param อื่นในโค้ดเดิม (grep ทั้ง
  // ไฟล์ยืนยันแล้ว) · ใช้ MultiSelectFilter แทน control: "status" (Select ข้อความ
  // เปล่า) เพื่อให้เมนูมีไอคอนสถานะชุดเดียวกับคอลัมน์ในตาราง ไอคอนมาจากค่าท้าย
  // value (`status|string:draft` → draft) ผ่าน lookupIcon ไม่ต้องประกาศซ้ำ
  const priceListTemplateFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        section: "listView.sectionDocument",
        control: "custom",
        labelKey: "common.status",
        // custom control ไม่มี `options` ให้ chip ไปหา label เอง — ไม่ใส่ตัวนี้
        // chip จะกลายเป็นค่าดิบ ("draft") แทนป้ายภาษาไทย
        valueText: (value) => {
          const selected = new Set(value.split(","));
          const labels = statusOptions
            .filter((o) => selected.has(o.value))
            .map((o) => o.label);
          return labels.length > 1
            ? `${labels[0]} +${labels.length - 1}`
            : labels[0];
        },
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={statusOptions}
            className="w-full"
          />
        ),
      },
    ],
    [statusOptions],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PRICE_LIST_TEMPLATE,
    fields: priceListTemplateFilterFields,
  });

  const queryParams = { ...params, filter: lf.filterParam };

  const isGridMode = isMobile || displayMode === "grid";

  const { data, isLoading, error, refetch } = usePriceListTemplate(
    queryParams,
    { enabled: !isGridMode },
  );

  const grid = useGridPagination<PriceListTemplate>({
    useListHook: usePriceListTemplate,
    params: queryParams,
    enabled: isGridMode,
  });

  const templates = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportPriceListTemplate({
        params: queryParams,
        columns: [
          { header: tfl("name"), value: (r) => r.name, width: 28 },
          {
            header: tfl("currency"),
            value: (r) => r.currency?.code ?? "",
            width: 10,
          },
          {
            header: tfl("validityPeriod"),
            value: (r) =>
              r.validity_period == null
                ? ""
                : t("validityDays", { count: r.validity_period }),
            width: 16,
          },
          {
            header: tfl("status"),
            value: (r) => ts(r.status as "draft" | "active" | "inactive"),
            width: 12,
          },
          {
            header: tfl("description"),
            value: (r) => r.description ?? "",
            width: 40,
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

  const table = usePriceListTemplateTable({
    templates,
    totalRecords,
    params,
    tableConfig,
    onEdit: (template) =>
      navigate(
        `/vendor-management/price-list-template/${template.id}`,
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
              "/vendor-management/price-list-template/new",
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
          fields={priceListTemplateFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && templates.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((item, i) => (
              <PltCard
                rowNo={rowNumber(undefined, i)}
                key={item.id}
                item={item}
                onEdit={(tpl) =>
                  navigate(
                    `/vendor-management/price-list-template/${tpl.id}`,
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
      {isGridMode && !grid.isLoading && templates.length === 0 && (
        <EmptyComponent />
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
          !open && !deletePriceListTemplate.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deletePriceListTemplate.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePriceListTemplate.mutate(deleteTarget.id, {
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
