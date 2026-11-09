import { useMemo } from "react";
import { distinctLocalName } from "@/lib/distinct-local-name";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { FileText, Handshake, Truck, Warehouse } from "lucide-react";
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
import EmptyComponent from "@/components/empty-component";
import { NameWithSubtext } from "./name-with-sub-text";
import { LastPriceChip } from "./last-price-chip";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import {
  useProductOnHand,
  type OnHandLocationRow,
} from "@/hooks/use-product-on-hand";
import { INVENTORY_TYPE, inventoryTypeLabelKey } from "@/constant/location";

const LOCATION_TYPE_ICON = {
  [INVENTORY_TYPE.INVENTORY]: Warehouse,
  [INVENTORY_TYPE.DIRECT]: Truck,
  [INVENTORY_TYPE.CONSIGNMENT]: Handshake,
} as const;

interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly productId: string;
  /**
   * วันที่ของเอกสาร — ยอดแต่ละคลังเป็นยอด ณ สิ้นวันนั้น ใช้วันเดียวกับกล่อง on hand
   * ของหน้านั้น ตัวเลขรวมจึงตรงกัน ไม่ส่ง = งวดปัจจุบันแบบเดิม
   */
  readonly atDate?: string;
}

export function OnHandDialog({ open, onOpenChange, productId, atDate }: Props) {
  const t = useTranslations("procurement.purchaseRequest");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const tloc = useTranslations("config.location");

  const { data, isLoading } = useProductOnHand(
    open ? productId : undefined,
    undefined,
    atDate || undefined,
  );

  const rows: OnHandLocationRow[] = data?.locations ?? [];
  const totalQty = Number(data?.total_on_hand ?? 0);
  const summaryUnit = data?.inventory_unit_name ?? "";

  const columns = useMemo<ColumnDef<OnHandLocationRow>[]>(
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
        accessorKey: "location_name",
        header: () => tfl("location"),
        // รหัสคลังเป็นบรรทัดรองของชื่อ ไม่ต้องมีคอลัมน์ของตัวเอง — สองอย่างนี้
        // อ่านคู่กันเสมอ และ dialog กว้างจำกัด
        cell: ({ row }) => {
          const label = (
            <NameWithSubtext
              primary={row.original.location_name ?? "—"}
              secondary={row.original.location_code ?? undefined}
            />
          );
          if (!row.original.location_id) return label;
          return (
            <Link
              to={`/config/location/${row.original.location_id}`}
              onClick={() => onOpenChange(false)}
              className="hover:text-primary focus-visible:text-primary block hover:underline focus-visible:underline"
            >
              {label}
            </Link>
          );
        },
        size: 300,
      },
      {
        accessorKey: "location_type",
        header: () => tfl("locationType"),
        cell: ({ row }) => {
          const type = row.original.location_type;
          if (!type) return <span className="text-muted-foreground">—</span>;
          // ประเภทที่ไม่รู้จัก = โชว์คำที่ backend ส่งมาดิบ ๆ ไม่มีไอคอนนำ ดีกว่า
          // เดาไอคอนมั่วหรือทิ้งช่องว่าง
          const key = type.toLowerCase() as INVENTORY_TYPE;
          const Icon = LOCATION_TYPE_ICON[key];
          const labelKey = inventoryTypeLabelKey(key);
          return (
            // data-slot กัน `rowClamp` ของ DataGrid ที่ยัด line-clamp-2
            // (display:-webkit-box) ให้ลูกทุกตัวของเซลล์ — มันทับ flex ทิ้ง
            // ไอคอนเลยตกไปอยู่คนละบรรทัดกับข้อความ (ตัว badge/checkbox ของ
            // design system รอดมาได้เพราะมี data-slot ติดมาเอง)
            <div
              data-slot="location-type"
              className="flex items-center gap-1.5"
            >
              {Icon && (
                <Icon
                  className="text-muted-foreground size-3.5 shrink-0"
                  aria-hidden="true"
                />
              )}
              <span className="truncate whitespace-nowrap">
                {labelKey ? tloc(labelKey) : type.replace(/_/g, " ")}
              </span>
            </div>
          );
        },
        size: 200,
      },
      {
        accessorKey: "on_hand_qty",
        header: () => tfl("quantity"),
        cell: ({ row }) => {
          const qty = Number(row.original.on_hand_qty ?? 0);
          return <span className="font-semibold">{qty}</span>;
        },
        size: 160,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
        },
      },
    ],
    [tfl, tloc, onOpenChange],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.location_id ?? "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        <div className="relative space-y-4 px-6 pt-10 pb-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-base">{t("onHand")}</DialogTitle>
                {data?.as_of_date && (
                  <p className="text-muted-foreground text-xs">
                    {t("asOfDate", { date: data.as_of_date })}
                  </p>
                )}
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
                  <p className="text-info-ink text-lg leading-tight font-semibold tabular-nums">
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
