import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
} from "@/components/ui/data-grid/columns";
import { Badge } from "@/components/ui/badge";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import {
  getAdjustmentType,
  type InventoryAdjustment,
  type InventoryAdjustmentStatus,
} from "@/types/inventory-adjustment";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { formatAmount } from "@/lib/currency-utils";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  IA_STATUS_CONFIG,
  IA_TYPE_CONFIG,
  IA_TYPE_ICON,
  IA_TYPE_ICON_COLOR,
  IA_TYPE_SIGN,
} from "@/constant/inventory-adjustment";
import { cn } from "@/lib/utils";

interface UseInventoryAdjustmentTableOptions {
  items: InventoryAdjustment[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: InventoryAdjustment) => void;
  onDelete: (item: InventoryAdjustment) => void;
}

export function useInventoryAdjustmentTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseInventoryAdjustmentTableOptions) {
  const { dateFormat, amountFormat, dateTimeFormat, defaultCurrencyCode } =
    useProfile();
  const tfl = useTranslations("field");

  const columns: ColumnDef<InventoryAdjustment>[] = [
    {
      id: "document_no",
      accessorFn: (row) => row.si_no ?? row.so_no ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("adjustment")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.si_no ?? row.original.so_no}
        </CellAction>
      ),
      size: 160,
      meta: {
        headerTitle: tfl("adjustment"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      id: "date",
      accessorFn: (row) => row.si_date ?? row.so_date ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("date")}
          className="justify-center"
        />
      ),
      cell: ({ row }) =>
        formatDate(
          row.original.si_date ?? row.original.so_date ?? "",
          dateFormat,
        ),
      size: 110,
      meta: {
        headerTitle: tfl("date"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
      },
    },
    {
      id: "type",
      header: tfl("type"),
      cell: ({ row }) => {
        const type = getAdjustmentType(row.original);
        const config = IA_TYPE_CONFIG[type];
        const Icon = IA_TYPE_ICON[type];
        return (
          // data-standard-chip: ขอออกจากกฎย่อ badge ในตารางเหลือ 8px (globals.css)
          // ทิศทางคือข้อมูลหลักของแถว ต้องอ่านออกที่ขนาดปกติ
          <Badge data-standard-chip="" size="sm" className={config?.className}>
            {Icon && (
              <Icon className={IA_TYPE_ICON_COLOR[type]} aria-hidden="true" />
            )}
            {type === "stock-in" ? tfl("stockIn") : tfl("stockOut")}
          </Badge>
        );
      },
      size: 130,
      meta: {
        headerTitle: tfl("type"),
        skeleton: columnSkeletons.badge,
        cellClassName: "text-center",
        headerClassName: "text-center",
      },
    },
    {
      accessorKey: "location_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("location")} />
      ),
      enableSorting: false,
      size: 130,
      meta: { headerTitle: tfl("location"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "adjustment_type_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("reason")} />
      ),
      enableSorting: false,
      size: 180,
      meta: { headerTitle: tfl("reason"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "item_count",
      header: tfl("items"),
      size: 70,
      meta: {
        headerTitle: tfl("items"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right tabular-nums",
        headerClassName: "text-right",
      },
    },
    {
      accessorKey: "doc_status",
      header: tfl("status"),
      enableSorting: false,
      cell: ({ row }) => {
        const status = row.getValue("doc_status") as InventoryAdjustmentStatus;
        const config = IA_STATUS_CONFIG[status];
        return (
          <StatusIconLabel
            status={status}
            label={config?.label ?? status}
            className="flex w-full justify-center"
          />
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
        cellClassName: "text-center",
        headerClassName: "text-center",
      },
    },
    {
      accessorKey: "base_total_cost",
      header: tfl("total"),
      cell: ({ row }) => {
        // ทิศทางอยู่ที่ตัวเลขเอง (+ เข้า / − ออก) ไม่ต้องเหลือบกลับไปดูคอลัมน์ Type
        // ยอด 0 (ร่างที่ยังไม่มีต้นทุน) ไม่ใส่เครื่องหมาย ไม่ลงสี
        const type = getAdjustmentType(row.original);
        const total = Number(row.original.base_total_cost) || 0;
        return (
          <p
            className={cn(
              "font-medium tabular-nums",
              total !== 0 && IA_TYPE_ICON_COLOR[type],
            )}
          >
            {total !== 0 && IA_TYPE_SIGN[type]}
            {formatAmount(row.original.base_total_cost, amountFormat)}
            {defaultCurrencyCode && (
              <span className="text-muted-foreground ms-1 text-xs font-normal">
                {defaultCurrencyCode}
              </span>
            )}
          </p>
        );
      },
      size: 140,
      meta: {
        headerTitle: tfl("total"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
        headerClassName: "text-right",
      },
    },
    ...auditColumns<InventoryAdjustment>(tfl, dateTimeFormat),
  ];

  return useConfigTable<InventoryAdjustment>({
    data: items,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    activity: { id: (r) => r.id, label: (r) => r.si_no ?? r.so_no },
  });
}
