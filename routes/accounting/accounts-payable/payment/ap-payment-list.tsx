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
  ApPayment,
  ApDocStatus,
  ApPaymentMethod,
} from "@/types/accounts-payable";
import { useApPayments } from "../shared/use-accounts-payable";
import { useApPaymentTable } from "./use-ap-payment-table";

/** ใหม่สุดขึ้นก่อน */
const DEFAULT_SORT = "payment_date:desc";

const STATUSES: ApDocStatus[] = ["draft", "in_review", "posted", "void"];
const METHODS: ApPaymentMethod[] = [
  "bank_transfer",
  "cheque",
  "cash",
  "credit_card",
  "promptpay",
];

/**
 * หน้ารายการ AP payment (backend จริง) — โครงเดียวกับหน้า list ของ JV
 *
 * ตัวกรองส่งเป็น clause ของ `filter` (`doc_status|string:...`) · param เก่าของ
 * หน้า mock (lifecycle, execution, release, urgent, method …)
 * ไม่มีใครอ่าน จึงถูกข้ามเงียบ ๆ
 */
export default function ApPaymentList() {
  const t = useTranslations("accounting.accountsPayable.payment");
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
        key: "method",
        control: "custom",
        labelKey: "accounting.accountsPayable.payment.method",
        section: "listView.sectionDocument",
        render: (value, onChange) => (
          <MultiSelectFilter
            value={value}
            onChange={onChange}
            options={METHODS.map((m) => ({
              value: `payment_method|string:${m}`,
              label: t(`methods.${m}`),
            }))}
            className="w-full"
          />
        ),
      },
      {
        key: "vendor_id",
        control: "entity",
        entity: VENDOR_ENTITY,
        labelKey: "accounting.accountsPayable.payment.vendor",
        section: "listView.sectionDocument",
      },
    ],
    [t],
  );

  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.AP_PAYMENT,
    fields: filterFields,
    defaultSort: DEFAULT_SORT,
  });

  const queryParams = { ...params, filter: lf.filterParam };
  const { data, isLoading, error, refetch } = useApPayments(queryParams, {
    enabled: !useInfiniteScroll,
  });
  const grid = useGridPagination<ApPayment>({
    useListHook: useApPayments,
    params: queryParams,
    enabled: useInfiniteScroll,
  });
  const payments = useInfiniteScroll ? grid.items : (data?.data ?? []);
  const totalRecords = useInfiniteScroll
    ? grid.totalRecords
    : (data?.paginate?.total ?? 0);
  const cardsLoading = useInfiniteScroll ? grid.isLoading : isLoading;

  const openPayment = (payment: ApPayment) =>
    navigate(
      `/accounting/accounts-payable/payment/${payment.id}`,
      listReturnState(),
    );

  const table = useApPaymentTable({
    payments,
    totalRecords,
    params,
    tableConfig,
    onOpen: openPayment,
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
          onClick={() => navigate("/accounting/accounts-payable/payment/new")}
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
        ) : payments.length === 0 ? (
          <EmptyComponent />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {payments.map((payment) => (
              <ListCard
                key={payment.id}
                title={payment.doc_no}
                onOpen={() => openPayment(payment)}
              >
                <ListCardStatusRow
                  status={payment.doc_status}
                  label={t(`statuses.${payment.doc_status}`)}
                />
                <ListCardRow label={t("vendor")}>
                  {payment.vendor_name}
                </ListCardRow>
                <ListCardRow label={t("paymentDate")}>
                  <span className="tabular-nums">
                    {formatDate(payment.payment_date, dateFormat)}
                  </span>
                </ListCardRow>
                <ListCardRow label={t("bankAccount")}>
                  {payment.bank_account_name}
                </ListCardRow>
                <ListCardRow label={t("method")}>
                  {t(`methods.${payment.payment_method}`)}
                </ListCardRow>
                <ListCardRow label={t("netPaid")}>
                  <span className="tabular-nums">
                    {formatAmount(Number(payment.net_paid_amount))}{" "}
                    {payment.currency_code}
                  </span>
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
