import { useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { StatusBadge } from "@/components/ui/status-badge";
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
  /** ความกว้างกล่องตาราง (px) — undefined = ยังไม่ได้วัด ใช้ชุดคอลัมน์กว้างสุด */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "ชื่อ" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ + # 48 + ปุ่มแถว 60 = 163 · ไม่นับ capacity/audit ที่ซ่อนเป็น default):
 *   ครบ  163+110+200+150+120+120+120+135+160+100 = 1378
 *   ไม่มีสถานะ (Inactive ลงบรรทัดรองใต้ชื่อ)           = 1278
 *   ไม่มี Station (ลงบรรทัดรองใต้ชื่อ)                 = 1158  (กล่องที่ 1366 เมนูกาง = 1085)
 *   ไม่มี Brand/Model (Brand Model ลงบรรทัดรอง)        =  918
 *   ไม่มีหมวด (ลงบรรทัดรอง)                           =  768
 *   แคบสุด: ไม่มี Availability (`2 / 2` ลงใต้รหัส) · code 100 · ชื่อขั้นต่ำ 140 = 563
 *     (1024 เมนูกาง = 742 · จอ 768 = 662)
 * Availability 135 = หัว "Available / Total" 108 + padding · Maintenance 160 = ป้าย
 * "Overdue 264 days" 128 + padding — แคบกว่านี้หัวทับกัน/ป้ายถูกตัด
 * จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showStatus: w >= 1383,
    showStation: w >= 1283,
    showBrandModel: w >= 1163,
    showCategory: w >= 923,
    showAvailability: w >= 773,
  };
}

export function useEquipmentTable({
  equipments,
  categories,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseEquipmentTableOptions) {
  "use no memo";
  const {
    showStatus,
    showStation,
    showBrandModel,
    showCategory,
    showAvailability,
  } = columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  // capacity ส่วนใหญ่ว่าง — ซ่อนไว้ เปิดได้จากเมนูคอลัมน์
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    capacity: false,
    created_at: false,
    updated_at: false,
  });
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
        <div data-slot="cell-stack" className="flex min-w-0 flex-col">
          <CellAction onClick={() => onEdit(row.original)}>
            {row.getValue("code")}
          </CellAction>
          {/* คอลัมน์ Availability ถูกซ่อนในกล่องแคบ — จำนวนลงมาใต้รหัส */}
          {!showAvailability && (
            <EqAvailability
              available={row.original.available_qty}
              total={row.original.total_qty}
              className="text-xs"
            />
          )}
        </div>
      ),
      size: showAvailability ? 110 : 100,
      meta: {
        headerTitle: tfl("code"),
        cellClassName: "whitespace-nowrap",
      },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // คอลัมน์ที่ถูกซ่อนในกล่องแคบลงมาเป็นบรรทัดรองใต้ชื่อ — ข้อมูลไม่หายไปจากแถว
      cell: ({ row }) => {
        const r = row.original;
        const secondary = [
          !showCategory && r.category_id ? categories.get(r.category_id) : null,
          !showBrandModel
            ? [r.brand, r.model].filter(Boolean).join(" ") || null
            : null,
          !showStation ? r.station : null,
        ].filter((v): v is string => !!v);
        const inactive = !showStatus && !r.is_active;
        return (
          <div data-slot="cell-stack" className="flex min-w-0 flex-col">
            <span className="block truncate" title={r.name}>
              {r.name}
            </span>
            {(secondary.length > 0 || inactive) && (
              <span className="flex min-w-0 items-center gap-2">
                {secondary.length > 0 && (
                  <span
                    className="text-muted-foreground block truncate text-xs"
                    title={secondary.join(" · ")}
                  >
                    {secondary.join(" · ")}
                  </span>
                )}
                {inactive && <StatusBadge active={false} />}
              </span>
            )}
          </div>
        );
      },
      // ชื่อยาวได้ — รับที่เหลือ · size = ขั้นต่ำ
      size: showAvailability ? 200 : 140,
      meta: { headerTitle: tfl("name"), grow: true },
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
      size: 150,
      meta: {
        headerTitle: tfl("category"),
        cellClassName: "truncate",
      },
    },
    {
      accessorKey: "brand",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("brand")} />
      ),
      size: 120,
      meta: { headerTitle: tfl("brand"), cellClassName: "truncate" },
    },
    {
      accessorKey: "model",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("model")} />
      ),
      size: 120,
      meta: { headerTitle: tfl("model"), cellClassName: "truncate" },
    },
    {
      accessorKey: "station",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("station")} />
      ),
      size: 120,
      meta: { headerTitle: tfl("station"), cellClassName: "truncate" },
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
      size: 135,
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
      size: 160,
      meta: { headerTitle: t("maintenance") },
    },
    // Status ก่อน created/updated (hideStatus:true กัน useConfigTable inject ซ้ำ)
    statusColumn<Equipment>(tfl),
    ...auditColumns<Equipment>(tfl, dateTimeFormat),
  ];

  // ส่งเป็นตัวแปร (ไม่ใช่ literal) — type ของ tableConfig ประกาศ state แค่ pagination/sorting
  const responsiveTableConfig = {
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showStatus && { is_active: false }),
        ...(!showStation && { station: false }),
        ...(!showBrandModel && { brand: false, model: false }),
        ...(!showCategory && { category_id: false }),
        ...(!showAvailability && { available_qty: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
  };

  return useConfigTable<Equipment>({
    data: equipments,
    columns,
    totalRecords,
    params,
    tableConfig: responsiveTableConfig,
    onDelete,
    hideStatus: true,
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
