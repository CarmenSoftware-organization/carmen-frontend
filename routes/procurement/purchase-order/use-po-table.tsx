import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { PO_TYPE, type PurchaseOrder } from "@/types/purchase-order";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import {
  auditColumns,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { PoSendBackHint } from "./po-send-back-hint";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { PO_STATUS_CONFIG, PO_TYPE_CONFIG } from "@/constant/purchase-order";

interface UsePoTableOptions {
  purchaseOrders: PurchaseOrder[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (po: PurchaseOrder) => void;
}

export function usePoTable({
  purchaseOrders,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UsePoTableOptions) {
  const tfl = useTranslations("field");
  const t = useTranslations("procurement.purchaseOrder");
  const { dateFormat, dateTimeFormat } = useProfile();

  const columns: ColumnDef<PurchaseOrder>[] = [
    {
      accessorKey: "po_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("poNo")} />
      ),
      // ป้าย "ส่งกลับ" ต่อท้ายเลขที่แทนคอลัมน์ของตัวเอง (ท่าเดียวกับ PR list) —
      // hover ป้ายเพื่อดูเหตุผล · ชนิดใบเป็นบรรทัดรอง แทนคอลัมน์ Type ที่กินที่
      // 100px เพื่อให้ตารางพอดีจอ 1366px · ชนิดใบไม่มีสี สีสงวนไว้ให้สถานะ
      // data-slot ให้ rowClamp ของ DataGrid ข้ามกล่องนี้
      cell: ({ row }) => {
        const type = row.original.po_type ?? PO_TYPE.MANUAL;
        const typeConfig =
          PO_TYPE_CONFIG[type] ?? PO_TYPE_CONFIG[PO_TYPE.MANUAL];
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            <div className="flex items-center gap-1.5">
              <CellAction onClick={() => onEdit(row.original)}>
                {row.getValue("po_no")}
              </CellAction>
              <PoSendBackHint
                poId={row.original.id}
                lastAction={row.original.last_action}
              />
            </div>
            <span className="text-muted-foreground text-xs">
              {typeConfig.label}
            </span>
          </div>
        );
      },
      // 225 = เลขที่ยาว (108px) + ป้าย SEND BACK (85px) + padding เซลล์ 24px
      // ไม่ถูกตัดที่ 1366px — ตารางนี้ไม่ถูกยืดเหมือน PR list size จึงต้องพอเอง
      size: 225,
      meta: { headerTitle: tfl("poNo"), skeleton: columnSkeletons.text },
    },
    {
      id: "vendor_name",
      accessorFn: (row) => row.vendor?.name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.vendor?.name ?? undefined}
        >
          {row.original.vendor?.name}
        </span>
      ),
      size: 160,
      meta: { headerTitle: tfl("vendor"), skeleton: columnSkeletons.text },
    },
    {
      // คนที่เปิดใบสั่งซื้อใบนี้ — ใบเดียวกันคนละคนสั่งคนละเงื่อนไข ต้องรู้ว่าจะไป
      // ถามใครต่อ · หัวคอลัมน์ใช้คำว่า "ผู้จัดซื้อ" ตามที่หัวเอกสารเรียก ไม่ใช่
      // "ผู้สร้าง" กลาง ๆ · อ่าน audit.created ไม่ใช่ `buyer_name` เพราะตัวกรอง
      // ผู้จัดซื้อยิงที่ created_by_id — คอลัมน์กับตัวกรองต้องเป็นคนเดียวกัน
      // · ไม่เรียงลำดับเพราะ audit เป็น object ซ้อน backend เรียงให้ไม่ได้
      id: "created_by",
      accessorFn: (row) => row.audit?.created?.name ?? "",
      size: 110,
      header: tfl("buyer"),
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.audit?.created?.name ?? undefined}
        >
          {row.original.audit?.created?.name || "—"}
        </span>
      ),
      enableSorting: false,
      meta: {
        headerTitle: tfl("buyer"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "order_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("orderDate")}
          className="justify-center"
        />
      ),
      // 140 ให้บรรทัดรอง "Delivery 2026-04-09" ไม่ถูกตัด
      size: 140,
      // วันที่ส่งเป็นบรรทัดรองแทนคอลัมน์แยก ให้ตารางพอดีจอ 1366px
      cell: ({ row }) => {
        const { delivery_date } = row.original;
        return (
          <div data-slot="cell-stack" className="flex flex-col">
            <span>{formatDate(row.getValue("order_date"), dateFormat)}</span>
            {delivery_date && (
              <span
                className="text-muted-foreground text-xs"
                title={tfl("deliveryDate")}
              >
                {t("deliveryOn", {
                  date: formatDate(delivery_date, dateFormat),
                })}
              </span>
            )}
          </div>
        );
      },
      meta: {
        headerTitle: tfl("orderDate"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
      },
    },
    {
      // ซ่อนเป็น default — วันที่ส่งโชว์เป็นบรรทัดรองใต้วันที่สั่งแล้ว แต่ต้องยังเรียง
      // ตามวันที่ส่งได้: เมนูเรียง (⇅) ของ toolbar อ่านจาก getAllColumns() ซึ่งรวม
      // คอลัมน์ที่ซ่อนอยู่ (ท่าเดียวกับ created_at/updated_at) และเปิดเป็นคอลัมน์
      // จากเมนู Columns ได้ถ้าต้องการ
      accessorKey: "delivery_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("deliveryDate")}
          className="justify-center"
        />
      ),
      size: 100,
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDate(row.getValue("delivery_date"), dateFormat)}
        </span>
      ),
      meta: {
        headerTitle: tfl("deliveryDate"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "po_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      size: 140,
      // ชื่อ stage เป็นบรรทัดรองของสถานะ (ท่าเดียวกับ PR list)
      cell: ({ row }) => {
        const { po_status: status, workflow_current_stage: stage } =
          row.original;
        const config = PO_STATUS_CONFIG[status];
        return (
          <div data-slot="cell-stack" className="flex min-w-0 flex-col">
            <StatusIconLabel status={status} label={config?.label ?? status} />
            {stage && (
              <span
                className="text-muted-foreground truncate text-xs"
                title={stage}
              >
                {stage}
              </span>
            )}
          </div>
        );
      },
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "total_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("totalAmount")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const amount = row.getValue<number>("total_amount");
        const currency = row.original.currency?.code;
        if (amount == null) return <span></span>;
        return (
          <span className="font-medium whitespace-nowrap tabular-nums">
            {formatCurrency(amount)}
            {currency && (
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                {currency}
              </span>
            )}
          </span>
        );
      },
      size: 130,
      meta: {
        headerTitle: tfl("totalAmount"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    ...auditColumns<PurchaseOrder>(tfl, dateTimeFormat),
  ];

  return useConfigTable<PurchaseOrder>({
    data: purchaseOrders,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: {
        delivery_date: false,
        created_at: false,
        updated_at: false,
      },
    },
    activity: { id: (r) => r.id, label: (r) => r.po_no },
  });
}
