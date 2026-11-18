import { useState } from "react";
import { useTranslations } from "use-intl";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import type { CreditNote } from "@/types/credit-note";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import { cn } from "@/lib/utils";
import {
  auditColumns,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { StatusChip } from "@/components/ui/status-chip";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { CN_STATUS_CONFIG, CN_TYPE_CONFIG } from "@/constant/credit-note";

interface UseCnTableOptions {
  creditNotes: CreditNote[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (cn: CreditNote) => void;
  onDelete: (cn: CreditNote) => void;
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "ผู้ขาย" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ · ไม่นับ audit ที่ซ่อนเป็น default):
 *   ครบ  55+60+130+150+140+115+140+115+135+140+115+135+150+60 = 1640
 *   ไม่มี #                                         = 1580
 *   ไม่มีชนิดใบ (ลงบรรทัดรองใต้เลขที่)                  = 1445
 *   ไม่มีผู้สร้าง (ลงบรรทัดรองใต้ผู้ขาย)                  = 1305
 *   ไม่มีวันที่ใบแจ้งหนี้ (ลงบรรทัดรองใต้เลขใบแจ้งหนี้)     = 1190
 *   ไม่มีวันที่ GRN (ลงบรรทัดรองใต้เลข GRN)              = 1075  (กล่องที่ 1366 เมนูกาง = 1084)
 *   ไม่มีเลขใบแจ้งหนี้                                  =  935
 *   ไม่มีเลข GRN                                       =  795
 *   กล่องแคบ (ไม่มีวันที่ ลงใต้เลขที่ · ผู้ขาย 120)  55+130+120+135+150+60 = 650  (กล่องที่จอ 768 = 662)
 *   กล่องกว้างมาก (≥1705): ผู้สร้าง 140→200 (ครบ 1700)
 * GRN No / GRN Date / Invoice No / Invoice Date ผู้ใช้สั่ง 2026-11-18 (list endpoint ต้องส่ง
 * 4 ฟิลด์นี้ — BE เพิ่มพร้อมกัน) · จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px · # ดูได้ในหน้าเอกสาร
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showIndex: w >= 1645,
    showType: w >= 1585,
    showCreatedBy: w >= 1450,
    showInvoiceDate: w >= 1310,
    showGrnDate: w >= 1195,
    showInvoice: w >= 1080,
    showGrn: w >= 940,
    wide: w >= 800,
    roomy: w >= 1705,
  };
}

export function useCnTable({
  creditNotes,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseCnTableOptions) {
  "use no memo";
  const {
    showIndex,
    showType,
    showCreatedBy,
    showInvoiceDate,
    showGrnDate,
    showInvoice,
    showGrn,
    wide,
    roomy,
  } = columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — audit ซ่อนเป็น default
  // ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    created_at: false,
    updated_at: false,
  });
  const tfl = useTranslations("field");
  const { dateFormat, dateTimeFormat } = useProfile();
  // คอลัมน์วันที่ถูกซ่อน (กล่องแคบ หรือผู้ใช้ปิดเอง) → ซ้อนใต้เลขของมันแทน
  const grnDateColumn = showGrnDate && userVisibility.grn_date !== false;
  const invoiceDateColumn =
    showInvoiceDate && userVisibility.invoice_date !== false;

  const noWithDate = (
    no?: string | null,
    date?: string | null,
    stack = false,
  ) => {
    const d = stack ? formatDate(date, dateFormat) : "";
    if (!no && !d) return null;
    return (
      <div data-slot="cell-stack" className="flex min-w-0 flex-col">
        <span className="block truncate" title={no || undefined}>
          {no || "—"}
        </span>
        {d && (
          <span className="text-muted-foreground block text-xs whitespace-nowrap tabular-nums">
            {d}
          </span>
        )}
      </div>
    );
  };

  const dateColumn = (
    key: "grn_date" | "invoice_date",
    title: string,
  ): ColumnDef<CreditNote> => ({
    accessorKey: key,
    header: ({ column }) => (
      <DataGridColumnHeader
        column={column}
        title={title}
        className="justify-center"
      />
    ),
    cell: ({ row }) => formatDate(row.original[key], dateFormat),
    size: 115,
    meta: {
      headerTitle: title,
      skeleton: columnSkeletons.text,
      cellClassName: "text-center whitespace-nowrap tabular-nums",
    },
  });

  const columns: ColumnDef<CreditNote>[] = [
    {
      accessorKey: "cn_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("cnNo")} />
      ),
      // คอลัมน์ชนิดใบ/วันที่ถูกซ่อนในกล่องแคบ — ลงเป็นบรรทัดรองใต้เลขที่ บรรทัดละอย่าง
      cell: ({ row }) => {
        const no = (
          <CellAction
            onClick={() => onEdit(row.original)}
            className="whitespace-nowrap"
          >
            {row.original.cn_no}
          </CellAction>
        );
        if (showType) return no;
        const type = row.original.credit_note_type;
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            {no}
            <span className="text-muted-foreground text-xs whitespace-nowrap">
              {CN_TYPE_CONFIG[type]?.label ?? type}
            </span>
            {!wide && (
              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatDate(row.original.cn_date, dateFormat)}
              </span>
            )}
          </div>
        );
      },
      size: 130,
      meta: { headerTitle: tfl("cnNo"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "vendor_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      // ตัดคำพร้อม title แทนการขึ้นบรรทัดใหม่ — แถวสูงไม่เท่ากันทำให้กวาดตาลงยาก
      cell: ({ row }) => (
        <div data-slot="cell-stack" className="flex min-w-0 flex-col">
          <span
            className="block truncate"
            title={row.original.vendor_name || undefined}
          >
            {row.original.vendor_name}
          </span>
          {/* คอลัมน์ผู้สร้างถูกซ่อนในกล่องแคบ — ย้ายมาเป็นบรรทัดรอง */}
          {!showCreatedBy && row.original.audit?.created?.name && (
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
      size: wide ? 150 : 120,
      meta: {
        headerTitle: tfl("vendor"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      accessorKey: "grn_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("grnNo")} />
      ),
      cell: ({ row }) =>
        noWithDate(row.original.grn_no, row.original.grn_date, !grnDateColumn),
      // เลข GRN ยาว ~100px (GRN261100003) + padding
      size: 140,
      meta: { headerTitle: tfl("grnNo"), skeleton: columnSkeletons.text },
    },
    dateColumn("grn_date", tfl("grnDate")),
    {
      accessorKey: "invoice_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("invoiceNo")} />
      ),
      cell: ({ row }) =>
        noWithDate(
          row.original.invoice_no,
          row.original.invoice_date,
          !invoiceDateColumn,
        ),
      size: 140,
      meta: { headerTitle: tfl("invoiceNo"), skeleton: columnSkeletons.text },
    },
    dateColumn("invoice_date", tfl("invoiceDate")),
    {
      accessorKey: "credit_note_type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
      cell: ({ row }) => {
        const type = row.original.credit_note_type;
        const config = CN_TYPE_CONFIG[type];
        return (
          <StatusIconLabel
            status={type}
            label={config?.label ?? type}
            // ชนิดใบไม่มีสี — สีสงวนไว้ให้สถานะซึ่งเป็นสิ่งที่คนกวาดตาหาจริง ๆ
            className="text-muted-foreground whitespace-nowrap"
          />
        );
      },
      // พอสำหรับ "AMT DISCOUNT" ซึ่งยาวกว่า QTY RETURN
      size: 135,
      meta: {
        headerTitle: tfl("type"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      // คนที่เปิดใบลดหนี้ใบนี้ — ใบคืนของมักต้องคุยกลับกับคนเปิดว่าคืนเพราะอะไร
      // จึงต้องเห็นชื่อตั้งแต่หน้ารายการ · ไม่เรียงลำดับเพราะ audit เป็น object
      // ซ้อน backend เรียงให้ไม่ได้
      id: "created_by",
      accessorFn: (row) => row.audit?.created?.name ?? "",
      header: tfl("createdBy"),
      // กล่องกว้างมาก 200 ชื่อเต็ม (140 ตัด "ศิริวรรณ Purchase…" ที่ Full HD/4K)
      size: roomy ? 200 : 140,
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.audit?.created?.name || undefined}
        >
          {row.original.audit?.created?.name || "—"}
        </span>
      ),
      enableSorting: false,
      meta: {
        headerTitle: tfl("createdBy"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "cn_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("docDate")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => formatDate(row.original.cn_date, dateFormat),
      size: 115,
      meta: {
        headerTitle: tfl("docDate"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-center whitespace-nowrap tabular-nums",
      },
    },
    {
      accessorKey: "doc_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => {
        const status = row.original.doc_status;
        const config = CN_STATUS_CONFIG[status];
        return <StatusChip status={status} label={config?.label ?? status} />;
      },
      // กว้างพอให้ COMPLETED ไม่ถูกตัด
      size: 135,
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
        const amount = row.original.total_amount;
        const currency = row.original.currency_code;
        if (amount == null) return <span></span>;
        // ยอดศูนย์ (มักเป็นใบคืนของที่ยังไม่คิดมูลค่า) จางลง ให้ยอดที่มีเงินจริงเด่นขึ้นมา
        const isZero = Number(amount) === 0;
        return (
          <span
            className={cn(
              "font-medium whitespace-nowrap tabular-nums",
              isZero && "text-muted-foreground font-normal",
            )}
          >
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
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
      // 150 = ยอด 6 หลัก + สกุลเงิน (~121px) + padding 24
      size: 150,
    },
    ...auditColumns<CreditNote>(tfl, dateTimeFormat),
  ];

  // ส่งเป็นตัวแปร (ไม่ใช่ literal) — type ของ tableConfig ประกาศ state แค่ pagination/sorting
  const responsiveTableConfig = {
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showIndex && { index: false }),
        ...(!showType && { credit_note_type: false }),
        ...(!showCreatedBy && { created_by: false }),
        ...(!showInvoiceDate && { invoice_date: false }),
        ...(!showGrnDate && { grn_date: false }),
        ...(!showInvoice && { invoice_no: false }),
        ...(!showGrn && { grn_no: false }),
        ...(!wide && { cn_date: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
  };

  return useConfigTable<CreditNote>({
    data: creditNotes,
    columns,
    totalRecords,
    params,
    tableConfig: responsiveTableConfig,
    onDelete,
    hideStatus: true,
    activity: { id: (r) => r.id, label: (r) => r.cn_no },
  });
}
