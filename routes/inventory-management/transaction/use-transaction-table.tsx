import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import {
  indexColumn,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { StatusDotBadge, type DotTone } from "@/components/ui/status-dot-badge";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatAmount } from "@/lib/currency-utils";
import type { Transaction, TransactionDocType } from "@/types/transaction";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseTransactionTableOptions {
  items: Transaction[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
}

/**
 * ชนิดเอกสาร → ตัวย่อ + สีของจุด
 *
 * ของเดิมเป็น Badge ทึบเจ็ดสีเรียงกันในคอลัมน์เดียว ซึ่งชนกติกา "avoid neon" ของ
 * docs/DESIGN.md (สีความหมายโผล่ครั้งเดียวต่อชิ้น ไม่ใช่ย้อมทั้งป้าย) และสีทั้ง
 * เจ็ดก็ไม่ได้แปลว่าอะไรเลย เป็นแค่การแยกให้ดูต่าง
 *
 * เปลี่ยนเป็นชิปกลาง + จุดสีเดียว โดยให้สีบอก **ทิศทางของของ** ซึ่งเป็นสิ่งที่
 * คนอ่านตารางนี้มองหาจริง ๆ: เขียว = ของเข้า · เหลือง = ของออก · เทา = ยังไม่มี
 * ของขยับ (ใบขอซื้อ/ใบสั่งซื้อเป็นแค่คำสั่ง ยังไม่กระทบสต๊อก)
 */
const DOC_TYPE_CONFIG: Record<
  TransactionDocType,
  { label: string; tone: DotTone }
> = {
  stock_in: { label: "SI", tone: "success" },
  good_received_note: { label: "GRN", tone: "success" },
  stock_out: { label: "SO", tone: "warning" },
  store_requisition: { label: "SR", tone: "warning" },
  credit_note: { label: "CN", tone: "warning" },
  purchase_request: { label: "PR", tone: "neutral" },
  purchase_order: { label: "PO", tone: "neutral" },
};

/**
 * ชื่อที่ไม่ซ้ำจาก `details[]` ต่อกันด้วย ", " — ใบเดียวมีได้หลายสินค้า/หลายคลัง
 *
 * gateway ยุบ `product_*` / `location_*` เป็นก้อน `product` / `location` ให้แล้ว
 * และก้อนนั้นเป็น null ได้ถ้า id เป็น null — กรองตัวที่ไม่มีชื่อออกก่อนต่อสตริง
 * ไม่งั้นได้ ", , " ลอยมา
 */
function joinDetailNames(
  details: Transaction["details"],
  pick: (d: Transaction["details"][number]) => string | null | undefined,
): string {
  return [...new Set(details.map(pick).filter((n): n is string => !!n))].join(
    ", ",
  );
}

export function useTransactionTable({
  items,
  totalRecords,
  params,
  tableConfig,
}: UseTransactionTableOptions) {
  "use no memo";
  const { dateFormat, amountFormat, defaultCurrencyCode } = useProfile();
  const tfl = useTranslations("field");
  const t = useTranslations("inventoryManagement.transaction");

  const dataColumns: ColumnDef<Transaction>[] = [
    {
      accessorKey: "audit.created.at",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("date")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => formatDate(row.original.audit.created.at, dateFormat),
      meta: {
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "inventory_doc_type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
      cell: ({ row }) => {
        const docType = row.original.inventory_doc_type;
        const config = DOC_TYPE_CONFIG[docType];
        return (
          <StatusDotBadge tone={config?.tone ?? "neutral"} size="sm">
            {config?.label ?? docType}
          </StatusDotBadge>
        );
      },
      meta: {
        skeleton: columnSkeletons.badge,
      },
      size: 80,
    },
    {
      accessorKey: "parent_document_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("parentDocNo")} />
      ),
      cell: ({ row }) => row.original.parent_document_no ?? "-",
      meta: { skeleton: columnSkeletons.text },
      size: 220,
    },
    {
      accessorKey: "product",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("product")} />
      ),
      cell: ({ row }) => {
        const text = joinDetailNames(
          row.original.details,
          (d) => d.product?.name,
        );
        if (!text) return "-";
        // ใบเดียวมีได้หลายสินค้า ต่อกันแล้วยาวจนดันแถวสูงกว่าเพื่อนหลายเท่า —
        // ตัดที่ 2 บรรทัดแล้วใส่จุดไข่ปลา · ตัวเต็มดูได้จาก tooltip ของเบราว์เซอร์
        return (
          <span className="line-clamp-2 break-words" title={text}>
            {text}
          </span>
        );
      },
      meta: { skeleton: columnSkeletons.text },
      size: 220,
    },
    {
      accessorKey: "location",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("location")} />
      ),
      cell: ({ row }) => {
        const text = joinDetailNames(
          row.original.details,
          (d) => d.location?.name,
        );
        if (!text) return "-";
        return (
          <span className="line-clamp-2 break-words" title={text}>
            {text}
          </span>
        );
      },
      meta: { skeleton: columnSkeletons.text },
      size: 220,
    },
    {
      id: "qty_in",
      header: t("qtyIn"),
      cell: ({ row }) => {
        const total = row.original.details.reduce(
          (sum, d) => sum + d.qty_in,
          0,
        );
        if (total === 0) return "-";
        return <span className="text-success-ink">{total}</span>;
      },
      meta: {
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
        headerClassName: "text-right",
      },
      size: 80,
    },
    {
      id: "qty_out",
      header: t("qtyOut"),
      cell: ({ row }) => {
        const total = row.original.details.reduce(
          (sum, d) => sum + d.qty_out,
          0,
        );
        if (total === 0) return "-";
        return <span className="text-destructive">{total}</span>;
      },
      meta: {
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
        headerClassName: "text-right",
      },
      size: 80,
    },
    {
      id: "items_count",
      header: tfl("items"),
      cell: ({ row }) => row.original.details.length,
      meta: {
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
        headerClassName: "text-center",
      },
      size: 60,
    },

    {
      id: "total_cost",
      header: tfl("total"),
      cell: ({ row }) => {
        const total = row.original.details.reduce(
          (sum, d) => sum + d.total_cost,
          0,
        );
        // ต่อท้ายด้วยสกุลเงินหลักของกิจการ (ทรงเดียวกับคอลัมน์ยอดรวมของ PR/PO/CN)
        // — ตัวเลขเปล่า ๆ ไม่บอกว่านับเป็นเงินอะไร ต้นทุนในคลังเก็บเป็นเงินหลัก
        // เสมอ ไม่ใช่สกุลของใบที่ซื้อมา
        return (
          <div className="text-right">
            <span className="font-medium">
              {formatAmount(total, amountFormat)}
            </span>
            {defaultCurrencyCode && (
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                {defaultCurrencyCode}
              </span>
            )}
          </div>
        );
      },
      meta: {
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
        headerClassName: "text-right",
      },
    },
  ];

  const allColumns: ColumnDef<Transaction>[] = [
    indexColumn<Transaction>(params),
    ...dataColumns,
  ];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
