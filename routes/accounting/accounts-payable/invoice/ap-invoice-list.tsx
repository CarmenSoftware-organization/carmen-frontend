import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Columns3, CreditCard, Plus, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import SearchInput from "@/components/search-input";
import EmptyComponent from "@/components/empty-component";
import { ListPageShell } from "@/components/share/list-page-shell";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridColumnVisibility } from "@/components/ui/data-grid/data-grid-column-visibility";
import { DataGridSortMenu } from "@/components/ui/data-grid/data-grid-sort-menu";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusFilter } from "@/components/ui/status-filter";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ApInvoice } from "@/types/accounts-payable";
import { ApStatusBadge, Money } from "../shared/ap-ui";
import { useApInvoices } from "../shared/use-accounts-payable";

const lifecycleOptions = [
  "draft",
  "submitted",
  "posted",
  "post_failed",
  "voided",
];
const settlementOptions = ["unpaid", "partially_paid", "paid"];
const matchOptions = ["matched", "variance", "not_required", "pending"];

export default function ApInvoiceList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const [displayMode, setDisplayMode] = useState<"list" | "grid">("list");
  const [selected, setSelected] = useState<string[]>([]);
  const filters = {
    search: params.get("search") ?? "",
    lifecycle: params.get("lifecycle") ?? "",
    settlement: params.get("settlement") ?? "",
    match: params.get("match") ?? "",
    due_bucket: params.get("due_bucket") ?? "",
    as_of: params.get("as_of") ?? undefined,
    hold: params.get("hold") === "true",
    reserved: params.get("reserved") === "true",
    tax: params.get("tax") ?? "",
  };
  const query = useApInvoices(filters);
  const rows = useMemo(() => query.data?.data ?? [], [query.data?.data]);
  const setFilter = (key: string, value: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  const eligible = selected
    .map((id) => rows.find((item) => item.id === id))
    .filter(
      (item): item is ApInvoice =>
        !!item &&
        item.lifecycle === "posted" &&
        item.settlement_status !== "paid" &&
        item.reserved_amount === "0.00",
    );
  const toggle = (id: string, checked: boolean) =>
    setSelected((current) =>
      checked
        ? [...new Set([...current, id])]
        : current.filter((item) => item !== id),
    );

  const columns = useMemo<ColumnDef<ApInvoice>[]>(
    () => [
      {
        id: "select",
        header: () => (
          <Checkbox
            aria-label="Select all eligible invoices"
            checked={
              rows.length > 0 &&
              rows.every((item) => selected.includes(item.id))
            }
            onCheckedChange={(checked) =>
              setSelected(checked ? rows.map((item) => item.id) : [])
            }
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select ${row.original.ap_no}`}
            checked={selected.includes(row.original.id)}
            onCheckedChange={(checked) =>
              toggle(row.original.id, checked === true)
            }
          />
        ),
        enableHiding: false,
      },
      {
        accessorKey: "ap_no",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="AP No." />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() =>
              navigate(
                `/accounting/accounts-payable/invoice/${row.original.id}`,
              )
            }
          >
            {row.original.ap_no}
          </CellAction>
        ),
        enableHiding: false,
        meta: { headerTitle: "AP No." },
      },
      {
        accessorKey: "input_date",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Input Date" />
        ),
        meta: { headerTitle: "Input Date", cellClassName: "tabular-nums" },
      },
      {
        accessorKey: "vendor_invoice_no",
        header: "Vendor Invoice",
        meta: { headerTitle: "Vendor Invoice" },
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
        cell: ({ row }) => (
          <span
            className="block max-w-56 truncate"
            title={row.original.vendor_name}
          >
            {row.original.vendor_name}
          </span>
        ),
        meta: { headerTitle: "Vendor" },
      },
      {
        accessorKey: "due_date",
        header: "Due Date",
        cell: ({ row }) => row.original.due_date ?? "—",
        meta: { headerTitle: "Due Date", cellClassName: "tabular-nums" },
      },
      {
        accessorKey: "total_amount",
        header: "Original",
        cell: ({ row }) => (
          <Money
            value={row.original.total_amount}
            currency={row.original.currency_code}
          />
        ),
        meta: {
          headerTitle: "Original",
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "open_amount",
        header: "Open",
        cell: ({ row }) => (
          <Money
            value={row.original.open_amount}
            currency={row.original.currency_code}
            className="font-medium"
          />
        ),
        meta: {
          headerTitle: "Open",
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "lifecycle",
        header: "Lifecycle",
        cell: ({ row }) => <ApStatusBadge value={row.original.lifecycle} />,
        meta: { headerTitle: "Lifecycle" },
      },
      {
        accessorKey: "settlement_status",
        header: "Settlement",
        cell: ({ row }) => (
          <ApStatusBadge value={row.original.settlement_status} />
        ),
        meta: { headerTitle: "Settlement" },
      },
      {
        accessorKey: "match_status",
        header: "Match",
        cell: ({ row }) => <ApStatusBadge value={row.original.match_status} />,
        meta: { headerTitle: "Match" },
      },
    ],
    [navigate, rows, selected],
  );
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        message="Unable to load AP invoices"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <ListPageShell
      title="AP Invoice Directory"
      mock
      description="Supplier invoices, matching and open liabilities"
      actions={
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={eligible.length === 0}
            onClick={() =>
              navigate(
                `/accounting/accounts-payable/payment/new?invoice_ids=${eligible.map((item) => item.id).join(",")}`,
              )
            }
          >
            <CreditCard className="size-4" /> Pay Selected
            {eligible.length ? ` (${eligible.length})` : ""}
          </Button>
          <Button
            size="sm"
            onClick={() => navigate("/accounting/accounts-payable/invoice/new")}
          >
            <Plus className="size-4" /> New Invoice
          </Button>
        </div>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex w-full flex-1 flex-wrap items-center gap-2 sm:w-auto">
            <div className="min-w-52 flex-1 sm:flex-initial">
              <SearchInput
                defaultValue={filters.search}
                onSearch={(value) => setFilter("search", value)}
                onInputChange={(value) => setFilter("search", value)}
              />
            </div>
            <StatusFilter
              value={filters.lifecycle}
              onChange={(value) => setFilter("lifecycle", value)}
              placeholder="Lifecycle"
              defaultLabel="All lifecycle"
              options={lifecycleOptions.map((value) => ({
                value,
                label: value.replaceAll("_", " "),
              }))}
              className="w-36"
            />
            <StatusFilter
              value={filters.settlement}
              onChange={(value) => setFilter("settlement", value)}
              placeholder="Settlement"
              defaultLabel="All settlement"
              options={settlementOptions.map((value) => ({
                value,
                label: value.replaceAll("_", " "),
              }))}
              className="w-36"
            />
            <StatusFilter
              value={filters.match}
              onChange={(value) => setFilter("match", value)}
              placeholder="Match"
              defaultLabel="All match"
              options={matchOptions.map((value) => ({
                value,
                label: value.replaceAll("_", " "),
              }))}
              className="w-36"
            />
            {filters.due_bucket && (
              <Badge variant="secondary">
                Due: {filters.due_bucket.replaceAll("_", " ")}
              </Badge>
            )}
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <DataGridSortMenu table={table} />
            {displayMode === "list" && (
              <DataGridColumnVisibility
                table={table}
                trigger={
                  <Button
                    size="icon-sm"
                    variant="outline"
                    aria-label="Toggle columns"
                  >
                    <Columns3 className="size-4" />
                  </Button>
                }
              />
            )}
            <DisplayModeToggle value={displayMode} onChange={setDisplayMode} />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => query.refetch()}
              aria-label="Refresh"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="mt-3">
        {query.isLoading ? (
          <Skeleton className="h-80 rounded-lg" />
        ) : !(isMobile || displayMode === "grid") ? (
          <DataGrid
            table={table}
            recordCount={rows.length}
            tableLayout={{ headerSticky: true, width: "auto" }}
            tableClassNames={{ bodyRow: "h-10" }}
            emptyMessage={<EmptyComponent />}
          >
            <DataGridContainer className={listGridMaxH(false)}>
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        ) : rows.length === 0 ? (
          <EmptyComponent />
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((invoice) => (
              <ListCard
                key={invoice.id}
                title={invoice.ap_no}
                badge={<ApStatusBadge value={invoice.lifecycle} />}
                onOpen={() =>
                  navigate(`/accounting/accounts-payable/invoice/${invoice.id}`)
                }
              >
                <ListCardRow label="Vendor">{invoice.vendor_name}</ListCardRow>
                <ListCardRow label="Due">{invoice.due_date ?? "—"}</ListCardRow>
                <ListCardRow label="Open">
                  <Money
                    value={invoice.open_amount}
                    currency={invoice.currency_code}
                  />
                </ListCardRow>
                <ListCardRow label="Settlement">
                  <ApStatusBadge value={invoice.settlement_status} />
                </ListCardRow>
              </ListCard>
            ))}
          </div>
        )}
      </div>
    </ListPageShell>
  );
}
