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
import { useProfile } from "@/hooks/use-profile";
import type { EcoLabel } from "@/types/eco-label";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseEcoLabelTableOptions {
  data: EcoLabel[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (ecoLabel: EcoLabel) => void;
  onDelete: (ecoLabel: EcoLabel) => void;
}

export function useEcoLabelTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseEcoLabelTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<EcoLabel>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          <span className="text-xs">{row.getValue("code")}</span>
        </CellAction>
      ),
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => <span>{row.getValue("name") || "..."}</span>,
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block max-w-96 truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description}
        </span>
      ),
      enableSorting: false,
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
      },
    },
    statusColumn<EcoLabel>(),
    ...auditColumns<EcoLabel>(tfl, dateTimeFormat),
  ];

  return useConfigTable<EcoLabel>({
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
  });
}
