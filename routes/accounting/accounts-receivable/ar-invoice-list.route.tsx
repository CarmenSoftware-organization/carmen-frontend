import { useState } from "react";
import { useNavigate } from "react-router";
import { useTranslations } from "use-intl";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { DocumentListActions } from "@/components/share/document-list-actions";
import {
  ListCard,
  ListCardRow,
  ListCardSkeleton,
  ListCardStatusRow,
} from "@/components/share/list-card";
import { ListPageShell } from "@/components/share/list-page-shell";
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
import { formatDate } from "@/lib/date-utils";
import type { FilterFieldDef } from "@/types/list-filter";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AR_REGISTER_PATH,
  AR_STATUS,
  AR_TYPES,
  useArRegister,
  useExportArRegister,
  type ArRegisterRow,
} from "./use-ar-register";

const fields: FilterFieldDef[] = [
  {
    key: "status",
    labelKey: "common.status",
    control: "multi-select",
    options: AR_STATUS.map((value) => ({
      value,
      labelKey: `accounting.arRegister.statuses.${value}`,
    })),
    toClause: (value) => `doc_status|string:${value}`,
  },
  {
    key: "type",
    labelKey: "accounting.arRegister.type",
    control: "multi-select",
    options: AR_TYPES.map((value) => ({
      value,
      labelKey: `accounting.arRegister.types.${value}`,
    })),
    toClause: (value) => `doc_type|string:${value}`,
  },
  {
    key: "date",
    labelKey: "accounting.arRegister.date",
    control: "date-range",
    fieldKey: "doc_date",
  },
];

export function Component() {
  "use no memo";
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const exportErrorToast = useExportErrorToast();
  const { exportInvoices, isExporting } = useExportArRegister();
  const navigate = useNavigate();
  const { canWrite } = useCan();
  const mobile = useIsMobile();
  const { dateFormat } = useProfile();
  const money = useAmountFormatter();
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const { params, search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "doc_date:desc",
  });
  const lf = useListFilters({ pageKey: LIST_PAGE_KEYS.AR_INVOICE, fields });
  const query = useArRegister({ ...params, filter: lf.filterParam });
  const rows = query.data?.data ?? [];
  const total = query.data?.paginate.total ?? 0;
  const open = (row: ArRegisterRow) =>
    navigate(`${AR_REGISTER_PATH}/${row.id}`, listReturnState());
  const amount = (value: string | number, row: ArRegisterRow) =>
    `${money(Number(value))} ${row.currency_code}`;
  const column = (
    id: keyof ArRegisterRow,
    label: string,
  ): ColumnDef<ArRegisterRow> => ({
    accessorKey: id,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={label} />
    ),
    meta: { headerTitle: label },
  });
  const columns: ColumnDef<ArRegisterRow>[] = [
    {
      ...column("doc_no", t("number")),
      cell: ({ row }) => (
        <CellAction onClick={() => open(row.original)}>
          {row.original.doc_no}
        </CellAction>
      ),
    },
    {
      ...column("doc_type", t("type")),
      cell: ({ row }) => t(`types.${row.original.doc_type}`),
    },
    column("customer_name", t("customer")),
    {
      ...column("doc_date", t("date")),
      cell: ({ row }) => formatDate(row.original.doc_date, dateFormat),
    },
    {
      ...column("due_date", t("due")),
      cell: ({ row }) => formatDate(row.original.due_date, dateFormat),
    },
    {
      ...column("total_amount", t("total")),
      cell: ({ row }) => amount(row.original.total_amount, row.original),
    },
    {
      ...column("outstanding_amount", t("outstanding")),
      cell: ({ row }) => amount(row.original.outstanding_amount, row.original),
    },
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
      const count = await exportInvoices(
        { ...params, filter: lf.filterParam },
        [
          { header: t("number"), value: (row) => row.doc_no },
          { header: t("type"), value: (row) => t(`types.${row.doc_type}`) },
          { header: t("customer"), value: (row) => row.customer_name },
          { header: t("date"), value: (row) => row.doc_date },
          { header: t("due"), value: (row) => row.due_date },
          { header: t("total"), value: (row) => row.total_amount },
          { header: t("outstanding"), value: (row) => row.outstanding_amount },
          {
            header: tc("status"),
            value: (row) => t(`statuses.${row.doc_status}`),
          },
          { header: tfl("currency"), value: (row) => row.currency_code },
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
      description={t("description")}
      count={query.data && total}
      actions={
        <DocumentListActions
          onAdd={() => navigate(`${AR_REGISTER_PATH}/new`, listReturnState())}
          addLabel={t("newInvoice")}
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
          onSaveViewClick={() => setSaveView(true)}
          table={table}
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
                  {rows.map((row) => (
                    <ListCard
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
                      <ListCardRow label={t("due")}>
                        {formatDate(row.due_date, dateFormat)}
                      </ListCardRow>
                      <ListCardRow label={t("outstanding")}>
                        {amount(row.outstanding_amount, row)}
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
