import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { Badge } from "@/components/ui/badge";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { Vendor } from "@/types/vendor";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseVendorTableOptions {
  vendors: Vendor[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (vendor: Vendor) => void;
  onDelete: (vendor: Vendor) => void;
}

export function useVendorTable({
  vendors,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseVendorTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  const columns: ColumnDef<Vendor>[] = [
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
      size: 200,
    },

    {
      id: "business_type_names",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("businessType")} />
      ),
      accessorFn: (row) =>
        row.business_type?.map((bt) => bt.name).join(", ") ?? "",
      cell: ({ row }) => {
        const types = row.original.business_type ?? [];
        if (types.length === 0) return null;
        return (
          <div className="flex flex-wrap gap-1">
            {types.map((bt) => (
              <Badge key={bt.id} variant="outline">
                {bt.name}
              </Badge>
            ))}
          </div>
        );
      },
      enableSorting: false,
      meta: {
        headerTitle: tfl("businessType"),
        skeleton: columnSkeletons.text,
      },
    },
    // status column แทรกเองก่อน created/updated (useConfigTable ส่ง hideStatus)
    statusColumn<Vendor>(tfl),
    ...auditColumns<Vendor>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Vendor>({
    data: vendors,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    // คอลัมน์ audit ซ่อนเป็น default (เปิดได้จากเมนู Toggle Columns)
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    activity: { id: (r) => r.id, label: (r) => r.code },
  });
}
