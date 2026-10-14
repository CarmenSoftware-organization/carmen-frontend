import { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  type ColumnDef,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import type { Report } from "@/types/report";

interface UseReportTableOptions {
  reports: Report[];
  onSelect?: (report: Report) => void;
  tableConfig?: ReturnType<typeof useDataGridState>["tableConfig"];
  pageCount?: number;
}

export function useReportTable({
  reports,
  onSelect,
  tableConfig,
  pageCount,
}: UseReportTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const columns: ColumnDef<Report>[] = useMemo(
    () => [
      {
        id: "index",
        header: "#",
        size: 50,
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">{row.index + 1}</span>
        ),
        meta: { skeleton: columnSkeletons.number },
      },
      {
        accessorKey: "ReportName",
        // DataGridTable แปลง size เป็น % ของผลรวม — ไม่ตั้ง = 150 เท่า Type แล้ว
        // คอลัมน์ # (50) กินไป ~14% ของตาราง
        size: 800,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("name")} />
        ),
        // คำอธิบายอยู่ใต้ชื่อในช่องเดียวกัน (เหมือนการ์ดโหมด grid) — แยกคอลัมน์แล้ว
        // ตาต้องกระโดดข้ามช่อง Name ที่กว้างเกินชื่อไปมาก
        cell: ({ row }) => (
          <div className="flex min-w-0 flex-col gap-0.5 py-0.5">
            <button
              type="button"
              className="text-primary self-start text-left text-xs font-semibold hover:underline focus-visible:outline-none"
              onClick={(e) => {
                (e.currentTarget as HTMLButtonElement).blur();
                onSelect?.(row.original);
              }}
            >
              {row.original.ReportName}
            </button>
            {row.original.Description && (
              <p
                className="text-muted-foreground line-clamp-2 text-xs leading-relaxed whitespace-normal"
                title={row.original.Description}
              >
                {row.original.Description}
              </p>
            )}
          </div>
        ),
        meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
      },
      {
        accessorKey: "ReportGroup",
        size: 160,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("type")} />
        ),
        cell: ({ row }) => (
          <span className="text-xs">{row.getValue("ReportGroup")}</span>
        ),
        meta: { headerTitle: tfl("type"), skeleton: columnSkeletons.textShort },
      },
    ],
    [tfl, onSelect],
  );

  return useReactTable({
    data: reports,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount,
  });
}
