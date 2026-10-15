import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { CreditTerm } from "@/types/credit-term";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { useTranslations } from "use-intl";

interface UseCreditTermTableOptions {
  data: CreditTerm[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (creditTerm: CreditTerm) => void;
  onDelete: (creditTerm: CreditTerm) => void;
}

export function useCreditTermTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseCreditTermTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<CreditTerm>[] = [
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
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "value",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("creditTermDays")}
          className="justify-end"
        />
      ),
      meta: {
        headerTitle: tfl("creditTermDays"),
        cellClassName: "text-right",
        skeleton: columnSkeletons.textShort,
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      meta: { headerTitle: tfl("description"), skeleton: columnSkeletons.text },
    },
    statusColumn<CreditTerm>(tfl),
    ...auditColumns<CreditTerm>(tfl, dateTimeFormat),
  ];

  return useConfigTable<CreditTerm>({
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
