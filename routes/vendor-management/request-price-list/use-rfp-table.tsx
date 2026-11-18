import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { RequestPriceList } from "@/types/request-price-list";
import { RfpResponses, RfpWindowBadge } from "./rfp-list-cells";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseRequestPriceListTableOptions {
  items: RequestPriceList[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: RequestPriceList) => void;
  onDelete: (item: RequestPriceList) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * ชื่อรับที่เหลือ (`meta.grow`) คอลัมน์อื่นกว้างคงที่ — เดิมไม่ได้ตั้ง size เลย ทุกคอลัมน์ได้ 150
 * แล้วแบ่งสัดส่วน บน Full HD กว้างคอลัมน์ละ 376px ส่วนที่ tablet ช่วงวันที่ถูกตัดกลางวันที่
 * ความกว้างขั้นต่ำของตาราง = ผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *   ครบ                55+48+170+180+200+120+60 = 833
 *   ไม่มีแม่แบบ                                 = 653  (กล่องที่จอ 768 = 662)
 * ชื่อขั้นต่ำ 170 (ไม่ใช่ 180) เพื่อให้ `#` พอในกล่อง tablet — ชื่อยาวตัดด้วย … อยู่แล้ว
 * `#` แสดงตลอดทุกขั้น (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน) — ไม่อยู่ในขั้นที่ซ่อน
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 35px — คอลัมน์รองกลับมาเมื่อชื่อได้ที่ ~215px แล้วเท่านั้น
 * ของที่ซ่อนยังเห็น: ชื่อแม่แบบย้ายลงบรรทัดรองใต้ชื่อ
 * คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (created, updated) ไม่นับในงบ — เกินกล่องก็เลื่อนแนวนอนในกรอบเอง
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showTemplate: w >= 870,
  };
}

export function useRequestPriceListTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseRequestPriceListTableOptions) {
  "use no memo";
  const { dateFormat, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");
  const { showTemplate } = columnTier(containerWidth);

  const formatPeriod = (startDate: string, endDate: string): string => {
    const from = formatDate(startDate, dateFormat);
    const to = formatDate(endDate, dateFormat);
    if (!from && !to) return "—";
    return `${from} - ${to}`;
  };

  const columns: ColumnDef<RequestPriceList>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // กล่องแคบ: แม่แบบที่ถูกซ่อนลงมาเป็นบรรทัดรองใต้ชื่อ
      cell: ({ row }) => {
        const template = showTemplate
          ? undefined
          : row.original.pricelist_template?.name;
        return (
          <div className="min-w-0">
            <CellAction
              onClick={() => onEdit(row.original)}
              className="block truncate"
            >
              {row.original.name || "..."}
            </CellAction>
            {template && (
              <span
                className="text-muted-foreground block truncate text-xs"
                title={template}
              >
                {template}
              </span>
            )}
          </div>
        );
      },
      size: 170,
      meta: {
        headerTitle: tfl("name"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      id: "template_name",
      accessorFn: (row) => row.pricelist_template?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("template")} />
      ),
      enableSorting: false,
      cell: ({ getValue }) => (
        <span
          className="text-muted-foreground block truncate"
          title={getValue<string>()}
        >
          {getValue<string>()}
        </span>
      ),
      size: 180,
      meta: { headerTitle: tfl("template"), skeleton: columnSkeletons.text },
    },
    {
      // id เป็นชื่อคอลัมน์จริงใน DB เพื่อให้ sort ฝั่ง server ได้ (เรียงช่วงเวลา = เรียงวันเริ่ม)
      id: "start_date",
      accessorFn: (row) => formatPeriod(row.start_date, row.end_date),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("effectivePeriod")} />
      ),
      cell: ({ row, getValue }) => (
        <div
          data-slot="cell-stack"
          className="flex flex-col items-start gap-0.5"
        >
          <span className="whitespace-nowrap tabular-nums">
            {getValue<string>()}
          </span>
          <RfpWindowBadge item={row.original} size="sm" />
        </div>
      ),
      size: 200,
      meta: {
        headerTitle: tfl("effectivePeriod"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      // id คงเดิม (vendor_count) ไม่ให้ค่าซ่อน/แสดงคอลัมน์ที่ผู้ใช้เคยตั้งไว้หลุด
      id: "vendor_count",
      accessorFn: (row) => row.vendor_count,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("responses")} />
      ),
      cell: ({ row }) => <RfpResponses item={row.original} />,
      enableSorting: false,
      meta: {
        headerTitle: tfl("responses"),
        skeleton: columnSkeletons.textShort,
      },
      size: 120,
    },
    ...auditColumns<RequestPriceList>(tfl, dateTimeFormat),
  ];

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น · ตัดออกจากรายการเลย เมนู Toggle Columns ของผู้ใช้จึงไม่ถูกทับ
  const visibleColumns = showTemplate
    ? columns
    : columns.filter((c) => c.id !== "template_name");

  return useConfigTable<RequestPriceList>({
    data: items,
    columns: visibleColumns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    // คอลัมน์ audit ซ่อนเป็น default (เปิดได้จากเมนู Toggle Columns)
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
