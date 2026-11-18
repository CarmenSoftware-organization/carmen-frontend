import { useState } from "react";
import { useTranslations } from "use-intl";
import { HiddenValue } from "@/components/share/hidden-value";
import { isPriceHidden } from "@/types/workflows";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
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
import { StatusChip } from "@/components/ui/status-chip";
import { PO_STATUS_CONFIG, PO_TYPE_CONFIG } from "@/constant/purchase-order";

interface UsePoTableOptions {
  purchaseOrders: PurchaseOrder[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (po: PurchaseOrder) => void;
  onDelete: (po: PurchaseOrder) => void;
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "ผู้ขาย" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ · ไม่นับ delivery/audit ที่ซ่อนเป็น default):
 *   ครบ  55+48+225+140+90+145+90+130+150+60 = 1133
 *   ไม่มี workflow                           = 1043
 *   ไม่มีผู้จัดซื้อ                             =  953
 *   กล่องแคบ (ไม่มีวันที่ · เลขที่ 140 · ผู้ขาย 120)  55+48+140+120+130+150+60 = 703
 *   ไม่มีคอลัมน์สถานะ (ชิปลงใต้ผู้ขาย)               = 573  (กล่องที่จอ 768 = 662)
 * `#` แสดงตลอดทุกขั้น (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน) — ขั้นแคบสุดจึงย้ายสถานะ
 * ลงบรรทัดรองใต้ผู้ขายแทน (ช่องเลขที่สูง 4 บรรทัดอยู่แล้ว แถวจึงไม่สูงขึ้น)
 *   กล่องกว้างมาก (≥1400): ผู้จัดซื้อ 90→200 (ครบ 1255) ชื่อเต็มไม่ถูกตัด
 * จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px · ผู้จัดซื้อที่ถูกซ่อนลงบรรทัดรองใต้ผู้ขาย
 * วันที่สั่งลงบรรทัดรองใต้เลขที่ · workflow ดูได้ในหน้าเอกสาร
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showWorkflow: w >= 1138,
    showBuyer: w >= 1048,
    wide: w >= 958,
    showStatus: w >= 708,
    roomy: w >= 1400,
  };
}

/** ชิปสถานะ + ชื่อ stage — ใช้ทั้งในคอลัมน์สถานะและเป็นบรรทัดรองใต้ผู้ขายในกล่องแคบสุด */
function PoStatusStack({ po }: { readonly po: PurchaseOrder }) {
  const { po_status: status, workflow_current_stage: stage } = po;
  const config = PO_STATUS_CONFIG[status];
  return (
    <div data-slot="cell-stack" className="flex min-w-0 flex-col items-start">
      <StatusChip status={status} label={config?.label ?? status} />
      {stage && (
        <span className="text-muted-foreground truncate text-xs" title={stage}>
          {stage}
        </span>
      )}
    </div>
  );
}

export function usePoTable({
  purchaseOrders,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UsePoTableOptions) {
  "use no memo";
  const { showStatus, showWorkflow, showBuyer, wide, roomy } =
    columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — delivery/audit ซ่อนเป็น default
  // ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    delivery_date: false,
    created_at: false,
    updated_at: false,
  });
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
        const sendBack = (
          <PoSendBackHint
            poId={row.original.id}
            lastAction={row.original.last_action}
          />
        );
        if (wide)
          return (
            <div data-slot="cell-stack" className="flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                <CellAction onClick={() => onEdit(row.original)}>
                  {row.getValue("po_no")}
                </CellAction>
                {sendBack}
              </div>
              <span className="text-muted-foreground text-xs">
                {typeConfig.label}
              </span>
            </div>
          );
        // กล่องแคบ: คอลัมน์วันที่ถูกซ่อน — ชนิด / วันที่สั่ง / ป้ายส่งกลับ เรียงเป็นบรรทัดรอง
        // บรรทัดละอย่าง ("Purchase Request · 2026-06-25" บรรทัดเดียวต้องการ 179px)
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            <CellAction onClick={() => onEdit(row.original)}>
              {row.getValue("po_no")}
            </CellAction>
            <span className="text-muted-foreground text-xs">
              {typeConfig.label}
            </span>
            <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {formatDate(row.original.order_date, dateFormat)}
            </span>
            {sendBack}
          </div>
        );
      },
      // 225 = เลขที่ยาว (108px) + ป้าย SEND BACK (85px) + padding เซลล์ 24px
      // กล่องแคบป้ายลงบรรทัดรอง เหลือ 140 (เลขที่ 108 + padding)
      size: wide ? 225 : 140,
      meta: { headerTitle: tfl("poNo"), skeleton: columnSkeletons.text },
    },
    {
      id: "vendor_name",
      accessorFn: (row) => row.vendor?.name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      cell: ({ row }) => (
        <div data-slot="cell-stack" className="flex min-w-0 flex-col">
          <span
            className="block truncate"
            title={row.original.vendor?.name ?? undefined}
          >
            {row.original.vendor?.name}
          </span>
          {/* คอลัมน์สถานะถูกซ่อนในกล่องแคบสุด — ชิปย้ายมาเป็นบรรทัดรอง */}
          {!showStatus && <PoStatusStack po={row.original} />}
          {/* คอลัมน์ผู้จัดซื้อถูกซ่อนในกล่องแคบ — ย้ายมาเป็นบรรทัดรอง */}
          {!showBuyer && row.original.audit?.created?.name && (
            <span
              className="text-muted-foreground block truncate text-xs"
              title={row.original.audit.created.name}
            >
              {row.original.audit.created.name}
            </span>
          )}
        </div>
      ),
      // ข้อความยาวได้ — รับที่เหลือ ไม่ให้คอลัมน์สั้นห่างกันเป็นร้อยพิกเซลที่ 4K · size = ขั้นต่ำ
      size: wide ? 140 : 120,
      meta: {
        headerTitle: tfl("vendor"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      // คนที่เปิดใบสั่งซื้อใบนี้ — ใบเดียวกันคนละคนสั่งคนละเงื่อนไข ต้องรู้ว่าจะไป
      // ถามใครต่อ · หัวคอลัมน์ใช้คำว่า "ผู้จัดซื้อ" ตามที่หัวเอกสารเรียก ไม่ใช่
      // "ผู้สร้าง" กลาง ๆ · อ่าน audit.created ไม่ใช่ `buyer_name` เพราะตัวกรอง
      // ผู้จัดซื้อยิงที่ created_by_id — คอลัมน์กับตัวกรองต้องเป็นคนเดียวกัน
      // · ไม่เรียงลำดับเพราะ audit เป็น object ซ้อน backend เรียงให้ไม่ได้
      id: "created_by",
      accessorFn: (row) => row.audit?.created?.name ?? "",
      size: roomy ? 200 : 90,
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
      // 145 ให้บรรทัดรอง "Delivery 2026-06-26" (118px + padding 24) ไม่ถูกตัด
      size: 145,
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
      // ตำแหน่งเดียวกับ PR/SR list (หลังวันที่ ก่อนสถานะ)
      accessorKey: "workflow_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("workflow")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.workflow_name ?? undefined}
        >
          {row.original.workflow_name}
        </span>
      ),
      size: 90,
      meta: { headerTitle: tfl("workflow"), skeleton: columnSkeletons.text },
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
      size: 130,
      // ชื่อ stage เป็นบรรทัดรองของสถานะ (ท่าเดียวกับ PR list)
      cell: ({ row }) => <PoStatusStack po={row.original} />,
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
        if (isPriceHidden(row.original.hidden_fields, "total_price"))
          return <HiddenValue />;
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
      // 150 = "242,490.20 USD" (121px) + padding 24 — เดิม 115 ตัดสกุลเงินของยอด 6 หลัก
      size: 150,
      meta: {
        headerTitle: tfl("totalAmount"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    ...auditColumns<PurchaseOrder>(tfl, dateTimeFormat),
  ];

  // ส่งเป็นตัวแปร (ไม่ใช่ literal) — type ของ tableConfig ประกาศ state แค่ pagination/sorting
  const responsiveTableConfig = {
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showStatus && { po_status: false }),
        ...(!showWorkflow && { workflow_name: false }),
        ...(!showBuyer && { created_by: false }),
        ...(!wide && { order_date: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
  };

  return useConfigTable<PurchaseOrder>({
    data: purchaseOrders,
    columns,
    totalRecords,
    params,
    onDelete,
    hideStatus: true,
    tableConfig: responsiveTableConfig,
    activity: { id: (r) => r.id, label: (r) => r.po_no },
  });
}
