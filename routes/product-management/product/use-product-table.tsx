import type { ColumnDef } from "@tanstack/react-table";
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
}

export function useProductTable({
  products,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseProductTableOptions) {
  "use no memo";

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
      // รหัสเป็นข้อความเฉย ๆ ไม่ใช่ลิงก์ — ลิงก์เปิดรายการมีที่เดียวคือคอลัมน์ Name
      // (เดิมทั้งสองคอลัมน์เป็นลิงก์สีน้ำเงิน แย่งสายตากันทุกแถว) · tabular-nums
      // ให้ตัวเลขกว้างเท่ากัน ไล่อ่านเทียบรหัสลงแนวตั้งได้
      cell: ({ row }) => (
        <span className="text-muted-foreground tabular-nums">
          {row.original.code}
        </span>
      ),
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
                <CellAction
                  onClick={() => onEdit(row.original)}
                  className="block w-full truncate"
                >
                  {name}
                </CellAction>
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
      size: 380,
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.textShort },
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
      size: 70,
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
      size: 260,
      meta: {
        headerTitle: tfl("categoryPath"),
        skeleton: columnSkeletons.text,
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
        <DataGridColumnHeader
          column={column}
          title={tfl("status")}
          className="justify-center"
        />
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
      size: 100,
      meta: {
        headerTitle: tfl("status"),
        cellClassName: "text-center",
        skeleton: columnSkeletons.badge,
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
    initialState: {
      columnVisibility: {
        local_name: false,
        product_category_name: false,
        product_sub_category_name: false,
        product_item_group_name: false,
        created_at: false,
        updated_at: false,
      },
    },
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
