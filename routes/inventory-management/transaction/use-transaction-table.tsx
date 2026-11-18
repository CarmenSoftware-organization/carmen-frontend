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
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ตารางเต็ม */
  containerWidth?: number;
}

/**
 * ขั้นของตารางตามความกว้างกล่อง (ไม่ใช่ของจอ — sidebar พับ/กางได้) · หน้าใช้ `compact`
 * ปิด rowClamp ด้วย จึง export ให้ใช้เกณฑ์เดียวกัน
 *
 * สินค้ารับที่เหลือ (`meta.grow`) คอลัมน์อื่นกว้างคงที่ — เดิมแบ่งสัดส่วน ที่ tablet ชิปชนิด
 * เลขที่เอกสาร และยอดรวมล้นเซลล์ (ชิปล้นแม้ที่ 1366) · ไม่มีคอลัมน์ select ผลรวมจึงเป็นขั้นต่ำจริง:
 *   ครบ             48+110+90+170+200+180+80+80+60+150 = 1168
 *   ไม่มีจำนวนรายการ                                    = 1108
 *   ไม่มีคลัง (ลงใต้สินค้า)                              = 928
 *   รวมคอลัมน์ (merged)  # 48 + เอกสาร 220 + สินค้า 190 + จำนวน 90 + ยอดรวม 150 = 698
 *                       ชิปชนิดอยู่หน้าเลขที่ วันที่ลงใต้เลขที่ · เข้า/ออกรวมเป็นคอลัมน์เดียว
 *   ต่ำกว่านั้น (compact) # + เซลล์เดียวสามบรรทัด — tablet 662 อยู่ขั้นนี้
 * `#` แสดงตลอดทุกขั้น รวมถึง compact (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน)
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 35px (ขั้น compact ใช้ 10px)
 */
export function transactionTableTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    compact: w < 708,
    merged: w < 963,
    showLocation: w >= 1143,
    showItems: w >= 1203,
  };
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
  containerWidth,
}: UseTransactionTableOptions) {
  "use no memo";
  const { compact, merged, showLocation, showItems } =
    transactionTableTier(containerWidth);
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
        cellClassName: "text-center whitespace-nowrap",
      },
      size: 110,
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
      // ชิป "GRN" + จุด ~52px และหัว "Type" + ไอคอนเรียง ~49px บวก padding เซลล์ 24
      size: 90,
    },
    {
      accessorKey: "parent_document_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("parentDocNo")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {row.original.parent_document_no ?? "-"}
        </span>
      ),
      meta: { skeleton: columnSkeletons.text },
      size: 170,
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
        // กล่องแคบ: คลังที่ถูกซ่อนลงมาเป็นบรรทัดรองใต้สินค้า (สินค้าเหลือบรรทัดเดียว)
        if (!showLocation) {
          const location = joinDetailNames(
            row.original.details,
            (d) => d.location?.name,
          );
          return (
            <div className="min-w-0">
              <span className="block truncate" title={text || undefined}>
                {text || "-"}
              </span>
              {location && (
                <span
                  className="text-muted-foreground block truncate text-xs"
                  title={location}
                >
                  {location}
                </span>
              )}
            </div>
          );
        }
        if (!text) return "-";
        // ใบเดียวมีได้หลายสินค้า ต่อกันแล้วยาวจนดันแถวสูงกว่าเพื่อนหลายเท่า —
        // ตัดที่ 2 บรรทัดแล้วใส่จุดไข่ปลา · ตัวเต็มดูได้จาก tooltip ของเบราว์เซอร์
        return (
          <span className="line-clamp-2 break-words" title={text}>
            {text}
          </span>
        );
      },
      meta: { skeleton: columnSkeletons.text, grow: true },
      size: merged ? 190 : 200,
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
      size: 180,
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
        cellClassName: "text-right whitespace-nowrap",
        headerClassName: "text-right",
      },
      size: 150,
    },
  ];

  // ---- ชิ้นที่ใช้ซ้ำในขั้น merged / compact ----
  const docTypeChip = (row: Transaction) => {
    const config = DOC_TYPE_CONFIG[row.inventory_doc_type];
    return (
      <StatusDotBadge tone={config?.tone ?? "neutral"} size="sm">
        {config?.label ?? row.inventory_doc_type}
      </StatusDotBadge>
    );
  };
  const qtyTotals = (row: Transaction) => ({
    in: row.details.reduce((sum, d) => sum + d.qty_in, 0),
    out: row.details.reduce((sum, d) => sum + d.qty_out, 0),
  });
  const qtyText = (row: Transaction) => {
    const q = qtyTotals(row);
    if (q.in === 0 && q.out === 0) return <span>-</span>;
    return (
      <span className="tabular-nums">
        {q.in > 0 && <span className="text-success-ink">+{q.in}</span>}
        {q.in > 0 && q.out > 0 && " "}
        {q.out > 0 && <span className="text-destructive">−{q.out}</span>}
      </span>
    );
  };
  const columnById = (id: string) =>
    dataColumns.find(
      (c) => (c.id ?? ("accessorKey" in c ? String(c.accessorKey) : "")) === id,
    )!;

  // ขั้น merged: ชนิด + วันที่รวมเข้าคอลัมน์เอกสาร · เข้า/ออกรวมเป็นคอลัมน์จำนวน
  // id คอลัมน์เอกสารคงเดิม (parent_document_no) — การเรียงของผู้ใช้ไม่หลุด
  const mergedDocColumn: ColumnDef<Transaction> = {
    ...columnById("parent_document_no"),
    cell: ({ row }) => (
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          {docTypeChip(row.original)}
          <span className="truncate whitespace-nowrap">
            {row.original.parent_document_no ?? "-"}
          </span>
        </div>
        <span className="text-muted-foreground block text-xs tabular-nums">
          {formatDate(row.original.audit.created.at, dateFormat)}
        </span>
      </div>
    ),
    size: 220,
  };
  const mergedQtyColumn: ColumnDef<Transaction> = {
    id: "qty",
    header: tfl("qty"),
    cell: ({ row }) => qtyText(row.original),
    meta: {
      skeleton: columnSkeletons.text,
      cellClassName: "text-right whitespace-nowrap",
      headerClassName: "text-right",
    },
    size: 90,
  };

  // ขั้น compact: เซลล์เดียว — ชนิด เลขที่ · ยอดรวม / สินค้า · จำนวน / วันที่ · คลัง
  const compactColumn: ColumnDef<Transaction> = {
    id: "compact",
    header: t("parentDocNo"),
    cell: ({ row }) => {
      const it = row.original;
      const products = joinDetailNames(it.details, (d) => d.product?.name);
      const locations = joinDetailNames(it.details, (d) => d.location?.name);
      const total = it.details.reduce((sum, d) => sum + d.total_cost, 0);
      return (
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            {docTypeChip(it)}
            <span className="min-w-0 flex-1 truncate">
              {it.parent_document_no ?? "-"}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {formatAmount(total, amountFormat)}
              {defaultCurrencyCode && (
                <span className="text-muted-foreground ms-1 text-xs font-normal">
                  {defaultCurrencyCode}
                </span>
              )}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className="min-w-0 flex-1 truncate"
              title={products || undefined}
            >
              {products || "-"}
            </span>
            <span className="shrink-0 text-xs">{qtyText(it)}</span>
          </div>
          <div
            className="text-muted-foreground truncate text-xs"
            title={locations || undefined}
          >
            {[formatDate(it.audit.created.at, dateFormat), locations]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      );
    },
    enableSorting: false,
  };

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น
  const visibleDataColumns: ColumnDef<Transaction>[] = merged
    ? [
        mergedDocColumn,
        columnById("product"),
        mergedQtyColumn,
        columnById("total_cost"),
      ]
    : dataColumns.filter((c) => {
        const key =
          c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
        if (key === "location") return showLocation;
        if (key === "items_count") return showItems;
        return true;
      });

  const allColumns: ColumnDef<Transaction>[] = [
    indexColumn<Transaction>(params),
    ...(compact ? [compactColumn] : visibleDataColumns),
  ];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
