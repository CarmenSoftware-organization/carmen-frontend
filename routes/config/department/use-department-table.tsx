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
import type { Department } from "@/types/department";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseDepartmentTableOptions {
  data: Department[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (department: Department) => void;
  onDelete: (department: Department) => void;
}

/**
 * Hook สำหรับสร้าง TanStack Table สำหรับ Department พร้อมคอลัมน์ code, name,
 * account_code (sortable ทุกคอลัมน์ — backend เรียงตาม column จริงของ tb_department)
 *
 * ใช้ภายใน `DepartmentComponent` โดยส่งผ่าน prop `useTable` ของ
 * `ConfigListTemplate`
 *
 * @param options - data, totalRecords, params, tableConfig, onEdit, onDelete
 * @returns TanStack table instance
 * @example
 * ```tsx
 * <ConfigListTemplate useTable={useDepartmentTable} ... />
 * ```
 */
export function useDepartmentTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseDepartmentTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<Department>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.code}
        </CellAction>
      ),
      size: 40,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
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
      accessorKey: "account_code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("accountCode")} />
      ),
      cell: ({ row }) => row.original.account_code || "-",
      size: 40,
      meta: {
        headerTitle: tfl("accountCode"),
        skeleton: columnSkeletons.textShort,
      },
    },
    statusColumn<Department>(tfl),
    ...auditColumns<Department>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Department>({
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
    activity: { id: (r) => r.id, label: (r) => r.code },
  });
}
