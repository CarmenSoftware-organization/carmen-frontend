import { useEffect, useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import {
  Download,
  Loader2,
  MoreHorizontal,
  Printer,
  RefreshCw,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { StatusFilter } from "@/components/ui/status-filter";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { buildXlsxFileName, downloadXlsx } from "@/lib/xlsx-utils";
import type { FilterFieldDef } from "@/types/list-filter";
import {
  FolioActions,
  FolioDialog,
  type FolioAction,
} from "./ar-folio-actions";
import {
  filterFolios,
  folioSummary,
  readFolioSamples,
  saveFolioSamples,
  type ArFolio,
} from "./ar-folio-model";

const fields: FilterFieldDef[] = [
  {
    key: "status",
    labelKey: "common.status",
    control: "custom",
    render: (value, onChange) => (
      <FolioStatusControl value={value} onChange={onChange} />
    ),
  },
  {
    key: "type",
    labelKey: "accounting.arFolio.type",
    control: "status",
    options: [
      ...["city_ledger", "credit_card"].map((value) => ({
        value,
        labelKey: `accounting.arFolio.types.${value}`,
      })),
    ],
  },
  {
    key: "date",
    labelKey: "accounting.arFolio.date",
    control: "date-range",
    fieldKey: "folio_date",
  },
];

function FolioStatusControl({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
}) {
  const t = useTranslations("accounting.arFolio");
  const tc = useTranslations("common");
  return (
    <StatusFilter
      value={value === "all" ? "" : value || "pending"}
      onChange={(next) => onChange(next || "all")}
      defaultLabel={tc("allStatus")}
      options={["pending", "billed", "void"].map((status) => ({
        value: status,
        label: t(`statuses.${status}`),
      }))}
    />
  );
}

export function Component() {
  const bu = useBuCode();
  return bu ? <FolioList key={bu} bu={bu} /> : null;
}

function FolioList({ bu }: { readonly bu: string }) {
  "use no memo";
  const t = useTranslations("accounting.arFolio");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const mobile = useIsMobile();
  const [records, setRecords] = useState(() => readFolioSamples(bu));
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [action, setAction] = useState<{
    folio: ArFolio;
    action: FolioAction;
  } | null>(null);
  const { search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "date:desc",
  });
  const localizedFields = useMemo<FilterFieldDef[]>(
    () => [
      {
        ...fields[0],
        valueText: (value) =>
          value === "all" ? tc("allStatus") : t(`statuses.${value}`),
      },
      ...fields.slice(1),
    ],
    [t, tc],
  );
  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.AR_FOLIO,
    fields: localizedFields,
  });
  const {
    values: { status },
    setValue,
  } = lf;
  useEffect(() => {
    if (!status) setValue("status", "pending");
  }, [status, setValue]);
  const rows = useMemo(
    () => filterFolios(records, search, lf.values),
    [records, search, lf.values],
  );
  const summary = folioSummary(rows);
  const open = (folio: ArFolio, next: FolioAction = "invoices") =>
    setAction({ folio, action: next });
  const column = (
    id: keyof ArFolio,
    label: string,
    size: number,
  ): ColumnDef<ArFolio> => ({
    accessorKey: id,
    size,
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={label} />
    ),
    meta: { headerTitle: label },
  });
  const columns: ColumnDef<ArFolio>[] = [
    {
      ...column("date", t("folioDate"), 150),
      cell: ({ row: { original: folio } }) => (
        <div className="space-y-1">
          <CellAction onClick={() => open(folio)}>{folio.folioNo}</CellAction>
          <div className="text-muted-foreground text-xs">
            {formatDate(folio.date, dateFormat)}
          </div>
          <Badge variant="secondary" size="xs">
            {folio.guestNo}
          </Badge>
        </div>
      ),
    },
    {
      ...column("customerName", t("customer"), 180),
      cell: ({ row: { original: folio } }) => (
        <div className="space-y-1 whitespace-normal">
          <div className="font-medium">
            {folio.customerCode} · {folio.customerName}
          </div>
          <div className="text-muted-foreground text-xs">{folio.contact}</div>
        </div>
      ),
    },
    {
      ...column("description", t("descriptionColumn"), 170),
      meta: { headerTitle: t("descriptionColumn") },
      cell: ({ row: { original: folio } }) => (
        <div className="space-y-1 whitespace-normal">
          <div>{folio.description}</div>
          <div className="text-muted-foreground text-xs">
            {folio.syncRemark}
          </div>
        </div>
      ),
    },
    ...(["amount", "taxAmount", "total", "unbilled"] as const).map(
      (key): ColumnDef<ArFolio> => ({
        ...column(key, t(key), 100),
        meta: {
          headerTitle: t(key),
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
        },
        cell: ({ row }) =>
          key === "unbilled" ? (
            <span
              className={
                row.original.unbilled > 0
                  ? "text-warning-ink font-medium"
                  : "text-success-ink"
              }
            >
              {money(row.original[key])}
            </span>
          ) : (
            money(row.original[key])
          ),
      }),
    ),
    {
      ...column("source", t("source"), 70),
      cell: ({ row }) => (
        <Badge variant="secondary">{row.original.source}</Badge>
      ),
    },
    {
      ...column("status", tc("status"), 110),
      cell: ({ row }) => (
        <div className="flex flex-wrap items-center justify-between gap-1">
          <StatusDotBadge
            tone={
              row.original.status === "pending"
                ? "warning"
                : row.original.status === "billed"
                  ? "success"
                  : "destructive"
            }
          >
            {t(`statuses.${row.original.status}`)}
          </StatusDotBadge>
          <FolioActions
            folio={row.original}
            open={(next) => open(row.original, next)}
          />
        </div>
      ),
    },
  ];
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
  async function exportRows() {
    setExporting(true);
    try {
      await downloadXlsx({
        rows,
        sheetName: "Folio",
        fileName: buildXlsxFileName("AR_Folio_MOCK"),
        columns: [
          { header: t("folioDate"), value: (row) => row.folioNo },
          { header: t("date"), value: (row) => row.date },
          {
            header: t("customer"),
            value: (row) => `${row.customerCode} · ${row.customerName}`,
          },
          ...(["amount", "taxAmount", "total", "unbilled"] as const).map(
            (key) => ({ header: t(key), value: (row: ArFolio) => row[key] }),
          ),
          { header: tc("status"), value: (row) => t(`statuses.${row.status}`) },
        ],
      });
    } catch {
      toast.error(t("exportError"));
    } finally {
      setExporting(false);
    }
  }
  const cards = mobile || display === "grid";
  return (
    <ListPageShell
      title={t("title")}
      description={t("description")}
      count={rows.length}
      mock
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={() => void exportRows()}
            disabled={exporting}
            className="hidden sm:inline-flex"
          >
            {exporting ? <Loader2 className="animate-spin" /> : <Download />}
            {tc(exporting ? "exporting" : "export")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => globalThis.print()}
            className="hidden sm:inline-flex"
          >
            <Printer />
            {tc("print")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-11 w-11 shrink-0 sm:hidden"
                aria-label={tc("aria.moreActions")}
              >
                <MoreHorizontal />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => void exportRows()}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Download />
                )}
                {tc(exporting ? "exporting" : "export")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => globalThis.print()}>
                <Printer />
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
          fields={localizedFields}
          table={table}
          onSaveViewClick={() => setSaveView(true)}
          displayMode={display}
          onDisplayModeChange={setDisplay}
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("refresh")}
              onClick={() => {
                try {
                  setRecords(readFolioSamples(bu));
                } catch {
                  toast.error(t("storageError"));
                }
              }}
            >
              <RefreshCw />
            </Button>
          }
        />
      }
    >
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(["count", "total", "unbilled", "billed"] as const).map((key) => (
          <Card key={key}>
            <CardContent className="space-y-1 p-3">
              <div className="text-muted-foreground text-xs">
                {t(`summary.${key}`)}
              </div>
              <div className="text-base font-semibold tabular-nums">
                {key === "count" ? summary[key] : money(summary[key])}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <DataGrid
        table={table}
        recordCount={rows.length}
        emptyMessage={<EmptyComponent />}
        tableLayout={{ rowClamp: false, cellAlign: "top" }}
      >
        <DataGridContainer>
          {cards ? (
            rows.length ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {table.getRowModel().rows.map(({ original: folio }) => (
                  <ListCard
                    key={folio.id}
                    title={folio.folioNo}
                    onOpen={() => open(folio)}
                    actions={
                      <FolioActions
                        folio={folio}
                        open={(next) => open(folio, next)}
                      />
                    }
                  >
                    <ListCardRow label={tc("status")}>
                      <StatusDotBadge
                        tone={
                          folio.status === "pending"
                            ? "warning"
                            : folio.status === "billed"
                              ? "success"
                              : "destructive"
                        }
                      >
                        {t(`statuses.${folio.status}`)}
                      </StatusDotBadge>
                    </ListCardRow>
                    <ListCardRow label={t("date")}>
                      {formatDate(folio.date, dateFormat)}
                    </ListCardRow>
                    <ListCardRow label={t("customer")}>
                      {folio.customerCode} · {folio.customerName}
                    </ListCardRow>
                    <ListCardRow label={t("descriptionColumn")}>
                      {folio.description}
                    </ListCardRow>
                    {(
                      ["amount", "taxAmount", "total", "unbilled"] as const
                    ).map((key) => (
                      <ListCardRow key={key} label={t(key)}>
                        {money(folio[key])}
                      </ListCardRow>
                    ))}
                    <ListCardRow label={t("source")}>
                      {folio.source}
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
      {action && (
        <FolioDialog
          key={`${action.folio.id}-${action.action}`}
          {...action}
          close={() => setAction(null)}
          save={(updated) => {
            try {
              const next = records.map((folio) =>
                folio.id === updated.id ? updated : folio,
              );
              saveFolioSamples(bu, next);
              setRecords(next);
              setAction(null);
            } catch {
              toast.error(t("storageError"));
            }
          }}
        />
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
