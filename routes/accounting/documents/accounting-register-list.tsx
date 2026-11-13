import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { DocumentListActions } from "@/components/share/document-list-actions";
import {
  ListCard,
  ListCardRow,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { ListPageShell } from "@/components/share/list-page-shell";
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
import { StatusChip } from "@/components/ui/status-chip";
import type { ListPageKey } from "@/constant/list-page-keys";
import { useCan } from "@/hooks/use-can";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { useListFilters } from "@/hooks/use-list-filters";
import { listReturnState } from "@/hooks/use-list-return";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useXlsxExport } from "@/hooks/use-xlsx-export";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { FilterFieldDef } from "@/types/list-filter";
import {
  documentsFor,
  type AccountingDocument,
  type AccountingDocumentConfig,
} from "./accounting-document-model";

const fields: FilterFieldDef[] = [
  {
    key: "status",
    control: "status",
    labelKey: "common.status",
    options: ["draft", "pending", "approved", "posted", "paid", "overdue"].map(
      (value) => ({
        value,
        labelKey: `accounting.documents.statuses.${value}`,
      }),
    ),
  },
  {
    key: "date",
    control: "date-range",
    labelKey: "accounting.documents.date",
    fieldKey: "date",
  },
];

export default function AccountingRegisterList({
  config,
  pageKey,
}: {
  readonly config: AccountingDocumentConfig;
  readonly pageKey: ListPageKey;
}) {
  "use no memo";
  const t = useTranslations("accounting.documents");
  const tc = useTranslations("common");
  const { canWrite } = useCan();
  const navigate = useNavigate();
  const mobile = useIsMobile();
  const { dateFormat } = useProfile();
  const money = useAmountFormatter();
  const exportErrorToast = useExportErrorToast();
  const { exportToXlsx, isExporting } = useXlsxExport();
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const { search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "date:desc",
  });
  const lf = useListFilters({ pageKey, fields });
  const allRows = useMemo(() => documentsFor(config), [config]);
  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const [from, to] = (lf.values.date?.split(":").at(-1) ?? "").split(",");
    return allRows.filter(
      (row) =>
        (!lf.values.status || row.status.toLowerCase() === lf.values.status) &&
        (!from || row.date >= from) &&
        (!to || row.date <= to) &&
        [row.number, row.description, row.party]
          .join(" ")
          .toLowerCase()
          .includes(query),
    );
  }, [allRows, search, lf.values]);
  const open = (row: AccountingDocument) =>
    navigate(`${config.path}/${row.id}`, listReturnState());
  const columns: ColumnDef<AccountingDocument>[] = (
    ["number", "date", "description", "party", "status", "amount"] as const
  ).map((key) => ({
    accessorKey: key,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={t(key)} />
    ),
    meta: {
      headerTitle: t(key),
      ...(key === "amount" && {
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      }),
    },
    cell: ({ row: { original: row } }) =>
      key === "number" ? (
        <CellAction onClick={() => open(row)}>{row.number}</CellAction>
      ) : key === "date" ? (
        formatDate(row.date, dateFormat)
      ) : key === "status" ? (
        <StatusChip
          status={row.status.toLowerCase()}
          label={t(`statuses.${row.status.toLowerCase()}`)}
        />
      ) : key === "amount" ? (
        money(row.amount)
      ) : (
        row[key]
      ),
  }));
  const table = useReactTable({
    ...tableConfig,
    data: rows,
    columns,
    getRowId: (row) => row.id,
    manualPagination: false,
    manualSorting: false,
    pageCount: Math.ceil(rows.length / tableConfig.state.pagination.pageSize),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });
  async function handleExport() {
    try {
      const count = await exportToXlsx({
        fetch: async () =>
          table.getSortedRowModel().rows.map((row) => row.original),
        columns: (
          [
            "number",
            "date",
            "description",
            "party",
            "status",
            "amount",
          ] as const
        ).map((key) => ({
          header: t(key),
          value: (row: AccountingDocument) =>
            key === "status"
              ? t(`statuses.${row.status.toLowerCase()}`)
              : row[key],
        })),
        sheetName: config.prefix,
        fileNamePrefix: `${config.prefix}_MOCK`,
      });
      if (!count) toast.warning(tc("exportNoData"));
      else toast.success(tc("exportSuccess", { count }));
    } catch (error) {
      exportErrorToast(error);
    }
  }
  const cards = mobile || display === "grid";
  return (
    <ListPageShell
      title={t(`${config.kind}.title`)}
      description={t(`${config.kind}.description`)}
      count={rows.length}
      mock
      actions={
        <DocumentListActions
          onAdd={() => {
            if (canWrite) navigate(`${config.path}/new`, listReturnState());
          }}
          addLabel={t("new")}
          addDisabled={!canWrite}
          onExport={() => void handleExport()}
          isExporting={isExporting}
        />
      }
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={fields}
          table={table}
          displayMode={display}
          onDisplayModeChange={setDisplay}
          onSaveViewClick={() => setSaveView(true)}
        />
      }
    >
      <DataGrid
        table={table}
        recordCount={rows.length}
        tableLayout={{ headerSticky: true }}
        emptyMessage={<EmptyComponent />}
      >
        <DataGridContainer
          className={
            cards
              ? undefined
              : cn("flex flex-col", listGridMaxH(lf.activeFilters.length > 0))
          }
        >
          {cards ? (
            rows.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {table.getRowModel().rows.map(({ original: row }) => (
                  <ListCard
                    key={row.id}
                    title={row.number}
                    onOpen={() => open(row)}
                  >
                    <ListCardStatusRow
                      status={row.status.toLowerCase()}
                      label={t(`statuses.${row.status.toLowerCase()}`)}
                    />
                    <ListCardRow label={t("date")}>
                      {formatDate(row.date, dateFormat)}
                    </ListCardRow>
                    <ListCardRow label={t("party")}>{row.party}</ListCardRow>
                    <ListCardRow label={t("description")}>
                      {row.description}
                    </ListCardRow>
                    <ListCardRow label={t("amount")}>
                      {money(row.amount)}
                    </ListCardRow>
                  </ListCard>
                ))}
              </div>
            ) : (
              <EmptyComponent />
            )
          ) : (
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
          )}
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>
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
