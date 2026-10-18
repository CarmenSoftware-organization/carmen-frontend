import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { auditColumns, statusColumn } from "@/components/ui/data-grid/columns";
import type { Equipment } from "@/types/equipment";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { EqMaintenanceBadge } from "./eq-maintenance-badge";
import { EqAvailability } from "./eq-availability";

interface UseEquipmentTableOptions {
  equipments: Equipment[];
  categories: Map<string, string>;
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (equipment: Equipment) => void;
  onDelete: (equipment: Equipment) => void;
}

export function useEquipmentTable({
  equipments,
  categories,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseEquipmentTableOptions) {
  const tfl = useTranslations("field");
  const t = useTranslations("operationPlan.equipment");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<Equipment>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("code")}
        </CellAction>
      ),
      size: 120,
      meta: { headerTitle: tfl("code") },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      meta: { headerTitle: tfl("name") },
    },
    {
      accessorKey: "category_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("category")} />
      ),
      cell: ({ row }) => {
        const categoryId = row.getValue("category_id") as string | null;
        return categoryId ? (categories.get(categoryId) ?? "—") : "—";
      },
      size: 160,
      meta: { headerTitle: tfl("category") },
    },
    {
      accessorKey: "brand",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("brand")} />
      ),
      size: 140,
      meta: { headerTitle: tfl("brand") },
    },
    {
      accessorKey: "model",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("model")} />
      ),
      size: 140,
      meta: { headerTitle: tfl("model") },
    },
    {
      accessorKey: "station",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("station")} />
      ),
      size: 140,
      meta: { headerTitle: tfl("station") },
    },
    {
      accessorKey: "capacity",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("capacity")} />
      ),
      size: 120,
      meta: { headerTitle: tfl("capacity") },
    },
    {
      // sort ตาม available_qty ฝั่ง server — คอลัมน์โชว์คู่กับ total
      accessorKey: "available_qty",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("availabilityCol")} />
      ),
      cell: ({ row }) => (
        <EqAvailability
          available={row.original.available_qty}
          total={row.original.total_qty}
        />
      ),
      size: 130,
      meta: { headerTitle: t("availabilityCol") },
    },
    {
      accessorKey: "next_maintenance_date",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("maintenance")} />
      ),
      cell: ({ row }) => (
        <EqMaintenanceBadge nextDate={row.original.next_maintenance_date} />
      ),
      size: 170,
      meta: { headerTitle: t("maintenance") },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<Equipment>(tfl),
    ...auditColumns<Equipment>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Equipment>({
    data: equipments,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      // capacity ส่วนใหญ่ว่าง — ซ่อนไว้ เปิดได้จากเมนูคอลัมน์
      columnVisibility: {
        capacity: false,
        created_at: false,
        updated_at: false,
      },
    },
  });
}
