import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  indexColumn,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getSpotCheckMethodLabel } from "@/constant/spot-check-method";
import type { SpotCheck, SpotCheckStatus } from "@/types/spot-check";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { METHOD_VISUAL } from "./sc-status-visual";

interface UseScHistoryTableOptions {
  items: SpotCheck[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onOpen: (sc: SpotCheck) => void;
}

// `void` ของ spot check คือ `voided` ในชุดไอคอนกลาง — ไม่แปลงจะได้ขีดของ FALLBACK
const statusIconKey = (s: SpotCheckStatus) => (s === "void" ? "voided" : s);

export function useScHistoryTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onOpen,
}: UseScHistoryTableOptions) {
  "use no memo";
  const t = useTranslations("inventoryManagement.spotCheck");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const { dateFormat } = useProfile();
  const isMobile = useIsMobile() === true;

  const renderStatus = (sc: SpotCheck, className: string) => (
    <StatusIconLabel
      status={statusIconKey(sc.doc_status)}
      label={ts(sc.doc_status)}
      className={className}
    />
  );

  // วิธีสุ่มไม่มีสี — เป็นคุณสมบัติของใบ ไม่ใช่ความคืบหน้า (แนวเดียวกับคอลัมน์ชนิดใบของ GRN)
  const renderMethod = (sc: SpotCheck) => {
    const Icon = (METHOD_VISUAL[sc.method] ?? METHOD_VISUAL.random).icon;
    return (
      // กล่อง clamp ของ DataGrid บังคับลูกที่ไม่มี data-slot เป็น flow-root —
      // ไม่ใส่ไอคอนจะตกไปอยู่บรรทัดบน
      <span
        data-slot="sc-method"
        className="text-muted-foreground flex min-w-0 items-center gap-1.5"
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">
          {getSpotCheckMethodLabel(t, sc.method)}
        </span>
      </span>
    );
  };

  const dataColumns: ColumnDef<SpotCheck>[] = [
    {
      accessorKey: "spot_check_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("spotCheckNo")} />
      ),
      cell: ({ row }) => (
        <CellAction
          onClick={() => onOpen(row.original)}
          className="whitespace-nowrap"
        >
          {row.original.spot_check_no}
        </CellAction>
      ),
      size: 170,
      meta: { headerTitle: tfl("spotCheckNo") },
    },
    {
      id: "location",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("location")} />
      ),
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.location_name}>
          <span className="text-muted-foreground mr-1.5">
            {row.original.location_code}
          </span>
          {row.original.location_name}
        </span>
      ),
      // backend เรียงได้เฉพาะคอลัมน์ของตารางตัวเอง — ชื่อคลังมาจาก join
      enableSorting: false,
      size: 220,
      meta: { headerTitle: tfl("location"), skeleton: columnSkeletons.text },
    },
    {
      id: "method",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("method")} />
      ),
      cell: ({ row }) => renderMethod(row.original),
      enableSorting: false,
      size: 130,
      meta: { headerTitle: tfl("method"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "start_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("startDate")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => formatDate(row.original.start_date, dateFormat),
      size: 120,
      meta: {
        headerTitle: tfl("startDate"),
        cellClassName: "text-center whitespace-nowrap tabular-nums",
      },
    },
    {
      accessorKey: "end_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("endDate")}
          className="justify-center"
        />
      ),
      // ยังไม่ปิดใบ = ไม่มีวันจบ — ขีดจาง ๆ ให้ช่องว่างไม่ดูเหมือนข้อมูลหาย
      cell: ({ row }) =>
        row.original.end_date ? (
          formatDate(row.original.end_date, dateFormat)
        ) : (
          <span className="text-muted-foreground/60">—</span>
        ),
      size: 120,
      meta: {
        headerTitle: tfl("endDate"),
        cellClassName: "text-center whitespace-nowrap tabular-nums",
      },
    },
    {
      accessorKey: "size",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("items")}
          className="justify-end"
        />
      ),
      enableSorting: false,
      size: 80,
      meta: {
        headerTitle: tfl("items"),
        // หัวที่เรียงไม่ได้เป็น inline-flex — justify-* ไม่มีผล ต้องจัดที่ตัวเซลล์หัว
        headerClassName: "text-right",
        cellClassName: "text-right tabular-nums",
        skeleton: columnSkeletons.number,
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
      // สีมาจากไอคอนอย่างเดียว ข้อความจาง — แบบเดียวกับคอลัมน์สถานะของ GRN
      cell: ({ row }) =>
        renderStatus(
          row.original,
          "text-muted-foreground flex w-full justify-center [&_svg]:text-current!",
        ),
      enableSorting: false,
      size: 130,
      meta: {
        headerTitle: tfl("status"),
        headerClassName: "text-center",
        cellClassName: "text-center",
        skeleton: columnSkeletons.badge,
      },
    },
  ];

  // จอเล็กเหลือเซลล์เดียวสองบรรทัด: เลขใบ · สถานะ / คลัง · วิธี · วันเริ่ม · จำนวน
  const compactColumn: ColumnDef<SpotCheck> = {
    id: "compact",
    header: tfl("spotCheckNo"),
    cell: ({ row }) => {
      const sc = row.original;
      return (
        <div className="min-w-0 space-y-0.5">
          <div className="flex items-center gap-2">
            <CellAction onClick={() => onOpen(sc)} className="min-w-0 truncate">
              {sc.spot_check_no}
            </CellAction>
            {renderStatus(
              sc,
              // สีเดียวกับคอลัมน์สถานะบนจอใหญ่ — ไอคอนรับสีจากข้อความ
              "text-muted-foreground ml-auto shrink-0 [&_svg]:text-current!",
            )}
          </div>
          <div className="text-muted-foreground text-micro flex min-w-0 items-center gap-1.5">
            <span className="min-w-0 truncate">{sc.location_name}</span>
            <span aria-hidden="true">·</span>
            <span className="shrink-0">
              {getSpotCheckMethodLabel(t, sc.method)}
            </span>
            <span className="ml-auto shrink-0 tabular-nums">
              {formatDate(sc.start_date, dateFormat)} ·{" "}
              {t("historyItemCount", { count: sc.size })}
            </span>
          </div>
        </div>
      );
    },
    enableSorting: false,
  };

  const allColumns: ColumnDef<SpotCheck>[] = isMobile
    ? [compactColumn]
    : [indexColumn<SpotCheck>(params), ...dataColumns];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
