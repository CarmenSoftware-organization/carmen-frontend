import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigListTable } from "../shared/use-config-list-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { CostCenter } from "@/types/cost-center";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { useTranslations } from "use-intl";

interface UseCostCenterTableOptions {
  containerWidth?: number;
  data: CostCenter[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (costCenter: CostCenter) => void;
  onDelete: (costCenter: CostCenter) => void;
}

export function useCostCenterTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseCostCenterTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<CostCenter>[] = [
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
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      id: "cost_center_group",
      accessorFn: (r) =>
        r.cost_center_group_code
          ? `${r.cost_center_group_code} · ${r.cost_center_group_name ?? ""}`
          : "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("costCenterGroup")} />
      ),
      enableSorting: false,
      meta: {
        headerTitle: tfl("costCenterGroup"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      meta: { headerTitle: tfl("description"), skeleton: columnSkeletons.text },
    },
    statusColumn<CostCenter>(tfl),
    ...auditColumns<CostCenter>(tfl, dateTimeFormat),
  ];

  return useConfigListTable<CostCenter>({
    containerWidth,
    // name 270 = ชื่อจริงยาวสุด ~241px + padding 24 — 150 เดิมทำชื่อขึ้นสองบรรทัดแล้วโดนตัด
    // ทั้งที่ description ว่าง · ชุดเต็ม 55+60+100+270+180+150+100+60 = 975 (พอที่กล่อง 1366 = 1085)
    // ตัด group แล้ว 795 · กล่องแคบกว่านั้นกลับไปแบ่งตามสัดส่วน
    layout: {
      grow: "description",
      widths: {
        code: 100,
        name: 270,
        description: 150,
        cost_center_group: 180,
      },
      secondary: ["cost_center_group"],
    },
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
    activity: { id: (r) => r.id, label: (r) => `${r.code} · ${r.name}` },
  });
}
