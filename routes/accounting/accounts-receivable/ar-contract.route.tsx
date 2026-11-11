import { useMemo, useState } from "react";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Eye, FileText, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { DocumentListActions } from "@/components/share/document-list-actions";
import {
  ListCard,
  ListCardActiveRow,
  ListCardRow,
} from "@/components/share/list-card";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useListFilters } from "@/hooks/use-list-filters";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { round2 } from "@/lib/currency-utils";
import { formatDate } from "@/lib/date-utils";
import { buildXlsxFileName, downloadXlsx } from "@/lib/xlsx-utils";
import type { FilterFieldDef } from "@/types/list-filter";
import { ContractDialog, ContractDocumentDialog } from "./ar-contract-dialog";
import {
  deleteContractSample,
  readContractSamples,
  saveContractSample,
  type ArContract,
} from "./ar-contract-model";

const fields: FilterFieldDef[] = [
  {
    key: "status",
    labelKey: "common.status",
    control: "status",
    options: [
      { value: "active", labelKey: "status.active" },
      { value: "inactive", labelKey: "status.inactive" },
    ],
  },
  {
    key: "date",
    labelKey: "accounting.arContract.startDate",
    control: "date-range",
    fieldKey: "start_date",
  },
];

export function Component() {
  const bu = useBuCode();
  return bu ? <ContractList key={bu} bu={bu} /> : null;
}

function ContractList({ bu }: { readonly bu: string }) {
  "use no memo";
  const t = useTranslations("accounting.arContract");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const { canWrite } = useCan();
  const money = useAmountFormatter();
  const rate = useAmountFormatter(6);
  const { dateFormat } = useProfile();
  const mobile = useIsMobile();
  const [data, setData] = useState(() => readContractSamples(bu));
  const [display, setDisplay] = useState<"list" | "grid">("list");
  const [saveView, setSaveView] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editor, setEditor] = useState<{
    mode: "add" | "view" | "edit";
    record?: ArContract;
  } | null>(null);
  const [document, setDocument] = useState<ArContract["document"]>();
  const [deleting, setDeleting] = useState<ArContract | null>(null);
  const { search, setSearch, tableConfig } = useDataGridState({
    defaultSort: "contractNo:desc",
  });
  const lf = useListFilters({ pageKey: LIST_PAGE_KEYS.AR_CONTRACT, fields });
  const [from, to] = (lf.values.date?.split(":").at(-1) ?? "").split(",");
  const query = search.trim().toLowerCase();
  const rows = useMemo(
    () =>
      data.records.filter(
        (record) =>
          (!lf.values.status ||
            record.active === (lf.values.status === "active")) &&
          (!from || record.startDate >= from) &&
          (!to || record.startDate <= to) &&
          [
            record.contractNo,
            record.description,
            record.customerCode,
            record.customerName,
          ]
            .join(" ")
            .toLowerCase()
            .includes(query),
      ),
    [data.records, lf.values.status, from, to, query],
  );
  const open = (record: ArContract) => setEditor({ mode: "view", record });
  const actions = (record: ArContract) => (
    <DataGridRowActions
      onEdit={() => setEditor({ mode: "edit", record })}
      onDelete={() => setDeleting(record)}
      writeDisabled={!canWrite}
    >
      <DropdownMenuItem onClick={() => open(record)}>
        <Eye />
        {tc("view")}
      </DropdownMenuItem>
    </DataGridRowActions>
  );
  const docButton = (record: ArContract) => (
    <Button
      variant="ghost"
      size="icon-xs"
      disabled={!record.document}
      title={record.document?.name ?? t("noDocument")}
      aria-label={`${t("viewDocument")} ${record.contractNo}`}
      onClick={() => setDocument(record.document)}
    >
      <FileText
        className={
          record.document ? "text-destructive" : "text-muted-foreground"
        }
      />
    </Button>
  );
  const column = (
    id: keyof ArContract,
    label: string,
    size = 100,
  ): ColumnDef<ArContract> => ({
    accessorKey: id,
    size,
    meta: { headerTitle: label },
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={label} />
    ),
  });
  const columns: ColumnDef<ArContract>[] = [
    {
      id: "document",
      header: "DOC",
      size: 45,
      enableSorting: false,
      meta: { headerTitle: "DOC" },
      cell: ({ row }) => docButton(row.original),
    },
    {
      ...column("active", tc("status"), 90),
      cell: ({ row }) => (
        <StatusDotBadge tone={row.original.active ? "success" : "neutral"}>
          {ts(row.original.active ? "active" : "inactive")}
        </StatusDotBadge>
      ),
    },
    {
      ...column("contractNo", t("number"), 110),
      cell: ({ row }) => (
        <CellAction onClick={() => open(row.original)}>
          {row.original.contractNo}
        </CellAction>
      ),
    },
    {
      ...column("description", t("descriptionColumn"), 180),
      meta: { headerTitle: t("descriptionColumn") },
      cell: ({ row }) => (
        <div className="space-y-1 whitespace-normal">
          <div>{row.original.description}</div>
          <div className="text-muted-foreground text-xs">
            {row.original.customerCode} · {row.original.customerName}
          </div>
        </div>
      ),
    },
    column("currency", t("currency"), 75),
    {
      ...column("rate", t("rate")),
      meta: {
        headerTitle: t("rate"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      },
      cell: ({ row }) => rate(row.original.rate),
    },
    ...(["startDate", "endDate"] as const).map(
      (key): ColumnDef<ArContract> => ({
        ...column(key, t(key)),
        cell: ({ row }) => formatDate(row.original[key], dateFormat),
      }),
    ),
    {
      ...column("chargeEvery", t("chargeEvery"), 90),
      cell: ({ row }) => t("months", { count: row.original.chargeEvery }),
    },
    {
      id: "amountThb",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("amountThb")} />
      ),
      accessorFn: (row) => round2(row.amount * row.rate),
      meta: {
        headerTitle: t("amountThb"),
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
      },
      cell: ({ getValue }) => money(getValue<number>()),
    },
    {
      id: "actions",
      header: "",
      enableSorting: false,
      enableHiding: false,
      size: 45,
      cell: ({ row }) => actions(row.original),
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
        sheetName: "Contract",
        fileName: buildXlsxFileName("AR_Contract_MOCK"),
        columns: [
          { header: t("number"), value: (row) => row.contractNo },
          {
            header: t("customer"),
            value: (row) => `${row.customerCode} · ${row.customerName}`,
          },
          { header: t("descriptionColumn"), value: (row) => row.description },
          { header: t("currency"), value: (row) => row.currency },
          { header: t("rate"), value: (row) => row.rate },
          { header: t("startDate"), value: (row) => row.startDate },
          { header: t("endDate"), value: (row) => row.endDate },
          { header: t("chargeEvery"), value: (row) => row.chargeEvery },
          {
            header: t("amountThb"),
            value: (row) => round2(row.amount * row.rate),
          },
          {
            header: tc("status"),
            value: (row) => ts(row.active ? "active" : "inactive"),
          },
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
        <DocumentListActions
          onAdd={() => {
            if (canWrite) setEditor({ mode: "add" });
          }}
          addLabel={t("add")}
          addDisabled={!canWrite}
          onExport={() => void exportRows()}
          isExporting={exporting}
        />
      }
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
          trailing={
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={tc("refresh")}
              onClick={() => {
                try {
                  setData(readContractSamples(bu));
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
                {table.getRowModel().rows.map(({ original: record }) => (
                  <ListCard
                    key={record.id}
                    title={record.contractNo}
                    onOpen={() => open(record)}
                    actions={
                      <>
                        {docButton(record)}
                        {actions(record)}
                      </>
                    }
                  >
                    <ListCardActiveRow active={record.active} />
                    <ListCardRow label={t("customer")}>
                      {record.customerCode} · {record.customerName}
                    </ListCardRow>
                    <ListCardRow label={t("descriptionColumn")}>
                      {record.description}
                    </ListCardRow>
                    <ListCardRow label={t("currency")}>
                      {record.currency} · {rate(record.rate)}
                    </ListCardRow>
                    <ListCardRow label={t("startDate")}>
                      {formatDate(record.startDate, dateFormat)}
                    </ListCardRow>
                    <ListCardRow label={t("endDate")}>
                      {formatDate(record.endDate, dateFormat)}
                    </ListCardRow>
                    <ListCardRow label={t("chargeEvery")}>
                      {t("months", { count: record.chargeEvery })}
                    </ListCardRow>
                    <ListCardRow label={t("amountThb")}>
                      {money(round2(record.amount * record.rate))}
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
      {editor && (
        <ContractDialog
          key={`${editor.mode}-${editor.record?.id ?? "new"}`}
          {...editor}
          canWrite={canWrite}
          data={data}
          close={() => setEditor(null)}
          edit={() => setEditor({ ...editor, mode: "edit" })}
          save={(record) => {
            if (!canWrite) return;
            try {
              setData(saveContractSample(bu, record));
              setEditor(null);
            } catch {
              toast.error(t("storageError"));
            }
          }}
        />
      )}
      {document && (
        <ContractDocumentDialog
          document={document}
          close={() => setDocument(undefined)}
        />
      )}
      <DeleteDialog
        open={!!deleting}
        title={deleting?.contractNo ?? ""}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        onConfirm={() => {
          if (!deleting || !canWrite) return;
          try {
            setData(deleteContractSample(bu, deleting.id));
            setDeleting(null);
          } catch {
            toast.error(t("storageError"));
          }
        }}
      />
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
