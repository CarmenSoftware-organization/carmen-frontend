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
}

export function useRequestPriceListTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseRequestPriceListTableOptions) {
  "use no memo";
  const { dateFormat, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");

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
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.name || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      id: "template_name",
      accessorFn: (row) => row.pricelist_template?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("template")} />
      ),
      enableSorting: false,
      cell: ({ getValue }) => (
        <span className="text-muted-foreground">{getValue<string>()}</span>
      ),
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
          <span className="tabular-nums">{getValue<string>()}</span>
          <RfpWindowBadge item={row.original} />
        </div>
      ),
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

  return useConfigTable<RequestPriceList>({
    data: items,
    columns,
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
