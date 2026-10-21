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
  usePriceList,
  useDeletePriceList,
  useExportPriceList,
} from "@/hooks/use-price-list";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { useCurrency } from "@/hooks/use-currency";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import type { PriceList, PriceListStatus } from "@/types/price-list";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import type { Currency } from "@/types/currency";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import { usePriceListTable } from "./use-pl-table";
import PriceListCard from "./pl-card";
import { useListFilters } from "@/hooks/use-list-filters";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import type { FilterFieldDef } from "@/types/list-filter";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { VENDOR_ENTITY } from "@/components/filter/entity-sources";
import { setURLParams, useURL } from "@/hooks/use-url";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, subDays } from "date-fns";

// "current" ไม่ใช่ "active" — คำว่า active เป็นสถานะเอกสารอยู่แล้ว (ใบ DRAFT ก็ยังอยู่ในช่วงราคาได้)
const VALIDITY_TABS = ["current", "expired", "all"] as const;
type Validity = (typeof VALIDITY_TABS)[number];

// เรียงตามงานของแต่ละแท็บ: ใบที่ใกล้หมดขึ้นก่อน (ต้องต่อราคา) / ใบที่เพิ่งหมดขึ้นก่อน
const VALIDITY_DEFAULT_SORT: Record<Validity, string> = {
  current: "effective_to_date:asc",
  expired: "effective_to_date:desc",
  all: "pricelist_no:asc",
};

/**
 * แยกใบตามวันสิ้นสุดเทียบวันนี้ (ปฏิทินเครื่องผู้ใช้ ปลายช่วงนับรวม — นิยามเดียวกับ
 * periodValidity ในคอลัมน์ช่วงวันที่) กรองที่ server เพราะรายการแบ่งหน้า
 * · "ยังมีผล" รวมใบที่ยังไม่ถึงวันเริ่มด้วย — ยังไม่หมดอายุ ฝ่ายจัดซื้อต้องเห็นล่วงหน้า
 * · ขอบล่าง 0001 ไม่ใช่ 1970 — มีใบที่พิมพ์ปีผิด (เช่น 0302) ซึ่งต้องโผล่ในแท็บหมดอายุ
 */
function validityClause(validity: Validity, now: Date): string | undefined {
  if (validity === "current")
    return `effective_to_date|date_range:${format(now, "yyyy-MM-dd")},9999-12-31`;
  if (validity === "expired")
    return `effective_to_date|date_range:0001-01-01,${format(subDays(now, 1), "yyyy-MM-dd")}`;
  return undefined;
}

// ค่าที่ URL เก็บคือรหัสสกุล (`currency_code|string:THB,USD`) ไม่ใช่ id — ดึงชื่อตาม `code`
const CURRENCY_ENTITY = defineEntitySource<Currency>({
  fieldKey: "currency_code",
  useListHook: useCurrency,
  getId: (c) => c.code,
  getLabel: (c) => c.code,
  idFilterKey: "code",
});

export default function PriceListComponent() {
  const navigate = useNavigate();
  const t = useTranslations("vendorManagement.priceList");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const ts = useTranslations("status");
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");
  const [deleteTarget, setDeleteTarget] = useState<PriceList | null>(null);
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const deletePriceList = useDeletePriceList();
  const { exportPriceList, isExporting } = useExportPriceList();
  const [validityParam] = useURL("validity", { defaultValue: "current" });
  const validity: Validity = (VALIDITY_TABS as readonly string[]).includes(
    validityParam,
  )
    ? (validityParam as Validity)
    : "current";
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: VALIDITY_DEFAULT_SORT[validity],
  });

  // ป้ายเป็น i18n (ไม่ใช่ createStatusFilterOptions ที่เป็นอังกฤษล้วน) ให้ตรงกับ
  // ป้ายในตาราง — ค่าเป็น clause เต็มต่อตัว MultiSelectFilter join เองเมื่อเลือกหลายตัว
  const statusOptions = useMemo(
    () =>
      (["draft", "submitted", "active", "inactive"] as const).map((status) => ({
        label: ts(status),
        value: `status|string:${status}`,
      })),
    [ts],
  );

  const priceListFilterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        // MultiSelectFilter แทน control: "status" (Select ข้อความเปล่า) เพื่อให้
        // เมนูมีไอคอนสถานะชุดเดียวกับคอลัมน์ในตาราง — ไอคอนมาจากค่าท้าย value
        // (`status|string:draft` → draft) ผ่าน lookupIcon ไม่ต้องประกาศซ้ำ
        // ผลพลอยได้คือเลือกได้หลายสถานะเหมือนรายการเอกสารอื่น (PR/PO)
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
      {
        key: "currency",
        control: "entity",
        entity: CURRENCY_ENTITY,
        labelKey: "field.currency",
        section: "listView.sectionDocument",
      },
      {
        // ทะเบียน vendor ใหญ่หลักร้อย KB — control "entity" ยิงรายการเองตอนเปิด
        // popover ทีละหน้า ส่วนชื่อบน chip ดึงเฉพาะ id ที่เลือก (EntityChipValue)
        key: "vendor",
        section: "listView.sectionPeople",
        control: "entity",
        entity: VENDOR_ENTITY,
        labelKey: "field.vendor",
      },
      {
        // กรองที่วันเริ่มมีผล (effective_from_date) — ความหมายเดียวกับคอลัมน์
        // ช่วงวันที่มีผลบน list ที่เรียงด้วยวันเริ่มเช่นกัน
        key: "effective_from",
        control: "date-range",
        labelKey: "field.effectivePeriod",
        fieldKey: "effective_from_date",
        section: "listView.sectionDate",
      },
    ],
    [statusOptions],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.PRICE_LIST,
    fields: priceListFilterFields,
    defaultSort: VALIDITY_DEFAULT_SORT[validity],
  });

  const filter =
    [lf.filterParam, validityClause(validity, new Date())]
      .filter(Boolean)
      .join(";") || undefined;
  const queryParams = { ...params, filter };

  const isGridMode = isMobile || displayMode === "grid";

  const { data, isLoading, error, refetch } = usePriceList(queryParams, {
    enabled: !isGridMode,
  });

  const grid = useGridPagination<PriceList>({
    useListHook: usePriceList,
    params: queryParams,
    enabled: isGridMode,
  });

  const priceLists = isGridMode ? grid.items : (data?.data ?? []);
  const totalRecords = isGridMode
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);

  const handleExport = async () => {
    try {
      const count = await exportPriceList({
        params: queryParams,
        columns: [
          { header: "No.", value: (r) => r.no, width: 18 },
          { header: tfl("name"), value: (r) => r.name, width: 28 },
          {
            header: tfl("vendor"),
            value: (r) => r.vendor?.name ?? "",
            width: 24,
          },
          {
            header: tfl("effectivePeriod"),
            value: (r) => r.effectivePeriod ?? "",
            width: 28,
          },
          {
            header: tfl("status"),
            value: (r) =>
              ts(r.status as PriceListStatus),
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

  const table = usePriceListTable({
    priceLists,
    totalRecords,
    params,
    tableConfig,
    onEdit: (priceList) =>
      navigate(
        `/vendor-management/price-list/${priceList.id}`,
        listReturnState(),
      ),
    onDelete: setDeleteTarget,
    quietExpired: validity === "expired",
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
            navigate("/vendor-management/price-list/new", listReturnState())
          }
          addLabel={t("add")}
        />
      }
      toolbar={
        <div className="flex flex-col gap-2">
          {/* เลขหน้าค้างไว้อาจไม่มีจริงในอีกแท็บ — กลับหน้า 1 และคืน sort เริ่มต้นของแท็บ */}
          <Tabs
            value={validity}
            onValueChange={(next) =>
              setURLParams({ validity: next, page: "", sort: "" })
            }
          >
            {/* px-0: ให้เส้นใต้แท็บแรกชิดขอบเดียวกับช่องค้นหาด้านล่าง */}
            <TabsList
              variant="line"
              className="px-0"
              aria-label={t("validityAria")}
            >
              <TabsTrigger value="current">{t("validityCurrent")}</TabsTrigger>
              <TabsTrigger value="expired">{t("validityExpired")}</TabsTrigger>
              <TabsTrigger value="all">{t("validityAll")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <ListToolbar
            search={search}
            onSearch={setSearch}
            lf={lf}
            fields={priceListFilterFields}
            onSaveViewClick={() => setSaveViewDialogOpen(true)}
            table={table}
            displayMode={displayMode}
            onDisplayModeChange={setDisplayMode}
          />
        </div>
      }
    >
      {isGridMode && grid.isLoading && <CardSkeletonGrid />}
      {isGridMode && !grid.isLoading && priceLists.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {priceLists.map((item) => (
              <PriceListCard
                key={item.id}
                item={item}
                onEdit={(pl) =>
                  navigate(
                    `/vendor-management/price-list/${pl.id}`,
                    listReturnState(),
                  )
                }
                onDelete={setDeleteTarget}
                quietExpired={validity === "expired"}
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
      {isGridMode && !grid.isLoading && priceLists.length === 0 && (
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
          !open && !deletePriceList.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.name ?? "" })}
        isPending={deletePriceList.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deletePriceList.mutate(deleteTarget.id, {
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
