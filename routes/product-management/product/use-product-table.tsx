import { useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  actionColumn,
  auditColumns,
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import type { Product } from "@/types/product";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { getProductStatusLabel } from "@/constant/product-status";

const truncCell = (value: string) =>
  value ? (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="block truncate">{value}</span>
      </TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  ) : (
    <span className="block truncate">{value}</span>
  );

interface UseProductTableOptions {
  products: Product[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (product: Product) => void;
  onDelete: (product: Product) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดของกล่องกว้าง */
  containerWidth?: number;
}

/**
 * ขนาดคอลัมน์และคอลัมน์ที่ต้องซ่อน ตามความกว้างของกล่องตาราง (ไม่ใช่จอ — sidebar พับ/กางได้)
 * กล่อง ≥ 1500: Status (คอลัมน์ข้อมูลตัวสุดท้าย) ยืด ที่เหลือกว้างคงที่ รหัส ชื่อ หน่วย หมวด
 * จึงอยู่ติดกันทางซ้าย — เดิมแบ่งตามสัดส่วน ที่ 4K ชื่อกว้าง 1,303px หน่วยห่างจากชื่อเป็นพันพิกเซล
 * 1050–1500: หมวดยืด (ชื่อกับหน่วยยังติดกัน ที่ว่างไปอยู่หลังเส้นทางหมวดซึ่งยาวและถูกตัดบ่อยสุด)
 * ต่ำกว่านั้น (ไม่มีหมวด): ชื่อยืด ให้ชื่อที่ถูกตัดได้ใช้ที่เหลือ ไม่ใช่ Status
 *
 * ผลรวม `size` นับ select (55, ไม่ได้เรนเดอร์) + # (60) + ปุ่มแถว (60) = 175 ด้วย
 * และต้องน้อยกว่าจุดสลับขั้นของตัวเอง ไม่งั้นตารางล้นกล่อง:
 *   ≥ 1500  175 + 150 + 520 + 90 + 380 + 110 = 1425   (Full HD 1638 · 4K)
 *   ≥ 1050  175 + 120 + 300 + 70 + 280 + 100 = 1045   (HD 1084)
 *   ≥ 780   175 + 120 + 300 + 70 +  —  + 100 =  765   ซ่อนหมวด
 *   <  780  175 + 120 + 240 +  — +  —  + 100 =  635   ซ่อนหมวด + หน่วย (tablet 662)
 * ที่ซ่อนยังดูได้จากหน้ารายการสินค้าและมุมมองการ์ด
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  if (w >= 1500)
    return {
      code: 150,
      name: 520,
      unit: 90,
      category: 380,
      status: 110,
      grow: "status" as const,
    };
  if (w >= 1050)
    return {
      code: 120,
      name: 300,
      unit: 70,
      category: 280,
      status: 100,
      grow: "category" as const,
    };
  if (w >= 780)
    return {
      code: 120,
      name: 300,
      unit: 70,
      category: 0,
      status: 100,
      grow: "name" as const,
    };
  return {
    code: 120,
    name: 240,
    unit: 0,
    category: 0,
    status: 100,
    grow: "name" as const,
  };
}

export function useProductTable({
  products,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseProductTableOptions) {
  "use no memo";
  const sizes = columnTier(containerWidth);
  // ที่ผู้ใช้เลือกจากเมนูคอลัมน์ — คุมเองเพราะต้องรวมกับคอลัมน์ที่กล่องแคบบังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    local_name: false,
    product_category_name: false,
    product_sub_category_name: false,
    product_item_group_name: false,
    created_at: false,
    updated_at: false,
  });

  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const { dateTimeFormat } = useProfile();
  const deleteGate = useDeleteGate();

  const dataColumns: ColumnDef<Product>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      // รหัสเป็นลิงก์เปิดรายการ (/product-management/product/:id) และเป็นลิงก์เดียว
      // ของแถว — ชื่อเป็นข้อความธรรมดา (เดิมทั้งสองคอลัมน์เป็นลิงก์สีน้ำเงิน แย่งสายตา
      // กันทุกแถว) · tabular-nums ให้ตัวเลขกว้างเท่ากัน ไล่อ่านเทียบรหัสลงแนวตั้งได้
      cell: ({ row }) => (
        <CellAction
          onClick={() => onEdit(row.original)}
          className="tabular-nums"
        >
          {row.original.code}
        </CellAction>
      ),
      size: sizes.code,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.text },
    },
    {
      id: "name",
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // ชื่อไทยซ้อนใต้ชื่อในเซลล์เดียว — เดิมเป็นคอลัมน์แยกที่จอกว้างถูกยืดห่างกัน
      // จนต้องกวาดตาข้ามจอเพื่อจับคู่ชื่อสองภาษา (คอลัมน์ local_name ยังอยู่ แค่ซ่อน
      // ไว้เป็นค่าเริ่มต้น สำหรับคนที่อยากเรียงตามชื่อไทย)
      cell: ({ row }) => {
        const name = row.original.name || "...";
        const localName = row.original.local_name;
        return (
          <div className="min-w-0">
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="block truncate font-medium">{name}</span>
              </TooltipTrigger>
              <TooltipContent>{name}</TooltipContent>
            </Tooltip>
            {localName && (
              <span className="text-muted-foreground block truncate text-xs">
                {localName}
              </span>
            )}
          </div>
        );
      },
      size: sizes.name,
      meta: {
        headerTitle: tfl("name"),
        skeleton: columnSkeletons.textShort,
        grow: sizes.grow === "name",
      },
    },
    {
      accessorKey: "local_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("localName")} />
      ),
      cell: ({ row }) => truncCell(row.original.local_name ?? ""),
      size: 300,
      meta: { headerTitle: tfl("localName"), skeleton: columnSkeletons.text },
    },
    {
      id: "inventory_unit_name",
      accessorFn: (row) => row.inventory_unit?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("unit")} />
      ),
      size: sizes.unit || 70,
      meta: { headerTitle: tfl("unit"), skeleton: columnSkeletons.textShort },
    },
    {
      // หมวดสามระดับรวมเป็นเส้นทางเดียว รูปเดียวกับการ์ด (pd-card) — Item Group
      // เจาะจงที่สุดจึงเป็นตัวเข้ม ระดับบนจาง · สามคอลัมน์เดิมยังเปิดได้จากเมนูคอลัมน์
      id: "category_path",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("category")} />
      ),
      cell: ({ row }) => {
        const path = [
          row.original.product_category?.name,
          row.original.product_sub_category?.name,
          row.original.product_item_group?.name,
        ].filter((n): n is string => Boolean(n));
        if (path.length === 0) return null;
        const leaf = path.at(-1);
        const parents = path.slice(0, -1);
        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="block truncate">
                {parents.length > 0 && (
                  <span className="text-muted-foreground">
                    {parents.join(" › ")} ›{" "}
                  </span>
                )}
                {leaf}
              </span>
            </TooltipTrigger>
            <TooltipContent>{path.join(" › ")}</TooltipContent>
          </Tooltip>
        );
      },
      enableSorting: false,
      size: sizes.category || 240,
      meta: {
        headerTitle: tfl("categoryPath"),
        skeleton: columnSkeletons.text,
        grow: sizes.grow === "category",
      },
    },
    {
      id: "product_category_name",
      accessorFn: (row) => row.product_category?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("category")} />
      ),
      cell: ({ row }) => truncCell(row.original.product_category?.name ?? ""),
      enableSorting: false,
      meta: { headerTitle: tfl("category"), skeleton: columnSkeletons.text },
    },
    {
      id: "product_sub_category_name",
      accessorFn: (row) => row.product_sub_category?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("subCategory")} />
      ),
      cell: ({ row }) =>
        truncCell(row.original.product_sub_category?.name ?? ""),
      enableSorting: false,
      meta: { headerTitle: tfl("subCategory"), skeleton: columnSkeletons.text },
    },
    {
      id: "product_item_group_name",
      accessorFn: (row) => row.product_item_group?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("itemGroup")} />
      ),
      cell: ({ row }) => truncCell(row.original.product_item_group?.name ?? ""),
      enableSorting: false,
      meta: { headerTitle: tfl("itemGroup"), skeleton: columnSkeletons.text },
    },
    {
      id: "product_status_type",
      accessorKey: "product_status_type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("product_status_type");
        return (
          <StatusDotBadge
            size="sm"
            tone={status === "active" ? "success" : "neutral"}
          >
            {getProductStatusLabel(ts, status)}
          </StatusDotBadge>
        );
      },
      size: sizes.status,
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
        grow: sizes.grow === "status",
      },
    },
    ...auditColumns<Product>(tfl, dateTimeFormat),
  ];

  const allColumns: ColumnDef<Product>[] = [
    selectColumn<Product>(),
    indexColumn<Product>(params),
    ...dataColumns,
    actionColumn<Product>(onDelete, {
      ...deleteGate,
      activity: { id: (r) => r.id, label: (r) => r.code },
    }),
  ];

  return useReactTable({
    data: products,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    onColumnVisibilityChange: setUserVisibility,
    state: {
      ...tableConfig.state,
      // กล่องแคบบังคับซ่อนทับที่ผู้ใช้เลือก (ซ่อนด้วย CSS ไม่ได้ — ตารางที่มีคอลัมน์ยืดคำนวณ
      // ความกว้างขั้นต่ำจากทุกคอลัมน์ที่ TanStack ถือว่ามองเห็น)
      columnVisibility: {
        ...userVisibility,
        ...(sizes.category === 0 && { category_path: false }),
        ...(sizes.unit === 0 && { inventory_unit_name: false }),
      },
    },
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
