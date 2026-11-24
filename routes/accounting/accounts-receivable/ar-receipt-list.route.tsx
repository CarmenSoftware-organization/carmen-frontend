import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { ListPageShell } from "@/components/share/list-page-shell";
import {
  ListCard,
  ListCardRow,
  ListCardSkeleton,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusChip } from "@/components/ui/status-chip";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useCan } from "@/hooks/use-can";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { listReturnState } from "@/hooks/use-list-return";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { formatDate } from "@/lib/date-utils";
import { rowNumber } from "@/lib/row-number";
import type { FilterFieldDef } from "@/types/list-filter";
import type { ColumnDef } from "@tanstack/react-table";
import { AR_RECEIPT_PATH } from "./ar-receipt-model";
import {
  AR_RECEIPT_STATUS,
  useArReceipts,
  useExportArReceipts,
  type ArReceiptRow,
} from "./use-ar-receipt";

const fields: FilterFieldDef[] = [
  {
    key: "date",
    labelKey: "accounting.arReceipt.inputDate",
    control: "date-range",
    fieldKey: "receipt_date",
  },
  {
    key: "status",
    labelKey: "common.status",
    control: "multi-select",
    options: AR_RECEIPT_STATUS.map((value) => ({
      value,
      labelKey: `accounting.arReceipt.statuses.${value}`,
    })),
    toClause: (value) => `doc_status|string:${value}`,
  },
];

export function Component() {
  "use no memo";
  const t = useTranslations("accounting.arReceipt");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const { exportReceipts, isExporting } = useExportArReceipts();
  const navigate = useNavigate();
  const { canWrite } = useCan();
  const mobile = useIsMobile();
  const { dateFormat } = useProfile();
  const money = useAmountFormatter();
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "receipt_date:desc",
  });
  const lf = useListFilters({ pageKey: LIST_PAGE_KEYS.AR_RECEIPT, fields });
  const query = useArReceipts({ ...params, filter: lf.filterParam });
  const rows = query.data?.data ?? [];
  const total = query.data?.paginate.total ?? 0;
  const open = (row: ArReceiptRow) =>
    navigate(`${AR_RECEIPT_PATH}/${row.id}`, listReturnState());
  const amount = (value: string | number | undefined, row: ArReceiptRow) =>
    `${money(Number(value ?? 0))} ${row.currency_code ?? ""}`.trim();
  const column = (
    id: keyof ArReceiptRow,
    label: string,
  ): ColumnDef<ArReceiptRow> => ({
    accessorKey: id,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={label} />
    ),
    meta: { headerTitle: label },
  });
  const amountColumn = (
    id:
      "net_received_amount" | "total_applied_amount" | "total_unapplied_amount",
    label: string,
  ): ColumnDef<ArReceiptRow> => ({
    ...column(id, label),
    meta: {
      headerTitle: label,
      headerClassName: "text-right",
      cellClassName: "text-right tabular-nums",
    },
    cell: ({ row }) => amount(row.original[id], row.original),
  });
  const columns: ColumnDef<ArReceiptRow>[] = [
    {
      ...column("doc_no", t("number")),
      cell: ({ row }) => (
        <CellAction onClick={() => open(row.original)}>
          {row.original.doc_no}
        </CellAction>
      ),
    },
    {
      ...column("receipt_date", t("inputDate")),
      cell: ({ row }) => formatDate(row.original.receipt_date, dateFormat),
    },
    {
      ...column("customer_name", t("customer")),
      cell: ({ row }) => (
        <span
          className="block max-w-64 min-w-40 truncate"
          title={row.original.customer_name}
        >
          {[row.original.customer_code, row.original.customer_name]
            .filter(Boolean)
            .join(" · ")}
        </span>
      ),
    },
    amountColumn("net_received_amount", t("receivedAmount")),
    amountColumn("total_applied_amount", t("appliedAmount")),
    amountColumn("total_unapplied_amount", t("unapplied")),
    {
      ...column("doc_status", tc("status")),
      cell: ({ row }) => (
        <StatusChip
          status={row.original.doc_status}
          label={t(`statuses.${row.original.doc_status}`)}
        />
      ),
    },
  ];
  const table = useConfigTable({
    data: rows,
    columns,
    totalRecords: total,
    params,
    tableConfig,
    hideStatus: true,
  });
  async function handleExport() {
    try {
      const count = await exportReceipts(
        { ...params, filter: lf.filterParam },
        [
          { header: t("number"), value: (row) => row.doc_no },
          { header: t("inputDate"), value: (row) => row.receipt_date },
          { header: t("customer"), value: (row) => row.customer_name },
          { header: t("currency"), value: (row) => row.currency_code ?? "" },
          {
            header: t("receivedAmount"),
            value: (row) => row.net_received_amount,
          },
          {
            header: t("appliedAmount"),
            value: (row) => row.total_applied_amount ?? "",
          },
          {
            header: t("unapplied"),
            value: (row) => row.total_unapplied_amount ?? "",
          },
          {
            header: tc("status"),
            value: (row) => t(`statuses.${row.doc_status}`),
          },
        ],
      );
      if (!count) toast.warning(tc("exportNoData"));
      else toast.success(tc("exportSuccess", { count }));
    } catch (error) {
      exportErrorToast(error);
    }
  }
  const cards = mobile || display === "grid";
  return (
    <ListPageShell
      title={t("title")}
      description={t("descriptionText")}
      count={query.data && total}
      actions={
        <DocumentListActions
          onAdd={() => {
            if (canWrite) navigate(`${AR_RECEIPT_PATH}/new`, listReturnState());
          }}
          addLabel={t("newReceipt")}
          addDisabled={!canWrite}
          onExport={() => void handleExport()}
          isExporting={isExporting}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          table={table}
          lf={lf}
          fields={fields}
          onSaveViewClick={() => setSaveView(true)}
          displayMode={display}
          onDisplayModeChange={setDisplay}
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => void query.refetch()}
              aria-label={tc("refresh")}
            >
              <RefreshCw className="size-4" />
            </Button>
          }
        />
      }
    >
      {query.error ? (
        <ErrorState
          error={query.error}
          message={t("loadError")}
          onRetry={() => query.refetch()}
        />
      ) : (
        <DataGrid
          table={table}
          recordCount={total}
          isLoading={query.isPending}
          emptyMessage={<EmptyComponent />}
          tableLayout={{ headerSticky: true }}
        >
          <DataGridContainer
            className={
              cards ? undefined : listGridMaxH(lf.activeFilters.length > 0)
            }
          >
            {cards ? (
              query.isPending ? (
                <ListCardSkeleton />
              ) : rows.length === 0 ? (
                <EmptyComponent />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {rows.map((row, i) => (
                    <ListCard
                      rowNo={rowNumber(params, i)}
                      key={row.id}
                      title={row.doc_no}
                      onOpen={() => open(row)}
                    >
                      <ListCardStatusRow
                        status={row.doc_status}
                        label={t(`statuses.${row.doc_status}`)}
                      />
                      <ListCardRow label={t("customer")}>
                        {row.customer_name}
                      </ListCardRow>
                      <ListCardRow label={t("inputDate")}>
                        {formatDate(row.receipt_date, dateFormat)}
                      </ListCardRow>
                      <ListCardRow label={t("receivedAmount")}>
                        {amount(row.net_received_amount, row)}
                      </ListCardRow>
                      <ListCardRow label={t("appliedAmount")}>
                        {amount(row.total_applied_amount, row)}
                      </ListCardRow>
                    </ListCard>
                  ))}
                </div>
              )
            ) : (
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            )}
            <DataGridPagination />
          </DataGridContainer>
        </DataGrid>
      )}
      <SaveViewDialog
        open={saveView}
        onOpenChange={setSaveView}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}
