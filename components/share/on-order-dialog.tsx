import { useMemo } from "react";
import { distinctLocalName } from "@/lib/distinct-local-name";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Building2, FileText } from "lucide-react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import EmptyComponent from "@/components/empty-component";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { LastPriceChip } from "@/components/share/last-price-chip";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import {
  useProductOnOrder,
  type OnOrderRow,
} from "@/hooks/use-product-on-order";
import { useProfile } from "@/hooks/use-profile";
import { formatCurrency } from "@/lib/currency-utils";
import { formatDate } from "@/lib/date-utils";
import { PO_STATUS_CONFIG } from "@/constant/purchase-order";

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
}

export function OnOrderDialog({ open, onOpenChange, productId }: Props) {
  const t = useTranslations("procurement.purchaseRequest");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const { dateFormat } = useProfile();

  const { data, isLoading } = useProductOnOrder(open ? productId : undefined);

  const rows: OnOrderRow[] = data?.orders ?? [];
  const totalQty = Number(data?.total_on_order ?? 0);
  const summaryUnit = data?.inventory_unit_name ?? "";

  const columns = useMemo<ColumnDef<OnOrderRow>[]>(
    () => [
      {
        id: "index",
        header: () => "#",
        cell: ({ row }) => row.index + 1,
        size: 56,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "po_no",
        header: () => tfl("poNo"),
        cell: ({ row }) => {
          const label = row.original.po_no ?? "—";
          if (!row.original.po_id) return <span>{label}</span>;
          return (
            <Link
              to={`/procurement/purchase-order/${row.original.po_id}`}
              onClick={() => onOpenChange(false)}
              className="hover:underline focus-visible:underline"
            >
              {label}
            </Link>
          );
        },
        size: 160,
      },
      {
        accessorKey: "vendor_name",
        header: () => tfl("vendor"),
        cell: ({ row }) => (
          <div className="flex items-center gap-1.5">
            <Building2
              className="text-muted-foreground size-3 shrink-0"
              aria-hidden="true"
            />
            <span className="truncate">{row.original.vendor_name ?? "—"}</span>
          </div>
        ),
        size: 200,
      },
      {
        accessorKey: "location_name",
        header: () => tfl("location"),
        // รหัสคลังเป็นบรรทัดรอง ทรงเดียวกับที่ใช้ทั่วแอป — ชื่อคลังคือสิ่งที่คนอ่าน
        // รหัสคือสิ่งที่คนเอาไปเทียบกับระบบอื่น
        cell: ({ row }) => (
          <NameWithSubtext
            primary={row.original.location_name ?? "—"}
            secondary={row.original.location_code ?? undefined}
          />
        ),
        size: 180,
      },
      {
        accessorKey: "order_date",
        header: () => tfl("orderDate"),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {row.original.order_date
              ? formatDate(row.original.order_date, dateFormat)
              : "—"}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: "delivery_date",
        header: () => tfl("expectedDate"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {row.original.delivery_date
              ? formatDate(row.original.delivery_date, dateFormat)
              : "—"}
          </span>
        ),
        size: 120,
      },
      {
        accessorKey: "pending_qty",
        header: () => tfl("quantity"),
        cell: ({ row }) => (
          <span className="font-semibold tabular-nums">
            {row.original.pending_qty}
          </span>
        ),
        size: 100,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        id: "unit",
        header: () => tfl("unit"),
        cell: () => (
          <span className="text-muted-foreground">{summaryUnit}</span>
        ),
        size: 80,
      },
      {
        accessorKey: "total_amount",
        header: () => tfl("amount"),
        cell: ({ row }) => (
          <span className="tabular-nums">
            {formatCurrency(Number(row.original.total_amount ?? 0))}
          </span>
        ),
        size: 120,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
      {
        accessorKey: "po_status",
        header: () => tfl("status"),
        cell: ({ row }) => {
          const status = row.original.po_status;
          if (!status) return null;
          const cfg = PO_STATUS_CONFIG[status];
          return (
            <Badge className={cfg?.className} size="xs">
              {cfg?.label ?? status.toUpperCase().replace(/_/g, " ")}
            </Badge>
          );
        },
        size: 120,
      },
    ],
    [tfl, dateFormat, summaryUnit, onOpenChange],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row, i) => row.po_id ?? `row-${i}`,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-5xl">
        <div className="relative space-y-4 px-6 pt-10 pb-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base">{t("onOrder")}</DialogTitle>
                <DialogDescription asChild>
                  <div className="mt-1 space-y-0.5">
                    <span className="text-foreground text-sm font-semibold">
                      {data?.product_name ?? "—"}
                    </span>
                    {distinctLocalName(
                      data?.product_name,
                      data?.product_local_name,
                    ) && (
                      <p className="text-muted-foreground text-xs">
                        {data?.product_local_name}
                      </p>
                    )}
                    <LastPriceChip
                      lastPrice={data?.last_price}
                      className="pt-0.5"
                    />
                  </div>
                </DialogDescription>
              </div>
              {!isLoading && rows.length > 0 && (
                <div className="text-right">
                  <p className="text-muted-foreground text-micro-legal font-semibold tracking-wider uppercase">
                    {tfl("total")}
                  </p>
                  <p className="text-warning-ink text-lg leading-tight font-semibold tabular-nums">
                    {totalQty.toLocaleString()}
                  </p>
                  <p className="text-muted-foreground text-micro-legal">
                    {summaryUnit}
                  </p>
                </div>
              )}
            </div>
          </DialogHeader>

          <DataGrid
            table={table}
            recordCount={rows.length}
            isLoading={isLoading}
            tableLayout={{ headerSticky: true, rowBorder: true }}
            emptyMessage={
              <EmptyComponent icon={FileText} title={tc("noData")} />
            }
          >
            <DataGridContainer className="flex max-h-[60vh] flex-col rounded-lg border">
              <DataGridScrollArea>
                <DataGridTable />
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        </div>
      </DialogContent>
    </Dialog>
  );
}
