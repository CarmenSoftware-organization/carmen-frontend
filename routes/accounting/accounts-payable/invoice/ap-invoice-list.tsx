import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { Loader2, Plus, RefreshCw } from "lucide-react";
import { listReturnState } from "@/hooks/use-list-return";
import { useIsMobile } from "@/hooks/use-mobile";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { MultiSelectFilter } from "@/components/ui/multi-select-filter";
import { ErrorState } from "@/components/ui/error-state";
import { Button } from "@/components/ui/button";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import {
  ListCard,
  ListCardRow,
  ListCardSkeleton,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { VENDOR_ENTITY } from "@/components/filter/entity-sources";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { FilterFieldDef } from "@/types/list-filter";
import type {
  ApInvoice,
  ApDocStatus,
  ApDocType,
} from "@/types/accounts-payable";
import { useApInvoices } from "../shared/use-accounts-payable";
import { ApFromGrnBadge, ApSettlementBadge } from "./ap-invoice-badges";
import { useApInvoiceTable } from "./use-ap-invoice-table";

/** ใหม่สุดขึ้นก่อน */
const DEFAULT_SORT = "doc_date:desc";

const STATUSES: ApDocStatus[] = ["draft", "in_review", "posted", "void"];
const DOC_TYPES: ApDocType[] = [
  "invoice",
  "debit_note",
  "credit_note",
  "deposit",
];

/**
 * หน้ารายการ AP invoice (backend จริง) — โครงเดียวกับหน้า list ของ JV
 *
 * ตัวกรองส่งเป็น clause ของ `filter` (`doc_status|string:...`) · param เก่าของ
 * หน้า mock (lifecycle, settlement, due_bucket, as_of, tax, hold, match …)
 * ไม่มีใครอ่าน จึงถูกข้ามเงียบ ๆ
 */
export default function ApInvoiceList() {
  const t = useTranslations("accounting.accountsPayable.invoice");
  const tc = useTranslations("common");
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const isGridMode = isMobile || displayMode === "grid";
  // โหมด grid ทั้งมือถือและ desktop ไม่มี pager จึงโหลดต่อด้วย infinite scroll
  const useInfiniteScroll = isGridMode;

  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: DEFAULT_SORT,
  });

  const filterFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        key: "filter",
        control: "custom",
        labelKey: "common.status",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={STATUSES.map((s) => ({
              value: `doc_status|string:${s}`,
              label: t(`statuses.${s}`),
              statusKey: s,
            }))}
            className="w-full"
          />
        ),
      },
      {
        key: "doc_type",
        control: "custom",
        labelKey: "accounting.accountsPayable.invoice.docType",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={DOC_TYPES.map((d) => ({
              value: `doc_type|string:${d}`,
              label: t(`docTypes.${d}`),
            }))}
            className="w-full"
          />
        ),
      },
      {
        key: "source",
        control: "custom",
        labelKey: "accounting.accountsPayable.invoice.source",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={[
              { value: "doc_source|string:grn_auto", label: t("fromGrn") },
            ]}
            className="w-full"
          />
        ),
      },
      {
        key: "vendor_id",
        control: "entity",
        entity: VENDOR_ENTITY,
        labelKey: "accounting.accountsPayable.invoice.vendor",
        section: "listView.sectionDocument",
      },
    ],
    [t],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.AP_INVOICE,
    fields: filterFields,
    defaultSort: DEFAULT_SORT,
  });

  const queryParams = { ...params, filter: lf.filterParam };
  const { data, isLoading, error, refetch } = useApInvoices(queryParams, {
    enabled: !useInfiniteScroll,
  });
  const grid = useGridPagination<ApInvoice>({
    useListHook: useApInvoices,
    params: queryParams,
    enabled: useInfiniteScroll,
  });
  const invoices = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);
  const cardsLoading = useInfiniteScroll ? grid.isLoading : isLoading;

  const openInvoice = (invoice: ApInvoice) =>
    navigate(
      `/accounting/accounts-payable/invoice/${invoice.id}`,
      listReturnState(),
    );

  const table = useApInvoiceTable({
    invoices,
    totalRecords,
    params,
    tableConfig,
    onOpen: openInvoice,
  });

  if (error)
    return (
      <ErrorState
        error={error}
        message={t("loadError")}
        onRetry={() => refetch()}
      />
    );

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <Button
          size="sm"
          onClick={() => navigate("/accounting/accounts-payable/invoice/new")}
        >
          <Plus className="size-4" /> {t("add")}
        </Button>
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={filterFields}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
          table={table}
          displayMode={displayMode}
          onDisplayModeChange={setDisplayMode}
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => (useInfiniteScroll ? grid.refetch?.() : refetch())}
              aria-label={tc("refresh")}
              title={tc("refresh")}
            >
              <RefreshCw className="size-4" />
            </Button>
          }
        />
      }
    >
      {!isGridMode && (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true, columnsResizable: true }}
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

      {isGridMode &&
        (cardsLoading ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ListCardSkeleton key={`skeleton-${i}`} />
            ))}
          </div>
        ) : invoices.length === 0 ? (
          <EmptyComponent />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {invoices.map((invoice) => (
              <ListCard
                key={invoice.id}
                title={invoice.doc_no}
                badge={<ApFromGrnBadge invoice={invoice} />}
                onOpen={() => openInvoice(invoice)}
              >
                <ListCardStatusRow
                  status={invoice.doc_status}
                  label={t(`statuses.${invoice.doc_status}`)}
                />
                <ListCardRow label={t("vendor")}>
                  {invoice.vendor_name}
                </ListCardRow>
                <ListCardRow label={t("docDate")}>
                  <span className="tabular-nums">
                    {formatDate(invoice.doc_date, dateFormat)}
                  </span>
                </ListCardRow>
                <ListCardRow label={t("docType")}>
                  {t(`docTypes.${invoice.doc_type}`)}
                </ListCardRow>
                <ListCardRow label={t("outstanding")}>
                  <span className="tabular-nums">
                    {formatAmount(Number(invoice.outstanding_amount))}{" "}
                    {invoice.currency_code}
                  </span>
                </ListCardRow>
                <ListCardRow label={t("settlement")}>
                  <ApSettlementBadge invoice={invoice} />
                </ListCardRow>
              </ListCard>
            ))}
          </div>
        ))}

      {isGridMode && useInfiniteScroll && grid.hasMore && (
        <div ref={grid.sentinelRef} className="flex justify-center py-4">
          {grid.isLoadingMore && (
            <Loader2 className="text-muted-foreground size-5 animate-spin" />
          )}
        </div>
      )}

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
