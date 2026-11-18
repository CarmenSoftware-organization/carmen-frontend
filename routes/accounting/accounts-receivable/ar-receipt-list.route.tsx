import { useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { ListPageShell } from "@/components/share/list-page-shell";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { ErrorState } from "@/components/ui/error-state";
import { StatusChip } from "@/components/ui/status-chip";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useXlsxExport } from "@/hooks/use-xlsx-export";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { formatDate } from "@/lib/date-utils";
import type { FilterFieldDef } from "@/types/list-filter";
import {
  AR_RECEIPT_PATH,
  readReceipts,
  receiptTotals,
  type ArReceipt,
} from "./ar-receipt-model";
import { pageParamsOf, rowNumber } from "@/lib/row-number";
import { indexColumn } from "@/components/ui/data-grid/columns";

const fields: FilterFieldDef[] = [
  {
    key: "date",
    labelKey: "accounting.arReceipt.inputDate",
    control: "date-range",
    fieldKey: "date",
  },
  {
    key: "status",
    labelKey: "common.status",
    control: "status",
    options: ["draft", "void"].map((value) => ({
      value,
      labelKey: `accounting.arReceipt.statuses.${value}`,
    })),
  },
];

export function Component() {
  const bu = useBuCode();
  return bu ? <ReceiptList key={bu} bu={bu} /> : null;
}

function ReceiptList({ bu }: { readonly bu: string }) {
  "use no memo";
  const t = useTranslations("accounting.arReceipt");
  const tc = useTranslations("common");
  const navigate = useNavigate();
  const { canWrite } = useCan();
  const { dateFormat } = useProfile();
  const money = useAmountFormatter();
  const { exportToXlsx, isExporting } = useXlsxExport();
  const exportErrorToast = useExportErrorToast();
  const mobile = useIsMobile();
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const [loaded] = useState(() => {
    try {
      return { rows: readReceipts(bu), error: false };
    } catch {
      return { rows: [] as ArReceipt[], error: true };
    }
  });
  const { search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "date:desc",
  });
  const lf = useListFilters({ pageKey: LIST_PAGE_KEYS.AR_RECEIPT, fields });
  const [from, to] = (lf.values.date?.split(":").at(-1) ?? "").split(",");
  const rows = loaded.rows.filter(
    (row) =>
      (!lf.values.status || row.status === lf.values.status) &&
      (!from || row.date >= from) &&
      (!to || row.date <= to) &&
      [
        row.number,
        row.customerCode,
        row.customerName,
        row.description,
        row.sourceDoc,
      ]
        .join(" ")
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const open = (row: ArReceipt) => navigate(`${AR_RECEIPT_PATH}/${row.id}`);
  const amount = (value: number, receipt: ArReceipt) =>
    `${money(value)} ${receipt.currency}`;
  const column = (
    key: keyof ArReceipt,
    label: string,
  ): ColumnDef<ArReceipt> => ({
    accessorKey: key,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={label} />
    ),
    meta: { headerTitle: label },
  });
  const columns: ColumnDef<ArReceipt>[] = [
    indexColumn<ArReceipt>(),
    {
      ...column("number", t("number")),
      cell: ({ row }) => (
        <CellAction onClick={() => open(row.original)}>
          {row.original.number}
        </CellAction>
      ),
    },
    {
      ...column("date", t("inputDate")),
      cell: ({ row }) => formatDate(row.original.date, dateFormat),
    },
    {
      ...column("customerName", t("customer")),
      cell: ({ row }) => (
        <span
          className="block max-w-64 min-w-40 truncate"
          title={row.original.customerName}
        >
          {row.original.customerCode} · {row.original.customerName}
        </span>
      ),
    },
    column("sourceDoc", t("sourceDoc")),
    {
      id: "received",
      header: t("receivedAmount"),
      meta: {
        headerTitle: t("receivedAmount"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      },
      cell: ({ row }) =>
        amount(receiptTotals(row.original).received, row.original),
    },
    {
      id: "wht",
      header: t("whtAmount"),
      meta: {
        headerTitle: t("whtAmount"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      },
      cell: ({ row }) => amount(receiptTotals(row.original).wht, row.original),
    },
    {
      id: "allocated",
      header: t("appliedAmount"),
      meta: {
        headerTitle: t("appliedAmount"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      },
      cell: ({ row }) =>
        amount(receiptTotals(row.original).allocated, row.original),
    },
    {
      ...column("status", tc("status")),
      cell: ({ row }) => (
        <StatusChip
          status={row.original.status}
          label={t(`statuses.${row.original.status}`)}
        />
      ),
    },
  ];
  // This component opts out of React Compiler; TanStack owns the mutable table instance.
  // eslint-disable-next-line react-hooks/incompatible-library
  const table = useReactTable({
    ...tableConfig,
    data: rows,
    columns,
    getRowId: (row) => row.id,
    manualPagination: false,
    manualSorting: false,
    pageCount: Math.max(
      1,
      Math.ceil(rows.length / tableConfig.state.pagination.pageSize),
    ),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });
  const cards = mobile || display === "grid";
  async function exportRows() {
    try {
      const count = await exportToXlsx({
        fetch: async () => rows,
        sheetName: "AR Receipts",
        fileNamePrefix: "ar-receipt-mock",
        columns: [
          { header: t("number"), value: (row) => row.number },
          { header: t("inputDate"), value: (row) => row.date },
          { header: t("customer"), value: (row) => row.customerName },
          { header: t("currency"), value: (row) => row.currency },
          {
            header: t("receivedAmount"),
            value: (row) => receiptTotals(row).received,
          },
          {
            header: t("appliedAmount"),
            value: (row) => receiptTotals(row).allocated,
          },
          { header: t("whtAmount"), value: (row) => receiptTotals(row).wht },
          { header: tc("status"), value: (row) => t(`statuses.${row.status}`) },
        ],
      });
      if (count) toast.success(tc("exportSuccess", { count }));
      else toast.warning(tc("exportNoData"));
    } catch (error) {
      exportErrorToast(error);
    }
  }
  return (
    <ListPageShell
      title={t("title")}
      description={t("descriptionText")}
      count={rows.length}
      mock
      actions={
        <DocumentListActions
          onAdd={() => {
            if (canWrite) navigate(`${AR_RECEIPT_PATH}/new`);
          }}
          addLabel={t("newReceipt")}
          addDisabled={!canWrite}
          onExport={() => void exportRows()}
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
        />
      }
    >
      <p role="note" className="text-muted-foreground text-xs">
        {t("mockNotice")}
      </p>
      {loaded.error ? (
        <ErrorState message={t("storageError")} />
      ) : (
        <DataGrid
          table={table}
          recordCount={rows.length}
          emptyMessage={<EmptyComponent />}
          tableLayout={{ width: "auto" }}
        >
          <DataGridContainer
            className={listGridMaxH(lf.activeFilters.length > 0)}
          >
            {cards ? (
              <DataGridScrollArea>
                {!rows.length && <EmptyComponent />}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {table.getRowModel().rows.map(({ original: row }, i) => (
                    <ListCard
                      rowNo={rowNumber(
                        pageParamsOf(table.getState().pagination),
                        i,
                      )}
                      key={row.id}
                      title={row.number}
                      badge={
                        <StatusChip
                          status={row.status}
                          label={t(`statuses.${row.status}`)}
                        />
                      }
                      onOpen={() => open(row)}
                    >
                      <ListCardRow label={t("customer")}>
                        {row.customerName}
                      </ListCardRow>
                      <ListCardRow label={t("inputDate")}>
                        {formatDate(row.date, dateFormat)}
                      </ListCardRow>
                      <ListCardRow label={t("receivedAmount")}>
                        {amount(receiptTotals(row).received, row)}
                      </ListCardRow>
                      <ListCardRow label={t("appliedAmount")}>
                        {amount(receiptTotals(row).allocated, row)}
                      </ListCardRow>
                    </ListCard>
                  ))}
                </div>
              </DataGridScrollArea>
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
