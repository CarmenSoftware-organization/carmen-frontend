import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "use-intl";
import { Crown, FileText, Package, Receipt } from "lucide-react";
import { toast } from "sonner";
import {
  type ColumnDef,
  useReactTable,
  getCoreRowModel,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import EmptyComponent from "@/components/empty-component";
import { useProfile } from "@/hooks/use-profile";
import { httpClient } from "@/lib/http-client";
import { buildUrl } from "@/lib/build-query-string";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { formatCurrency } from "@/lib/currency-utils";
import { formatDate } from "@/lib/date-utils";
import { LastPriceChip } from "@/components/share/last-price-chip";
import type { LastPrice } from "@/types/last-price";
import { resolveApprovedQty } from "./pr-form-schema";

export interface PricelistEntry {
  vendor_id: string;
  vendor_name: string;
  pricelist_detail_id: string;
  pricelist_no: string;
  price: number;
  currency: string;
  unit_name: string;
  base_price: number;
  base_currency: string;
  exchange_rate: number;
  effective_date: { from: string; to: string };
  is_preferred?: boolean;
}

const buildColumns = (
  dateFormat: string,
  tfl: ReturnType<typeof useTranslations>,
  t: ReturnType<typeof useTranslations>,
  tc: ReturnType<typeof useTranslations>,
  readOnly: boolean,
  minPrice: number,
  onAssign: (entry: PricelistEntry) => void,
): ColumnDef<PricelistEntry>[] => {
  const base: ColumnDef<PricelistEntry>[] = [
    {
      id: "index",
      header: "#",
      size: 44,
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-center text-muted-foreground tabular-nums",
      },
      cell: ({ row }) => row.index + 1,
    },
    {
      accessorKey: "vendor_name",
      header: tfl("vendor"),
      size: 200,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="truncate font-semibold">
            {row.original.vendor_name}
          </span>
          {row.original.is_preferred && (
            <Badge
              size="xs"
              variant={"ghost"}
              className="text-micro-legal gap-1"
            >
              <Crown className="text-warning-ink size-3" />
              {/*{t("preferred")}*/}
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: "pricelist_no",
      header: t("pricelistNo"),
      meta: { cellClassName: "text-muted-foreground" },
      size: 140,
    },
    {
      accessorKey: "unit_name",
      header: tfl("unit"),
      meta: {
        headerClassName: "text-center",
        cellClassName: "text-muted-foreground text-center",
      },
      size: 80,
    },
    {
      accessorKey: "price",
      header: tfl("price"),
      meta: {
        headerClassName: "text-right",
        cellClassName: "text-right",
      },
      size: 160,
      cell: ({ row }) => {
        const price = row.original.price;
        const isBest = price === minPrice && minPrice > 0;
        return (
          <div className="flex items-center justify-end gap-1.5">
            {isBest && (
              <Badge
                variant="success-light"
                size="xs"
                className="text-micro-legal"
              >
                {t("best")}
              </Badge>
            )}
            <span className="font-semibold tabular-nums">
              {formatCurrency(price)}
            </span>
            <span className="text-muted-foreground">
              {row.original.currency}
            </span>
          </div>
        );
      },
    },
    {
      id: "effective",
      header: t("effective"),
      meta: { cellClassName: "text-muted-foreground whitespace-nowrap" },
      cell: ({ row }) => {
        const { from, to } = row.original.effective_date ?? {};
        const f = formatDate(from, dateFormat);
        const toDate = formatDate(to, dateFormat);
        return f && toDate ? (
          <span className="text-micro tabular-nums">
            {f} → {toDate}
          </span>
        ) : (
          ""
        );
      },
    },
  ];
  if (readOnly) return base;
  return [
    ...base,
    {
      id: "assign",
      header: "",
      size: 90,
      meta: { cellClassName: "text-right" },
      cell: ({ row }) => (
        <Button
          type="button"
          size="xs"
          variant="success"
          onClick={() => onAssign(row.original)}
        >
          {tc("assign")}
        </Button>
      ),
    },
  ];
};

interface PrPricelistDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
  readonly productName: string;
  readonly unitId: string;
  readonly currencyId: string;
  readonly atDate: string;
  readonly requestedQty: number;
  readonly requestedUnitName: string;
  readonly approvedQty: number;
  readonly approvedUnitName: string;
  readonly onSelect: (entry: PricelistEntry) => void;
  readonly readOnly?: boolean;
}

export function PrPricelistDialog({
  open,
  onOpenChange,
  productId,
  productName,
  unitId,
  currencyId,
  atDate,
  requestedQty,
  requestedUnitName,
  approvedQty,
  approvedUnitName,
  onSelect,
  readOnly = false,
}: PrPricelistDialogProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const { buCode, dateFormat } = useProfile();
  const [isLoading, setIsLoading] = useState(false);
  const [lists, setLists] = useState<PricelistEntry[]>([]);
  // pricelist ที่ถูกเลือกอยู่ (data.selected) — แยกจาก lists จึงต้องรวมมาแสดงเอง
  const [selected, setSelected] = useState<PricelistEntry | null>(null);
  const [lastPrice, setLastPrice] = useState<LastPrice | null>(null);

  useEffect(() => {
    if (!open || !productId || !unitId || !currencyId || !buCode) return;

    const fetchPriceLists = async () => {
      setIsLoading(true);
      setLists([]);
      setSelected(null);
      setLastPrice(null);
      try {
        const url = buildUrl(API_ENDPOINTS.PRICE_LIST_COMPARE(buCode), {
          product_id: productId,
          unit_id: unitId,
          at_date: atDate,
          currency_id: currencyId,
          // ราคาขึ้นกับจำนวนที่สั่ง (ขั้นบันได MOQ) — ใช้จำนวนเดียวกับที่คิดยอด
          // (approved ก่อน ไม่มีค่อย requested) ไม่งั้นจะเลือก tier ที่จำนวน approve
          // ไปไม่ถึง; 0 ถูก buildQueryString ตัดทิ้ง backend จะถือว่าไม่ระบุจำนวน
          qty:
            resolveApprovedQty({
              approved_qty: approvedQty,
              requested_qty: requestedQty,
            }) || "",
        });
        // no-store — ราคาเปลี่ยนได้ระหว่างวัน ห้ามกินของที่ browser cache ไว้
        const res = await httpClient.get(url, { cache: "no-store" });
        if (!res.ok) return;
        const json = await res.json();
        setLists(json.data?.lists ?? []);
        setSelected(json.data?.selected ?? null);
        setLastPrice(json.data?.last_price ?? null);
      } catch {
        toast.error(t("priceListLoadFailed"));
      } finally {
        setIsLoading(false);
      }
    };

    fetchPriceLists();
  }, [
    open,
    productId,
    unitId,
    currencyId,
    atDate,
    requestedQty,
    approvedQty,
    buCode,
    t,
  ]);

  const handleSelect = (entry: PricelistEntry) => {
    if (readOnly) return;
    onSelect(entry);
    onOpenChange(false);
  };

  // selected ไม่อยู่ใน lists → prepend (กัน duplicate ด้วย pricelist_detail_id)
  const rows = useMemo(() => {
    if (!selected) return lists;
    return lists.some(
      (l) => l.pricelist_detail_id === selected.pricelist_detail_id,
    )
      ? lists
      : [selected, ...lists];
  }, [lists, selected]);

  const minPrice =
    rows.length > 0
      ? Math.min(...rows.map((l) => l.price).filter((p) => p > 0))
      : 0;

  const pricelistColumns = buildColumns(
    dateFormat,
    tfl,
    t,
    tc,
    readOnly,
    minPrice,
    handleSelect,
  );

  const table = useReactTable({
    data: rows,
    columns: pricelistColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.pricelist_detail_id,
  });

  const emptyMessage = (
    <EmptyComponent
      icon={FileText}
      title={t("noPriceList")}
      description={t("noPriceListDesc")}
    />
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-5xl">
        <div className="space-y-4 px-6 pt-6 pb-4">
          <DialogHeader>
            <DialogTitle className="text-base">
              {t("priceListComparison")}
            </DialogTitle>
            <DialogDescription className="truncate">
              {productName}
            </DialogDescription>
            <div className="text-muted-foreground text-micro mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1">
                <Package className="size-3" />
                {tfl("requested")}:{" "}
                <span className="text-foreground font-semibold tabular-nums">
                  {requestedQty} {requestedUnitName}
                </span>
              </span>
              {approvedQty > 0 && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <span className="inline-flex items-center gap-1">
                    <Receipt className="size-3" />
                    {tfl("approved")}:{" "}
                    <span className="text-foreground font-semibold tabular-nums">
                      {approvedQty} {approvedUnitName}
                    </span>
                  </span>
                </>
              )}
              {lastPrice && (
                <>
                  <span className="bg-border h-3 w-px" />
                  <LastPriceChip lastPrice={lastPrice} />
                </>
              )}
            </div>
          </DialogHeader>
        </div>

        <div className="flex min-h-0 flex-1 flex-col px-6 pb-6">
          <DataGrid
            table={table}
            recordCount={rows.length}
            isLoading={isLoading}
            loadingMode="spinner"
            emptyMessage={emptyMessage}
            tableLayout={{
              headerBackground: true,
              headerSticky: true,
              rowBorder: true,
            }}
            tableClassNames={{
              base: "text-xs",
              headerRow: "h-10",
              // เลือกด้วยปุ่ม Assign เท่านั้น — แถวไม่ใช่เป้าคลิก จึงไม่มี pointer
              bodyRow: "h-11 hover:bg-primary/5",
            }}
          >
            <DataGridContainer className="rounded-lg border">
              <DataGridTable />
            </DataGridContainer>
          </DataGrid>
        </div>
      </DialogContent>
    </Dialog>
  );
}
