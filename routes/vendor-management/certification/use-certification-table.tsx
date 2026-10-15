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
import type { Certification } from "@/types/certification";
import { CertificationHoldings } from "./certification-holdings";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseCertificationTableOptions {
  data: Certification[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (certification: Certification) => void;
  onDelete: (certification: Certification) => void;
}

export function useCertificationTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseCertificationTableOptions) {
  const tfl = useTranslations("field");
  const t = useTranslations("vendorManagement.certification");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<Certification>[] = [
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
        <span className="text-muted-foreground">
          {row.original.description || "—"}
        </span>
      ),
      enableSorting: false,
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      // นับฝั่ง server ต่อหน้า ไม่ใช่คอลัมน์ใน DB จึงเรียงไม่ได้
      id: "vendor_count",
      accessorFn: (row) => row.vendor_count,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("vendorsHolding")} />
      ),
      cell: ({ row }) => <CertificationHoldings item={row.original} />,
      enableSorting: false,
      meta: {
        headerTitle: t("vendorsHolding"),
        skeleton: columnSkeletons.textShort,
      },
    },
    statusColumn<Certification>(tfl),
    ...auditColumns<Certification>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Certification>({
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
