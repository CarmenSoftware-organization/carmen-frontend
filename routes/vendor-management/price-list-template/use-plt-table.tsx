import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  actionColumn,
  auditColumns,
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import type { PriceListTemplate } from "@/types/price-list-template";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UsePriceListTemplateTableOptions {
  templates: PriceListTemplate[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (template: PriceListTemplate) => void;
  onDelete: (template: PriceListTemplate) => void;
}

export function usePriceListTemplateTable({
  templates,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UsePriceListTemplateTableOptions) {
  "use no memo";
  const { dateTimeFormat } = useProfile();
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const deleteGate = useDeleteGate();

  const dataColumns: ColumnDef<PriceListTemplate>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // คำอธิบายซ้อนใต้ชื่อเฉพาะใบที่กรอก — template ชื่อสั้นคล้ายกันหลายใบ
      // คำอธิบายคือสิ่งที่แยกว่าใบไหนส่งให้ใคร
      cell: ({ row }) => {
        const description = row.original.description?.trim();
        return (
          <div className="min-w-0">
            <CellAction
              onClick={() => onEdit(row.original)}
              className="block truncate"
            >
              {row.getValue("name") || "..."}
            </CellAction>
            {description && (
              <span
                className="text-muted-foreground block truncate text-xs"
                title={description}
              >
                {description}
              </span>
            )}
          </div>
        );
      },
      size: 360,
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      // จำนวนสินค้าในแม่แบบ — ใบที่ยังว่างส่งขอราคาไม่ได้ จึงต้องเห็นจากหน้ารายการ
      // ไม่เรียงลำดับเพราะ backend ไม่มีคอลัมน์นับ
      id: "product_count",
      accessorFn: (row) => row.products?.length ?? 0,
      header: () => <span className="block text-right">{tfl("products")}</span>,
      cell: ({ row }) => {
        const count = row.original.products?.length ?? 0;
        if (count === 0) {
          return <span className="text-warning-ink">{t("noProducts")}</span>;
        }
        return (
          <span className="tabular-nums">{t("productsCount", { count })}</span>
        );
      },
      size: 130,
      enableSorting: false,
      meta: {
        headerTitle: tfl("products"),
        cellClassName: "text-right whitespace-nowrap",
        skeleton: columnSkeletons.textShort,
      },
    },
    {
      id: "currency_code",
      accessorFn: (row) => row.currency?.code ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("currency")}
          className="justify-center"
        />
      ),
      size: 100,
      meta: {
        headerTitle: tfl("currency"),
        cellClassName: "text-center",
        headerClassName: "text-center",
        skeleton: columnSkeletons.textShort,
      },
    },
    {
      accessorKey: "validity_period",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("validityPeriod")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const val = row.getValue<number | null>("validity_period");
        return val === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          t("validityDays", { count: val })
        );
      },
      size: 140,
      meta: {
        headerTitle: tfl("validityPeriod"),
        cellClassName: "text-right whitespace-nowrap tabular-nums",
        skeleton: columnSkeletons.textShort,
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("status")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("status");
        const labelMap: Record<string, string> = {
          draft: ts("draft"),
          active: ts("active"),
          inactive: ts("inactive"),
        };
        return (
          <StatusIconLabel
            status={status}
            label={labelMap[status] ?? status}
            // คอลัมน์นี้จัดกลาง — label เป็น inline-flex ซึ่ง text-center ของเซลล์
            // เอื้อมไม่ถึงเมื่ออยู่ในกล่อง clamp ของ DataGrid
            className="flex w-full justify-center uppercase"
          />
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("status"),
        cellClassName: "text-center",
        headerClassName: "text-center",
        skeleton: columnSkeletons.badge,
      },
    },
    ...auditColumns<PriceListTemplate>(tfl, dateTimeFormat),
  ];

  const allColumns: ColumnDef<PriceListTemplate>[] = [
    selectColumn<PriceListTemplate>(),
    indexColumn<PriceListTemplate>(params),
    ...dataColumns,
    actionColumn<PriceListTemplate>(onDelete, {
      ...deleteGate,
      activity: { id: (r) => r.id, label: (r) => r.name },
    }),
  ];

  return useReactTable({
    data: templates,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    // คอลัมน์ audit ซ่อนเป็น default (เปิดได้จากเมนู Toggle Columns)
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
