import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { Shelf } from "@/types/shelf";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseShelfTableOptions {
  data: Shelf[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (shelf: Shelf) => void;
  onDelete: (shelf: Shelf) => void;
}

export function useShelfTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseShelfTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<Shelf>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("code") || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.text },
      size: 90,
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => row.getValue("name") || "...",
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      // ยาวเกิน 2 บรรทัดตัดด้วย ellipsis — ข้อความเต็มดูจาก title ตอน hover
      cell: ({ row }) => (
        <span
          className="text-muted-foreground line-clamp-2"
          title={row.original.description ?? undefined}
        >
          {row.original.description || "-"}
        </span>
      ),
      enableSorting: false,
      meta: { headerTitle: tfl("description"), skeleton: columnSkeletons.text },
    },
    statusColumn<Shelf>(tfl),
    ...auditColumns<Shelf>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Shelf>({
    data,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    // ยังไม่เปิด activity — shelf ไม่อยู่ใน activity-registry ของ backend
    // (backend ยังไม่มีโมดูลนี้เลย) เปิดไปเมนูจะกดแล้วว่างเปล่า
  });
}
