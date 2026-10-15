import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Columns3, RefreshCw } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router";
import EmptyComponent from "@/components/empty-component";
import SearchInput from "@/components/search-input";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { DisplayModeToggle } from "@/components/share/display-mode-toggle";
import { ListCard, ListCardRow } from "@/components/share/list-card";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
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
import { multiplyDecimal } from "../shared/ap-decimal";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ApPayment } from "@/types/accounts-payable";
import { ApStatusBadge, Money } from "../shared/ap-ui";
import { useApPayments } from "../shared/use-accounts-payable";

export default function ApPaymentList() {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<"list" | "grid">("list");
  const filters = {
    search: params.get("search") ?? "",
    lifecycle: params.get("lifecycle") ?? "",
    execution: params.get("execution") ?? "",
    method: params.get("method") ?? "",
    urgent: params.get("urgent") === "true",
  };
  const query = useApPayments(filters);
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
  const columns = useMemo<ColumnDef<ApPayment>[]>(
    () => [
      {
        accessorKey: "pv_no",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="PV No." />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() =>
              navigate(
                `/accounting/accounts-payable/payment/${row.original.id}`,
              )
            }
          >
            {row.original.pv_no}
          </CellAction>
        ),
        enableHiding: false,
        meta: { headerTitle: "PV No." },
      },
      {
        accessorKey: "payment_date",
        header: "Payment Date",
        meta: { headerTitle: "Payment Date", cellClassName: "tabular-nums" },
      },
      {
        accessorKey: "vendor_name",
        header: "Vendor",
        meta: { headerTitle: "Vendor" },
      },
      {
        id: "paid_date",
        header: "Paid Date",
        cell: ({ row }) => row.original.paid_date ?? "—",
      },
      { accessorKey: "description", header: "Description" },
      {
        accessorKey: "payment_method",
        header: "Method / Reference",
        cell: ({ row }) => (
          <div>
            <p>{row.original.payment_method.replaceAll("_", " ")}</p>
            <p className="text-muted-foreground text-xs">
              {row.original.payment_reference || "—"}
            </p>
          </div>
        ),
        meta: { headerTitle: "Method / Reference" },
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        meta: { headerTitle: "Currency" },
      },
      {
        accessorKey: "applied_amount",
        header: "Applied",
        cell: ({ row }) => (
          <Money
            value={row.original.applied_amount}
            currency={row.original.currency_code}
          />
        ),
        meta: {
          headerTitle: "Applied",
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "wht_amount",
        header: "WHT",
        cell: ({ row }) => (
          <Money
            value={row.original.wht_amount}
            currency={row.original.currency_code}
          />
        ),
        meta: {
          headerTitle: "WHT",
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "net_pay",
        header: "Net Pay",
        cell: ({ row }) => (
          <Money
            value={row.original.net_pay}
            currency={row.original.currency_code}
          />
        ),
        meta: {
          headerTitle: "Net Pay",
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "lifecycle",
        header: "Workflow",
        cell: ({ row }) => <ApStatusBadge value={row.original.lifecycle} />,
        meta: { headerTitle: "Workflow" },
      },
      {
        id: "base",
        header: "Base Amt. (THB)",
        cell: ({ row }) => (
          <Money
            value={
              row.original.net_pay_base ??
              multiplyDecimal(row.original.net_pay, row.original.exchange_rate)
            }
            className="text-primary font-semibold"
          />
        ),
        meta: { cellClassName: "text-right" },
      },
      {
        accessorKey: "execution_status",
        header: "Execution",
        cell: ({ row }) => (
          <ApStatusBadge value={row.original.execution_status} />
        ),
        meta: { headerTitle: "Execution" },
      },
    ],
    [navigate],
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
        message="Unable to load AP payments"
        onRetry={() => void query.refetch()}
      />
    );
  return (
    <ListPageShell
      title="Payment Voucher Directory"
      mock
      description="Supplier payment workflow and execution"
      actions={
        <DocumentListActions
          onAdd={() => navigate("/accounting/accounts-payable/payment/new")}
          addLabel="New Payment"
          hideExportPrint
        />
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 flex-wrap gap-3">
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
              placeholder="Workflow"
              defaultLabel="All workflow"
              options={["draft", "submitted", "posted", "voided"].map(
                (value) => ({ value, label: value.replaceAll("_", " ") }),
              )}
              className="w-40"
            />
            <StatusFilter
              value={filters.execution}
              onChange={(value) => setFilter("execution", value)}
              placeholder="Execution"
              defaultLabel="All execution"
              options={["not_released", "executed", "failed"].map((value) => ({
                value,
                label: value.replaceAll("_", " "),
              }))}
              className="w-40"
            />
            <StatusFilter
              value={filters.method}
              onChange={(value) => setFilter("method", value)}
              placeholder="Method"
              defaultLabel="All methods"
              options={["bank_transfer", "direct_debit", "cheque"].map(
                (value) => ({ value, label: value.replaceAll("_", " ") }),
              )}
              className="w-40"
            />
          </div>
          <div className="hidden items-center gap-2 sm:flex">
            <DataGridSortMenu table={table} />
            {mode === "list" && (
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
            <DisplayModeToggle value={mode} onChange={setMode} />
            <Button
              size="icon-sm"
              variant="ghost"
              onClick={() => void query.refetch()}
              aria-label="Refresh"
            >
              <RefreshCw className="size-4" />
            </Button>
          </div>
        </div>
      }
    >
      {query.isLoading ? (
        <Skeleton className="h-80 rounded-lg" />
      ) : !(isMobile || mode === "grid") ? (
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((payment) => (
            <ListCard
              key={payment.id}
              title={payment.pv_no}
              badge={<ApStatusBadge value={payment.lifecycle} />}
              onOpen={() =>
                navigate(`/accounting/accounts-payable/payment/${payment.id}`)
              }
            >
              <ListCardRow label="Vendor">{payment.vendor_name}</ListCardRow>
              <ListCardRow label="Method">
                {payment.payment_method.replaceAll("_", " ")}
              </ListCardRow>
              <ListCardRow label="Net pay">
                <Money
                  value={payment.net_pay}
                  currency={payment.currency_code}
                />
              </ListCardRow>
              <ListCardRow label="Execution">
                <ApStatusBadge value={payment.execution_status} />
              </ListCardRow>
            </ListCard>
          ))}
        </div>
      )}
    </ListPageShell>
  );
}
