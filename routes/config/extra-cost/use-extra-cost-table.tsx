import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigListTable } from "../shared/use-config-list-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { ExtraCost } from "@/types/extra-cost";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseExtraCostTableOptions {
  containerWidth?: number;
  data: ExtraCost[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (extraCost: ExtraCost) => void;
  onDelete: (extraCost: ExtraCost) => void;
}

export function useExtraCostTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseExtraCostTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<ExtraCost>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction
          className="block max-w-full truncate"
          title={row.original.name}
          onClick={() => onEdit(row.original)}
        >
          {row.getValue("name") || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    // ชิดซ้ายทั้งสองโหมด — ป้ายที่จัดกึ่งกลางในคอลัมน์กว้างจะลอยห่างจากชื่อครึ่งคอลัมน์
    statusColumn<ExtraCost>(tfl),
    ...auditColumns<ExtraCost>(tfl, dateTimeFormat),
  ];

  // tablet budget: select 55 + index 60 + actions 60 + name 320 + status 100 = 595 ≤ 662

  return useConfigListTable<ExtraCost>({
    containerWidth,
    layout: { grow: "is_active", widths: { name: 320 } },
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
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
