import { useMemo, useState } from "react";
import {
  CalendarPlus,
  Download,
  MoreHorizontal,
  Printer,
} from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useInventoryPeriod,
  useInventoryPeriodAll,
  useGenerateNextInventoryPeriod,
  useExportInventoryPeriod,
} from "./use-inventory-period";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { Loader2 } from "lucide-react";
import type { InventoryPeriod } from "@/types/inventory-period";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import InventoryPeriodCard from "./inventory-period-card";
import {
  INVENTORY_PERIOD_STATUS_OPTIONS,
  INVENTORY_PERIOD_STATUS_CONFIG,
} from "@/constant/inventory-period";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { StatusFilter } from "@/components/ui/status-filter";
import { cn } from "@/lib/utils";
import { useInventoryPeriodTable } from "./use-inventory-period-table";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { InventoryPeriodTimeline } from "./inventory-period-timeline";
import { todayDateInput } from "./inventory-period-phase";

/** จำนวนรอบที่เปิดอยู่ที่ปุ่ม "เติมรอบ" จะเติมให้ครบ */
const GENERATE_TARGET = 12;

export default function InventoryPeriodComponent() {
  const generateNext = useGenerateNextInventoryPeriod();
  const { exportInventoryPeriod, isExporting } = useExportInventoryPeriod();
  const isMobile = useIsMobile();
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const { currentPeriod } = useProfile();
  const today = todayDateInput();
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tt = useTranslations("toast");

  // INVENTORY_PERIOD_STATUS_OPTIONS มา createStatusFilterOptions — label เป็น literal
  // string ล้วน (เช่น "OPEN") ไม่ใช่ i18n key จึงต้องใช้ control: "custom" ห่อ
  // StatusFilter ตรง ๆ แทน control: "status" ทั่วไป — เหมือน pattern ของ
  // PO_TYPE/CN_TYPE ใน Task 19
  const inventoryPeriodFilterFields = useMemo<FilterFieldDef[]>(
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
            options={INVENTORY_PERIOD_STATUS_OPTIONS}
            className="w-full"
          />
        ),
      },
    ],
    [],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PERIOD,
    fields: inventoryPeriodFilterFields,
  });

  const combinedParams = { ...params, filter: lf.filterParam };

  const useInfiniteScroll = !!isMobile;
  const { data, isLoading, error, refetch } = useInventoryPeriod(
    combinedParams,
    {
      enabled: !useInfiniteScroll,
    },
  );

  const grid = useGridPagination<InventoryPeriod>({
    useListHook: useInventoryPeriod,
    params: combinedParams,
    enabled: useInfiniteScroll,
  });

  const handleExport = async () => {
    try {
      const count = await exportInventoryPeriod({
        params: combinedParams,
        columns: [
          { header: t("period"), value: (r) => r.period, width: 14 },
          {
            header: t("fiscalYear"),
            value: (r) => r.fiscal_year ?? 0,
            width: 12,
          },
          {
            header: t("fiscalMonth"),
            value: (r) => r.fiscal_month ?? 0,
            width: 12,
          },
          { header: t("startAt"), value: (r) => r.start_at ?? "", width: 14 },
          { header: t("endAt"), value: (r) => r.end_at ?? "", width: 14 },
          {
            header: t("status"),
            value: (r) =>
              INVENTORY_PERIOD_STATUS_CONFIG[r.status]?.label ?? r.status,
            width: 12,
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

  // แถบไทม์ไลน์และจำนวนรอบที่ปุ่ม "เติมรอบ" จะสร้าง ต้องเห็นรอบ **ทั้งหมด**
  // ไม่ใช่หน้าปัจจุบันของตาราง — รอบมีปีละ 12 แถว ดึงทั้งหมดได้สบาย
  const { data: allData } = useInventoryPeriodAll();
  const allPeriods = allData ?? [];
  // BU ที่ยังไม่มีรอบเลย — ไม่มีปุ่ม "เพิ่ม" แล้ว ทางเดียวที่จะเริ่มได้คือ "เติมรอบ" ซึ่งซ่อนอยู่ใน
  // เมนู ⋯ empty state จึงต้องยื่นปุ่มนั้นให้ตรง ๆ ไม่งั้นหน้าเปล่าไม่บอกว่าต้องทำอะไรต่อ
  // (`allData` ยัง undefined = กำลังโหลด ไม่ใช่ว่าง)
  const hasNoPeriods = allData !== undefined && allPeriods.length === 0;
  const emptyState = hasNoPeriods ? (
    <EmptyComponent
      icon={CalendarPlus}
      title={t("emptyTitle")}
      description={t("emptyDesc")}
      content={
        <Button
          size="sm"
          disabled={generateNext.isPending}
          onClick={() => setGenerateOpen(true)}
        >
          <CalendarPlus aria-hidden="true" />
          {t("emptyAction")}
        </Button>
      }
    />
  ) : (
    <EmptyComponent />
  );
  // backend เติมรอบที่เปิดอยู่ให้ครบ count ไม่ใช่สร้างเพิ่ม count รอบ
  // (micro-business inventory-period.service.ts generateNextPeriods)
  const openCount = allPeriods.filter((p) => p.status === "open").length;
  const toCreate = Math.max(0, GENERATE_TARGET - openCount);

  const periods = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const table = useInventoryPeriodTable({
    periods,
    totalRecords,
    params,
    tableConfig,
    currentPeriodId: currentPeriod?.id,
    today,
  });

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* ไม่มีปุ่ม "เพิ่ม" — รอบใหม่เกิดจากการปิดงวด วันที่กำหนดโดยระบบ
              งานที่เหลือ (เติมรอบ/ส่งออก/พิมพ์) อยู่ในเมนูเดียวกันทุกขนาดจอ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="size-11 shrink-0 sm:size-8"
                aria-label={tc("aria.moreActions")}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60">
              <DropdownMenuItem
                disabled={generateNext.isPending || toCreate === 0}
                onSelect={() => setGenerateOpen(true)}
              >
                <CalendarPlus aria-hidden="true" />
                <span className="flex flex-col">
                  {t("generateNext")}
                  {toCreate === 0 && (
                    <span className="text-muted-foreground text-xs">
                      {t("generateNothing")}
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {isExporting ? tc("exporting") : tc("export")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => globalThis.print()}>
                <Printer aria-hidden="true" />
                {tc("print")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      toolbar={
        <>
          {allPeriods.length > 0 && (
            <InventoryPeriodTimeline
              periods={allPeriods}
              currentPeriodId={currentPeriod?.id}
              currentFiscalYear={currentPeriod?.fiscal_year}
              today={today}
            />
          )}

          <ListToolbar
            variant="row"
            search={search}
            onSearch={setSearch}
            lf={lf}
            fields={inventoryPeriodFilterFields}
            onSaveViewClick={() => setSaveViewDialogOpen(true)}
          />
        </>
      }
    >
      {isMobile ? (
        grid.isLoading ? (
          <CardSkeletonGrid />
        ) : grid.error ? (
          <ErrorState
            message={grid.error.message}
            onRetry={() => grid.refetch?.()}
          />
        ) : periods.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              {periods.map((p) => (
                <InventoryPeriodCard
                  key={p.id}
                  item={p}
                  isCurrent={p.id === currentPeriod?.id}
                  today={today}
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
        ) : (
          emptyState
        )
      ) : (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true }}
          emptyMessage={emptyState}
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

      <ConfirmDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title={t("generateTitle")}
        description={t("generateDesc", { open: openCount, create: toCreate })}
        confirmIcon={<CalendarPlus aria-hidden="true" />}
        isPending={generateNext.isPending}
        onConfirm={() =>
          generateNext.mutate(
            { count: GENERATE_TARGET, start_day: 1 },
            {
              onSuccess: () => {
                setGenerateOpen(false);
                toast.success(tt("createSuccess", { entity: t("entity") }));
              },
            },
          )
        }
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
