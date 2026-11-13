import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  selectColumn,
  indexColumn,
  actionColumn,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import type { Role } from "@/types/role";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseRoleTableOptions {
  items: Role[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: Role) => void;
  onDelete: (item: Role) => void;
}

export function useRoleTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseRoleTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const deleteGate = useDeleteGate();
  const dataColumns: ColumnDef<Role>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("name") || "..."}
        </CellAction>
      ),
      // กว้างคงที่ (คอลัมน์ถัดไปเป็นตัว grow) — ชื่อ role ยาวกว่านี้ตัดสองบรรทัดตามปกติของ DataGrid
      size: 280,
      meta: { skeleton: columnSkeletons.text },
    },
    {
      id: "permission_count",
      accessorFn: (row) => row.permissions?.count ?? 0,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("permissions")} />
      ),
      enableSorting: false,
      cell: ({ row }) => {
        const count = row.original.permissions?.count ?? 0;
        return `${count} permissions`;
      },
      // คอลัมน์ข้อมูลตัวสุดท้ายรับความกว้างที่เหลือ — `meta.grow` ทำให้คอลัมน์ชื่อกว้างคงที่ตาม
      // `size` ตารางนี้มีข้อมูลแค่ 2 คอลัมน์สั้น ๆ ถ้าปล่อยแบ่งตามสัดส่วน บนจอ 4K ชื่อ role กับ
      // จำนวนสิทธิ์จะห่างกันราว 1,450px เนื้อหาชิดซ้ายจึงยังอยู่ติดชื่อ (skill carmen-blue-ui-design)
      meta: { skeleton: columnSkeletons.textShort, grow: true },
    },
  ];

  const allColumns: ColumnDef<Role>[] = [
    selectColumn<Role>(),
    indexColumn<Role>(params),
    ...dataColumns,
    actionColumn<Role>(onDelete, deleteGate),
  ];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
