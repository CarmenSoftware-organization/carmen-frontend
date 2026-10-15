import type { ColumnDef } from "@tanstack/react-table";
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
}

export function useGrnTable({
  goodsReceiveNotes,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseGrnTableOptions) {
  const { dateFormat, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");

  const columns: ColumnDef<GoodsReceiveNote>[] = [
    {
      accessorKey: "grn_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("grnNo")} />
      ),
      cell: ({ row }) => (
        <CellAction
          onClick={() => onEdit(row.original)}
          className="whitespace-nowrap"
        >
          {row.original.grn_no}
        </CellAction>
      ),
      size: 180,
      meta: { headerTitle: tfl("grnNo") },
    },
    {
      accessorKey: "vendor_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      size: 165,
      meta: { headerTitle: tfl("vendor") },
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
      size: 190,
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
        <DataGridColumnHeader
          column={column}
          title={tfl("status")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("doc_status") || "draft";
        const config = GRN_STATUS_CONFIG[status];
        return (
          <StatusIconLabel
            status={status}
            label={config?.label ?? status.toUpperCase()}
            // คอลัมน์นี้จัดกลาง — label เป็น inline-flex ซึ่ง `text-center`
            // ของเซลล์เอื้อมไม่ถึงเมื่ออยู่ในกล่อง clamp ของ DataGrid
            //
            // สีเดียวกับคอลัมน์ชนิดใบ — ไอคอนรับสีจากข้อความแทนสีประจำสถานะ
            // (`!` เพราะ StatusIconLabel ใส่สีมาเป็น inline style ซึ่ง class ธรรมดา
            // สู้ไม่ได้ · แก้ที่คอมโพเนนต์ไม่ได้ มันเป็นของกลางทั้งแอป)
            className="text-muted-foreground flex w-full justify-center [&_svg]:text-current!"
          />
        );
      },
      // กว้างพอให้ COMMITTED ไม่ถูกตัด — สถานะเป็นสิ่งเดียวในแถวที่คนกวาดตาหา
      size: 140,
      meta: {
        headerTitle: tfl("status"),
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "doc_type",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("type")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const docType = row.original.doc_type;
        return (
          <StatusIconLabel
            status={docType}
            label={getGrnDocTypeLabel(tfl, docType)}
            // ชนิดใบไม่มีสี — สีสงวนไว้ให้สถานะซึ่งเป็นสิ่งที่คนกวาดตาหาจริง ๆ
            className="text-muted-foreground flex w-full justify-center"
          />
        );
      },
      // พอสำหรับ "Purchase Order" ซึ่งยาวกว่า Manual
      size: 130,
      meta: {
        headerTitle: tfl("type"),
        cellClassName: "text-center",
      },
    },
    {
      // คนที่รับของเข้าและคีย์ใบ — ของขาด/ของเสียต้องย้อนไปถามคนที่ยืนรับตอนนั้น
      // หัวคอลัมน์ใช้คำว่า "ผู้รับ" ตามที่หัวเอกสารเรียก ไม่ใช่ "ผู้สร้าง" กลาง ๆ
      // ไม่เรียงลำดับเพราะ audit เป็น object ซ้อน backend เรียงให้ไม่ได้
      id: "created_by",
      accessorFn: (row) => row.audit?.created?.name ?? "",
      size: 115,
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
      size: 135,
    },

    ...auditColumns<GoodsReceiveNote>(tfl, dateTimeFormat),
  ];

  return useConfigTable<GoodsReceiveNote>({
    data: goodsReceiveNotes,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: {
        invoice_date: false,
        created_at: false,
        updated_at: false,
      },
    },
    activity: { id: (r) => r.id, label: (r) => r.grn_no },
  });
}
