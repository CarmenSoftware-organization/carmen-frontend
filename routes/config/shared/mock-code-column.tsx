import type { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "@/components/ui/cell-action";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import type { MockConfigRow } from "./mock-config-list";

/** คอลัมน์ code ที่กดแล้วเปิด dialog แก้ไข — เหมือนคอลัมน์ชื่อของหน้า config มาตรฐาน */
export function mockCodeColumn<T extends MockConfigRow>(
  title: string,
  onEdit: (item: T) => void,
): ColumnDef<T> {
  return {
    accessorKey: "code",
    header: ({ column }) => (
      <DataGridColumnHeader column={column} title={title} />
    ),
    cell: ({ row }) => (
      <CellAction onClick={() => onEdit(row.original)}>
        {row.original.code}
      </CellAction>
    ),
    meta: { headerTitle: title, skeleton: columnSkeletons.text },
  };
}
