import { useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import { StatusChip } from "@/components/ui/status-chip";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { GRN_STATUS_CONFIG } from "@/constant/goods-receive-note";
import { getGrnDocTypeLabel } from "@/constant/grn-doc-type";
import { auditColumns } from "@/components/ui/data-grid/columns";

interface UseGrnTableOptions {
  goodsReceiveNotes: GoodsReceiveNote[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (grn: GoodsReceiveNote) => void;
  onDelete: (grn: GoodsReceiveNote) => void;
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "ผู้ขาย" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ · ไม่นับ invoice date/audit ที่ซ่อนเป็น default):
 *   ครบ  55+60+180+150+125+160+140+130+140+150+60 = 1350
 *   ไม่มี #                                         = 1290
 *   ไม่มีชนิดใบ (ลงบรรทัดรองใต้เลขที่)                  = 1160
 *   ไม่มีผู้รับ (ลงบรรทัดรองใต้ผู้ขาย)                    = 1020
 *   ไม่มีเลขใบแจ้งหนี้                                  =  860
 *   กล่องแคบ (ไม่มีวันที่ · เลขที่ 140 · ผู้ขาย 115)  55+140+115+140+150+60 = 660  (กล่องที่จอ 768 = 662)
 * จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px · # และเลขใบแจ้งหนี้ดูได้ในหน้าเอกสาร
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showIndex: w >= 1355,
    showType: w >= 1295,
    showReceivedBy: w >= 1165,
    showInvoice: w >= 1025,
    wide: w >= 865,
  };
}

export function useGrnTable({
  goodsReceiveNotes,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseGrnTableOptions) {
  "use no memo";
  const { showIndex, showType, showReceivedBy, showInvoice, wide } =
    columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — invoice date/audit ซ่อนเป็น default
  // ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    invoice_date: false,
    created_at: false,
    updated_at: false,
  });
  const { dateFormat, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");

  const columns: ColumnDef<GoodsReceiveNote>[] = [
    {
      accessorKey: "grn_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("grnNo")} />
      ),
      // คอลัมน์ชนิดใบ/วันที่ถูกซ่อนในกล่องแคบ — ลงเป็นบรรทัดรองใต้เลขที่ บรรทัดละอย่าง
      cell: ({ row }) => {
        const no = (
          <CellAction
            onClick={() => onEdit(row.original)}
            className="whitespace-nowrap"
          >
            {row.original.grn_no}
          </CellAction>
        );
        if (showType) return no;
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            {no}
            <span className="text-muted-foreground text-xs">
              {getGrnDocTypeLabel(tfl, row.original.doc_type)}
            </span>
            {!wide && (
              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatDate(row.original.grn_date, dateFormat)}
              </span>
            )}
          </div>
        );
      },
      // กล่องแคบเหลือ 140 (เลขที่ยาว ~110px + padding)
      size: wide ? 180 : 140,
      meta: { headerTitle: tfl("grnNo") },
    },
    {
      accessorKey: "vendor_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      cell: ({ row }) => (
        <div data-slot="cell-stack" className="flex min-w-0 flex-col">
          <span
            className="block truncate"
            title={row.original.vendor_name || undefined}
          >
            {row.original.vendor_name}
          </span>
          {/* คอลัมน์ผู้รับถูกซ่อนในกล่องแคบ — ย้ายมาเป็นบรรทัดรอง */}
          {!showReceivedBy && row.original.audit?.created?.name && (
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
      size: wide ? 150 : 115,
      meta: { headerTitle: tfl("vendor"), grow: true },
    },
    {
      accessorKey: "grn_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("grnDate")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => formatDate(row.getValue("grn_date"), dateFormat),
      size: 125,
      meta: {
        headerTitle: tfl("grnDate"),
        cellClassName: "text-center whitespace-nowrap tabular-nums",
      },
    },
    {
      accessorKey: "invoice_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("invoiceNo")} />
      ),
      // วันที่ใบแจ้งหนี้ซ้อนใต้เลขในเซลล์เดียว — สองค่านี้คือหลักฐานชิ้นเดียวกันจากผู้ขาย
      // คนเทียบกับกระดาษพร้อมกันอยู่แล้ว และคืนที่ให้ GRN No./Status ไม่ถูกบีบจนตัดคำที่
      // 1366 (คอลัมน์ invoice_date ยังอยู่ แค่ซ่อนเป็นค่าเริ่มต้น สำหรับคนที่อยากเรียง)
      cell: ({ row }) => {
        const invoiceNo = row.original.invoice_no;
        const invoiceDate = formatDate(row.original.invoice_date, dateFormat);
        if (!invoiceNo && !invoiceDate) return null;
        return (
          <div className="min-w-0">
            <span className="block truncate" title={invoiceNo || undefined}>
              {invoiceNo || "—"}
            </span>
            {invoiceDate && (
              <span className="text-muted-foreground block text-xs tabular-nums">
                {invoiceDate}
              </span>
            )}
          </div>
        );
      },
      size: 160,
      meta: { headerTitle: tfl("invoiceNo") },
    },
    {
      accessorKey: "invoice_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("invoiceDate")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => formatDate(row.getValue("invoice_date"), dateFormat),
      meta: {
        headerTitle: tfl("invoiceDate"),
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "doc_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("doc_status") || "draft";
        const config = GRN_STATUS_CONFIG[status];
        return (
          <StatusChip
            status={status}
            label={config?.label ?? status.toUpperCase()}
          />
        );
      },
      // กว้างพอให้ COMMITTED ไม่ถูกตัด — สถานะเป็นสิ่งเดียวในแถวที่คนกวาดตาหา
      size: 140,
      meta: {
        headerTitle: tfl("status"),
      },
    },
    {
      accessorKey: "doc_type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
      cell: ({ row }) => {
        const docType = row.original.doc_type;
        return (
          <StatusIconLabel
            status={docType}
            label={getGrnDocTypeLabel(tfl, docType)}
            // ชนิดใบไม่มีสี — สีสงวนไว้ให้สถานะซึ่งเป็นสิ่งที่คนกวาดตาหาจริง ๆ
            className="text-muted-foreground"
          />
        );
      },
      // พอสำหรับ "Purchase Order" ซึ่งยาวกว่า Manual
      size: 130,
      meta: {
        headerTitle: tfl("type"),
      },
    },
    {
      // คนที่รับของเข้าและคีย์ใบ — ของขาด/ของเสียต้องย้อนไปถามคนที่ยืนรับตอนนั้น
      // หัวคอลัมน์ใช้คำว่า "ผู้รับ" ตามที่หัวเอกสารเรียก ไม่ใช่ "ผู้สร้าง" กลาง ๆ
      // ไม่เรียงลำดับเพราะ audit เป็น object ซ้อน backend เรียงให้ไม่ได้
      id: "created_by",
      accessorFn: (row) => row.audit?.created?.name ?? "",
      // 140 ให้ชื่อ-นามสกุลผู้รับอ่านออก (115 ตัดเหลือ "Admin Fernan…")
      size: 140,
      header: tfl("receivedBy"),
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.audit?.created?.name || undefined}
        >
          {row.original.audit?.created?.name || "—"}
        </span>
      ),
      enableSorting: false,
      meta: { headerTitle: tfl("receivedBy") },
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
          <span className="font-medium tabular-nums">
            {formatCurrency(amount)}
            {currency && (
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                {currency}
              </span>
            )}
          </span>
        );
      },
      meta: {
        headerTitle: tfl("totalAmount"),
        cellClassName: "text-right",
      },
      // 150 = ยอด 6 หลัก + สกุลเงิน (~121px) + padding 24
      size: 150,
    },

    ...auditColumns<GoodsReceiveNote>(tfl, dateTimeFormat),
  ];

  // ส่งเป็นตัวแปร (ไม่ใช่ literal) — type ของ tableConfig ประกาศ state แค่ pagination/sorting
  const responsiveTableConfig = {
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showIndex && { index: false }),
        ...(!showType && { doc_type: false }),
        ...(!showReceivedBy && { created_by: false }),
        ...(!showInvoice && { invoice_no: false }),
        ...(!wide && { grn_date: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
  };

  return useConfigTable<GoodsReceiveNote>({
    data: goodsReceiveNotes,
    columns,
    totalRecords,
    params,
    tableConfig: responsiveTableConfig,
    onDelete,
    hideStatus: true,
    activity: { id: (r) => r.id, label: (r) => r.grn_no },
  });
}
