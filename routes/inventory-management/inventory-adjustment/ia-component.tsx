import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { Download, Loader2, MoreHorizontal, Printer } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { cn } from "@/lib/utils";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { Button } from "@/components/ui/button";
import {
  useInventoryAdjustment,
  useDeleteInventoryAdjustment,
  useExportInventoryAdjustment,
} from "./use-inventory-adjustment";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import {
  INVENTORY_ADJUSTMENT_BASE_PATH,
  getAdjustmentType,
  type InventoryAdjustment,
} from "@/types/inventory-adjustment";
import { IA_TYPE_ICON } from "@/constant/inventory-adjustment";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { StatusFilter } from "@/components/ui/status-filter";
import { useAdjustmentType } from "@/hooks/use-adjustment-type";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import type { AdjustmentType } from "@/types/adjustment-type";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { useInventoryAdjustmentTable } from "./use-ia-table";
import IaCardList from "./ia-card-list";
import { useListFilters } from "@/hooks/use-list-filters";
import { setURLParams } from "@/hooks/use-url";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";

// ไม่กรอง is_active — หน้า list ต้องกรองใบเก่าที่อ้างประเภทที่ถูกปิดไปแล้วได้
const ADJUSTMENT_TYPE_ENTITY = defineEntitySource<AdjustmentType>({
  fieldKey: "adjustment_type_id",
  useListHook: useAdjustmentType,
  getLabel: (at) => `${at.code} - ${at.name}`,
  serverFilter: null,
});

export default function InventoryAdjustmentComponent() {
  const navigate = useNavigate();
  const t = useTranslations("inventoryManagement.inventoryAdjustment");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tt = useTranslations("toast");
  const ts = useTranslations("status");
  const tfl = useTranslations("field");
  const [deleteTarget, setDeleteTarget] = useState<InventoryAdjustment | null>(
    null,
  );
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const isGridMode = isMobile || displayMode === "grid";
  // Infinite scroll สำหรับทุกโหมด grid (mobile auto + desktop card view)
  // โหมด list (desktop table) ยังคงใช้ pagination ปกติ
  const useInfiniteScroll = isGridMode;
  const deleteInventoryAdjustment = useDeleteInventoryAdjustment();
  const { exportInventoryAdjustment, isExporting } =
    useExportInventoryAdjustment();
  const { params, search, setSearch, tableConfig } = useDataGridState();

  // ตัวกรองประเภทการปรับปรุง (adjustment type ของ BU เช่น EOP-IN, FN) แยกจากตัวกรอง
  // Type (SI/SO) ข้างล่าง — control "entity" ค้นที่ server โหลดทีละหน้า
  // เลือกหลายตัว = `adjustment_type_id|string:a,b` (IN)

  // ของเดิมเก็บ type+status ปนกันใน "filter" ตัวเดียว (CSV) — แยกเป็น 2 URL param
  // ("filter" คง status, "adj_type" ใหม่คง type) ตามชื่อที่ตั้งไว้ในหน้า config
  // adjustment-type (adj_type) เพื่อให้แต่ละ field มี chip ลบเองอิสระได้ (ของเดิม
  // ลบได้ทีละตัวอยู่แล้วผ่าน activeFilters เดิม) ลิงก์เก่าที่มี "filter" รวมทั้งคู่ถูก
  // แยกออกให้อัตโนมัติตอน mount โดย effect ข้างล่าง (oldBookmarkNormalizedRef) —
  // ทั้ง pre-select ในชีทและ filterParam จึงถูกต้องทั้งคู่ ไม่ต้องกดเลือกใหม่
  const iaFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "adj_type",
        section: "listView.sectionDocument",
        control: "custom",
        labelKey: "field.type",
        render: (value, onChange) => (
          <StatusFilter
            value={value}
            onChange={onChange}
            options={[
              { label: ts("stockIn"), value: "type|string:stock-in" },
              { label: ts("stockOut"), value: "type|string:stock-out" },
            ]}
            placeholder={tfl("type")}
            defaultLabel={ts("allType")}
            className="w-full"
          />
        ),
      },
      {
        key: "adjustment_type",
        section: "listView.sectionDocument",
        control: "entity",
        entity: ADJUSTMENT_TYPE_ENTITY,
        labelKey: "field.adjustmentType",
      },
      {
        key: "filter",
        section: "listView.sectionDocument",
        control: "status",
        labelKey: "common.status",
        options: [
          {
            labelKey: "status.in_progress",
            value: "doc_status|string:in_progress",
          },
          {
            labelKey: "status.completed",
            value: "doc_status|string:completed",
          },
          { labelKey: "status.draft", value: "doc_status|string:draft" },
          { labelKey: "status.voided", value: "doc_status|string:voided" },
        ],
      },
    ],
    [ts, tfl],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.INVENTORY_ADJUSTMENT,
    fields: iaFilterFields,
  });

  // ลิงก์เก่าก่อน migrate เก็บ type+status ปนกันใน "filter" ตัวเดียว (CSV เช่น
  // "doc_status|string:completed,type|string:stock-in") ถ้าเปิดลิงก์นั้นแล้วผู้ใช้
  // แก้แค่ adj_type อย่างเดียว encodeFilterParam จะปล่อยทั้ง clause ใหม่ของ adj_type
  // และ clause "type|string:..." เก่าที่ยังค้างอยู่ใน filter ออกไปพร้อมกัน → backend
  // เห็น clause "type" ขัดแย้งกันสองอัน (ผลลัพธ์ผิดเงียบ ๆ) แยกออกครั้งเดียวตอน mount:
  // ส่วน doc_status เขียนกลับ "filter" ส่วน type ย้ายไป "adj_type" ใน setURLParams
  // ครั้งเดียว — ลิงก์เก่าจะ pre-select ถูกทั้งคู่ในชีท และไม่ชนกันอีกต่อไป
  const oldBookmarkNormalizedRef = useRef(false);
  useEffect(() => {
    if (oldBookmarkNormalizedRef.current) return;
    oldBookmarkNormalizedRef.current = true;
    const rawFilter = lf.values.filter;
    if (rawFilter?.includes("type|string:")) {
      const parts = rawFilter
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const typePart = parts.find((p) => p.startsWith("type|string:")) ?? "";
      const statusParts = parts.filter((p) => !p.startsWith("type|string:"));
      setURLParams({
        filter: statusParts.join(","),
        adj_type: typePart,
        page: "",
      });
    }
  }, [lf.values.filter]);

  const queryParams = { ...params, filter: lf.filterParam };

  const handleExport = async () => {
    try {
      const count = await exportInventoryAdjustment({
        params: queryParams,
        columns: [
          {
            header: tfl("adjustment"),
            value: (r) => r.si_no ?? r.so_no ?? "",
            width: 22,
          },
          {
            header: tfl("date"),
            value: (r) => r.si_date ?? r.so_date ?? "",
            width: 12,
          },
          {
            header: tfl("type"),
            value: (r) =>
              ts(getAdjustmentType(r) === "stock-in" ? "stockIn" : "stockOut"),
            width: 12,
          },
          {
            header: tfl("location"),
            value: (r) => r.location_name ?? "",
            width: 22,
          },
          {
            header: tfl("reason"),
            value: (r) => r.adjustment_type_name ?? "",
            width: 22,
          },
          {
            header: tfl("items"),
            value: (r) => r.item_count ?? 0,
            width: 8,
          },
          {
            header: tfl("total"),
            value: (r) => r.base_total_cost ?? 0,
            width: 14,
          },
          {
            header: tfl("status"),
            value: (r) => r.doc_status,
            width: 14,
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

  const { data, isLoading, error, refetch } = useInventoryAdjustment(
    queryParams,
    {
      enabled: !useInfiniteScroll,
    },
  );

  const grid = useGridPagination<InventoryAdjustment>({
    useListHook: useInventoryAdjustment,
    params: queryParams,
    enabled: useInfiniteScroll,
  });

  const items = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const navigateToItem = (item: InventoryAdjustment) =>
    navigate(
      `${INVENTORY_ADJUSTMENT_BASE_PATH}/${item.id}?type=${getAdjustmentType(item)}`,
      listReturnState(),
    );

  const table = useInventoryAdjustmentTable({
    items,
    totalRecords,
    params,
    tableConfig,
    onEdit: navigateToItem,
    onDelete: setDeleteTarget,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="hidden sm:inline-flex"
          >
            {isExporting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {isExporting ? tc("exporting") : tc("export")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => globalThis.print()}
            className="hidden sm:inline-flex"
          >
            <Printer aria-hidden="true" />
            {tc("print")}
          </Button>
          {(() => {
            const StockInIcon = IA_TYPE_ICON["stock-in"];
            const StockOutIcon = IA_TYPE_ICON["stock-out"];
            return (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `${INVENTORY_ADJUSTMENT_BASE_PATH}/new?type=stock-in`,
                      listReturnState(),
                    )
                  }
                >
                  <StockInIcon
                    aria-hidden="true"
                    className="text-success-ink"
                  />
                  {t("addStockIn")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `${INVENTORY_ADJUSTMENT_BASE_PATH}/new?type=stock-out`,
                      listReturnState(),
                    )
                  }
                >
                  <StockOutIcon
                    aria-hidden="true"
                    className="text-destructive"
                  />
                  {t("addStockOut")}
                </Button>
              </>
            );
          })()}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-11 w-11 shrink-0 sm:hidden"
                aria-label={tc("aria.moreActions")}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {isExporting ? tc("exporting") : tc("export")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => globalThis.print()}>
                <Printer aria-hidden="true" />
                {tc("print")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={iaFilterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
        />
      }
    >
      {/* Content */}
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
          <IaCardList
            pageParams={useInfiniteScroll ? undefined : params}
            items={items}
            isLoading={useInfiniteScroll ? grid.isLoading : isLoading}
            onEdit={navigateToItem}
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
          !open && !deleteInventoryAdjustment.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", {
          documentNo: deleteTarget?.si_no ?? deleteTarget?.so_no ?? "",
        })}
        isPending={deleteInventoryAdjustment.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteInventoryAdjustment.mutate(
            {
              id: deleteTarget.id,
              type: getAdjustmentType(deleteTarget),
            },
            {
              onSuccess: () => {
                toast.success(tt("deleteSuccess", { entity: t("entity") }));
                setDeleteTarget(null);
              },
            },
          );
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
