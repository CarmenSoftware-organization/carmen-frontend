import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  selectColumn,
  indexColumn,
  actionColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import type { User } from "@/types/workflows";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseUserTableOptions {
  users: User[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (user: User) => void;
  onDelete: (user: User) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ขนาดของกล่องกว้าง */
  containerWidth?: number;
}

/**
 * ขนาดคอลัมน์ตามความกว้างของกล่องตาราง — ชื่อกับอีเมลกว้างคงที่ แผนก (คอลัมน์ข้อมูลตัวสุดท้าย)
 * รับที่เหลือ เดิมสามคอลัมน์แบ่งเท่ากัน บนจอ 4K แต่ละคอลัมน์กว้าง 1,029px
 *
 * ตารางกว้างขั้นต่ำเท่าผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 * กล่องกว้าง 55+60+240+280+200+60 = 895 · กล่องแคบ 55+60+180+190+115+60 = 660
 * (กล่องที่จอ 768 = 662) ชุดกว้างจึงใช้ได้ตั้งแต่กล่อง 900px ขึ้นไป
 */
function columnSizes(width: number | undefined) {
  return (width ?? Number.POSITIVE_INFINITY) >= 900
    ? { name: 240, email: 280, department: 200 }
    : { name: 180, email: 190, department: 115 };
}

export function useUserTable({
  users,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseUserTableOptions) {
  "use no memo";
  const tfl = useTranslations("field");
  const deleteGate = useDeleteGate();
  const sizes = columnSizes(containerWidth);

  const columns: ColumnDef<User>[] = [
    selectColumn<User>(),
    indexColumn<User>(params),
    {
      accessorKey: "firstname",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.firstname} {row.original.lastname}
        </CellAction>
      ),
      size: sizes.name,
    },
    {
      accessorKey: "email",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("email")} />
      ),
      // อีเมลไม่มีจุดตัดคำ — ยาวเกินคอลัมน์ให้ตัดด้วย … และดูเต็มได้จาก title
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.email}>
          {row.original.email}
        </span>
      ),
      size: sizes.email,
    },
    {
      id: "department",
      accessorFn: (row) =>
        row.department?.code
          ? `${row.department.code} — ${row.department.name}`
          : (row.department?.name ?? ""),
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("department")} />
      ),
      size: sizes.department,
      meta: { grow: true },
    },
    actionColumn<User>(onDelete, deleteGate),
  ];

  return useReactTable({
    data: users,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (params.perpage as number)),
  });
}
