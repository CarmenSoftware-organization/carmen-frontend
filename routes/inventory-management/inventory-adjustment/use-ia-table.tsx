import { useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { Package } from "lucide-react";
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
import { StatusChip } from "@/components/ui/status-chip";
import {
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
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "เหตุผล" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ · ไม่นับ audit ที่ซ่อนเป็น default):
 *   ครบ  55+48+140+110+130+130+130+70+135+140+60 = 1148
 *   ไม่มีจำนวนรายการ (ลงบรรทัดรองใต้ยอดรวม)        = 1078  (กล่องที่ 1366 เมนูกาง = 1085)
 *   ไม่มีคลัง (ลงบรรทัดรองใต้เหตุผล)               =  948
 *   ไม่มีวันที่ (ลงบรรทัดรองใต้เลขที่)              =  838
 *   ไม่มีชนิด (ไอคอนเข้า/ออกไปอยู่หน้าเลขที่)        =  708  (กล่องที่ 1024 เมนูกาง = 742)
 *   ไม่มีคอลัมน์สถานะ (ชิปลงใต้เหตุผล)              =  573  (กล่องที่จอ 768 = 662)
 * จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showItems: w >= 1153,
    showLocation: w >= 1083,
    showDate: w >= 953,
    showType: w >= 843,
    showStatus: w >= 713,
  };
}

function IaStatusChip({
  status,
}: {
  readonly status: InventoryAdjustmentStatus;
}) {
  // ป้ายแปลตามภาษา (namespace status) — IA_STATUS_CONFIG เป็นค่าคงที่ ป้ายในนั้นเป็นอังกฤษเสมอ
  const ts = useTranslations("status");
  return <StatusChip status={status} label={ts(status)} />;
}

export function useInventoryAdjustmentTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseInventoryAdjustmentTableOptions) {
  "use no memo";
  const { showItems, showLocation, showDate, showType, showStatus } =
    columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — audit ซ่อนเป็น default
  // ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    created_at: false,
    updated_at: false,
  });
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
      // คอลัมน์ชนิด/วันที่ถูกซ่อนในกล่องแคบ — ไอคอนเข้า/ออกไปอยู่หน้าเลขที่ วันที่ลงบรรทัดรอง
      cell: ({ row }) => {
        const type = getAdjustmentType(row.original);
        const Icon = IA_TYPE_ICON[type];
        const no = (
          <CellAction
            onClick={() => onEdit(row.original)}
            className="whitespace-nowrap"
          >
            {row.original.si_no ?? row.original.so_no}
          </CellAction>
        );
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            {showType ? (
              no
            ) : (
              <span
                className="flex items-center gap-1.5"
                title={type === "stock-in" ? tfl("stockIn") : tfl("stockOut")}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "size-3.5 shrink-0",
                      IA_TYPE_ICON_COLOR[type],
                    )}
                    aria-hidden="true"
                  />
                )}
                {no}
              </span>
            )}
            {!showDate && (
              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatDate(
                  row.original.si_date ?? row.original.so_date ?? "",
                  dateFormat,
                )}
              </span>
            )}
          </div>
        );
      },
      // เลขที่ + ไอคอนชนิด (~115px) + padding
      size: 140,
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
        cellClassName: "text-center whitespace-nowrap tabular-nums",
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
          <Badge
            data-standard-chip=""
            size="sm"
            className={cn("whitespace-nowrap", config?.className)}
          >
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
      },
    },
    {
      accessorKey: "location_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("location")} />
      ),
      enableSorting: false,
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.location_name || undefined}
        >
          {row.original.location_name}
        </span>
      ),
      size: 130,
      meta: { headerTitle: tfl("location"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "adjustment_type_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("reason")} />
      ),
      enableSorting: false,
      // คอลัมน์ข้อความยาว — รับที่เหลือ · คลัง/สถานะที่ถูกซ่อนลงเป็นบรรทัดรอง
      cell: ({ row }) => (
        <div
          data-slot="cell-stack"
          className="flex min-w-0 flex-col items-start"
        >
          <span
            className="block max-w-full truncate"
            title={row.original.adjustment_type_name || undefined}
          >
            {row.original.adjustment_type_name}
          </span>
          {!showLocation && row.original.location_name && (
            <span
              className="text-muted-foreground block max-w-full truncate text-xs"
              title={row.original.location_name}
            >
              {row.original.location_name}
            </span>
          )}
          {!showStatus && <IaStatusChip status={row.original.doc_status} />}
        </div>
      ),
      size: 130,
      meta: {
        headerTitle: tfl("reason"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
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
      cell: ({ row }) => <IaStatusChip status={row.original.doc_status} />,
      // กว้างพอให้ COMPLETED ไม่ถูกตัด
      size: 135,
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
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
          <div data-slot="cell-stack" className="flex flex-col items-end">
            <p
              className={cn(
                "font-medium whitespace-nowrap tabular-nums",
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
            {/* คอลัมน์จำนวนรายการถูกซ่อนในกล่องแคบ — ลงเป็นบรรทัดรองแบบไอคอน */}
            {!showItems && row.original.item_count != null && (
              <span
                className="text-muted-foreground flex items-center gap-1 text-xs tabular-nums"
                title={tfl("items")}
              >
                <Package className="size-3" aria-hidden="true" />
                {row.original.item_count}
              </span>
            )}
          </div>
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

  // ส่งเป็นตัวแปร (ไม่ใช่ literal) — type ของ tableConfig ประกาศ state แค่ pagination/sorting
  const responsiveTableConfig = {
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showItems && { item_count: false }),
        ...(!showLocation && { location_name: false }),
        ...(!showDate && { date: false }),
        ...(!showType && { type: false }),
        ...(!showStatus && { doc_status: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
  };

  return useConfigTable<InventoryAdjustment>({
    data: items,
    columns,
    totalRecords,
    params,
    tableConfig: responsiveTableConfig,
    onDelete,
    hideStatus: true,
    activity: { id: (r) => r.id, label: (r) => r.si_no ?? r.so_no },
  });
}
