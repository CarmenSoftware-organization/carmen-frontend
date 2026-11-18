import { useMemo, useState, type ReactNode } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { ListPageShell } from "@/components/share/list-page-shell";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import type { ListPageKey } from "@/constant/list-page-keys";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { FilterFieldDef } from "@/types/list-filter";
import { pageParamsOf, rowNumber } from "@/lib/row-number";
import { indexColumn } from "@/components/ui/data-grid/columns";

export interface PreviewRecord {
  id: string;
  number: string;
  date: string;
  party: string;
  reference: string;
  amount: number;
  status: string;
}

export function PreviewStatus({ status }: { readonly status: string }) {
  const t = useTranslations("accounting.operations.statuses");
  const tone = ["cleared", "ready", "available"].includes(status)
    ? "success"
    : ["exception", "returned", "bounced", "void"].includes(status)
      ? "destructive"
      : "neutral";
  return <StatusDotBadge tone={tone}>{t(status)}</StatusDotBadge>;
}

export function PreviewSummary({
  items,
}: {
  readonly items: { label: string; value: ReactNode }[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-card rounded-lg border p-4">
          <div className="text-muted-foreground text-xs">{label}</div>
          <div className="mt-2 text-lg font-semibold tabular-nums">{value}</div>
        </div>
      ))}
    </div>
  );
}

export function PreviewRegister<T extends PreviewRecord>({
  title,
  description,
  pageKey,
  rows: allRows,
  statuses,
  onOpen,
  actions,
  summary,
  extraColumns,
  partyLabel,
  amountLabel,
  children,
}: {
  readonly title: string;
  readonly description: string;
  readonly pageKey: ListPageKey;
  readonly rows: T[];
  readonly statuses: string[];
  readonly onOpen: (record: T) => void;
  readonly actions?: ReactNode;
  readonly summary: ReactNode;
  readonly extraColumns: ColumnDef<T>[];
  readonly partyLabel: string;
  readonly amountLabel: string;
  readonly children?: ReactNode;
}) {
  "use no memo";
  const t = useTranslations("accounting.operations");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const mobile = useIsMobile();
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const { search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "date:desc",
  });
  const fields: FilterFieldDef[] = [
    {
      key: "status",
      control: "status",
      labelKey: "common.status",
      options: statuses.map((value) => ({
        value,
        labelKey: `accounting.operations.statuses.${value}`,
      })),
    },
  ];
  const lf = useListFilters({ pageKey, fields });
  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      allRows.filter(
        (row) =>
          (!lf.values.status || row.status === lf.values.status) &&
          [row.number, row.party, row.reference]
            .join(" ")
            .toLowerCase()
            .includes(query),
      ),
    [allRows, lf.values.status, query],
  );
  const columns = useMemo<ColumnDef<T>[]>(() => {
    const column = (
      key: keyof PreviewRecord,
      label: string,
      size: number,
    ): ColumnDef<T> => ({
      accessorKey: key,
      size,
      meta: { headerTitle: label },
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={label} />
      ),
    });
    return [
      indexColumn<T>(),
      {
        ...column("number", t("number"), 145),
        cell: ({ row }) => (
          <CellAction onClick={() => onOpen(row.original)}>
            {row.original.number}
          </CellAction>
        ),
      },
      {
        ...column("date", t("date"), 110),
        cell: ({ row }) => formatDate(row.original.date, dateFormat),
      },
      column("party", partyLabel, 200),
      column("reference", t("reference"), 170),
      {
        ...column("status", tc("status"), 140),
        cell: ({ row }) => <PreviewStatus status={row.original.status} />,
      },
      ...extraColumns,
      {
        ...column("amount", amountLabel, 145),
        meta: {
          headerTitle: amountLabel,
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
        cell: ({ row }) => money(row.original.amount),
      },
    ];
  }, [t, tc, onOpen, dateFormat, partyLabel, extraColumns, amountLabel, money]);
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
  return (
    <ListPageShell
      title={title}
      description={description}
      count={rows.length}
      mock
      actions={actions}
      toolbar={
        <ListToolbar
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={fields}
          table={table}
          onSaveViewClick={() => setSaveView(true)}
          displayMode={display}
          onDisplayModeChange={setDisplay}
        />
      }
    >
      <p
        role="note"
        className="bg-muted text-muted-foreground rounded-lg p-3 text-xs"
      >
        {t("mockNotice")}
      </p>
      {summary}
      <DataGrid
        table={table}
        recordCount={rows.length}
        emptyMessage={<EmptyComponent />}
      >
        <DataGridContainer>
          {cards ? (
            rows.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {table.getRowModel().rows.map(({ original: row }, i) => (
                  <ListCard
                    rowNo={rowNumber(
                      pageParamsOf(table.getState().pagination),
                      i,
                    )}
                    key={row.id}
                    title={row.number}
                    onOpen={() => onOpen(row)}
                  >
                    <PreviewStatus status={row.status} />
                    <ListCardRow label={partyLabel}>{row.party}</ListCardRow>
                    <ListCardRow label={t("date")}>
                      {formatDate(row.date, dateFormat)}
                    </ListCardRow>
                    <ListCardRow label={t("reference")}>
                      {row.reference}
                    </ListCardRow>
                    <ListCardRow label={amountLabel}>
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
      {children}
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
