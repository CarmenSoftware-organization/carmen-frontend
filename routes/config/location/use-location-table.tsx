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
import { CircleCheck, CircleX } from "lucide-react";
import type { Location } from "@/types/location";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { LocationTypeLabel } from "@/components/share/location-type-label";
import { useCostCenter } from "@/hooks/use-cost-center";

interface UseLocationTableOptions {
  data: Location[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (location: Location) => void;
  onDelete: (location: Location) => void;
}

export function useLocationTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseLocationTableOptions) {
  const tfl = useTranslations("field");
  const tl = useTranslations("config.location");
  const { dateTimeFormat } = useProfile();
  // cost center ของ location เป็นค่า default ของหน้า Chart of Account Mapping —
  // โชว์ในตารางเพื่อให้เห็นว่าคลังไหนยังไม่ผูกโดยไม่ต้องเปิดทีละคลัง
  const { data: costCenters } = useCostCenter({ perpage: 100 });
  const costCenterById = new Map(
    (costCenters?.data ?? []).map((c) => [c.id, c] as const),
  );
  const columns: ColumnDef<Location>[] = [
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
      size: 100,
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
      size: 240,
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },

    {
      accessorKey: "location_type",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("locationType")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => (
        <LocationTypeLabel type={row.original.location_type} />
      ),
      size: 120,
      meta: {
        headerTitle: tfl("locationType"),
        cellClassName: "text-center",
        skeleton: columnSkeletons.badge,
      },
    },
    {
      id: "physical_count_type",
      header: tfl("physicalCount"),
      // data-slot: DataGridTable ใส่ line-clamp-2 (display:-webkit-box) ให้ลูกทุกตัวที่ไม่มี
      // data-slot ซึ่งทับ flex/mx-auto — ไอคอนเลยไปชิดซ้ายของคอลัมน์
      cell: ({ row }) => (
        <div data-slot="cell-icon" className="flex justify-center">
          {row.original.physical_count_type === "yes" ? (
            <CircleCheck
              className="text-positive-ink size-4"
              aria-label="Yes"
            />
          ) : (
            <CircleX
              className="text-muted-foreground/50 size-4"
              aria-label="No"
            />
          )}
        </div>
      ),
      size: 110,
      meta: {
        headerTitle: tfl("physicalCount"),
        cellClassName: "text-center",
        headerClassName: "text-center",
        skeleton: columnSkeletons.checkbox,
      },
    },
    {
      id: "delivery_point",
      header: tfl("deliveryPoint"),
      cell: ({ row }) => (
        <span>{row.original.delivery_point?.name ?? "-"}</span>
      ),
      size: 150,
      meta: {
        headerTitle: tfl("deliveryPoint"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      id: "cost_center",
      header: tfl("costCenter"),
      cell: ({ row }) => {
        const id = row.original.cost_center_id;
        if (!id) {
          return (
            <span className="text-warning-ink">
              {tl("costCenterUnassigned")}
            </span>
          );
        }
        const cc = costCenterById.get(id);
        return <span>{cc ? `${cc.code} · ${cc.name}` : "—"}</span>;
      },
      size: 180,
      meta: {
        headerTitle: tfl("costCenter"),
        skeleton: columnSkeletons.text,
      },
    },
    statusColumn<Location>(),
    ...auditColumns<Location>(tfl, dateTimeFormat),
  ];

  return useConfigTable<Location>({
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
