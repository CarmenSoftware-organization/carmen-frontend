import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { StatusChip } from "@/components/ui/status-chip";
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
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * ชื่อรับที่เหลือ (`meta.grow`) คอลัมน์อื่นกว้างคงที่ — เดิมแบ่งสัดส่วน บน Full HD สกุลเงินกว้าง
 * 173px สถานะ 208px ห่างจากค่าของมันเองโดยไม่จำเป็น ส่วนที่ tablet หัว Currency ทับ Validity Period
 * ความกว้างขั้นต่ำของตาราง = ผลรวม `size` ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *   ครบ                     55+60+200+120+110+150+120+60 = 875
 *   ไม่มีเลขลำดับ                                          = 815
 *   ไม่มีสกุลเงิน/ระยะเวลามีผล                               = 555  (กล่องที่จอ 768 = 662)
 * จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม 35px — คอลัมน์รองกลับมาเมื่อชื่อได้ที่ ~235px แล้วเท่านั้น
 * ของที่ซ่อนยังเห็น: สกุลเงิน · ระยะเวลามีผล ย้ายลงบรรทัดรองใต้ชื่อ
 * คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (created, updated) ไม่นับในงบ — เกินกล่องก็เลื่อนแนวนอนในกรอบเอง
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showIndex: w >= 910,
    showTerms: w >= 850,
  };
}

export function usePriceListTemplateTable({
  templates,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UsePriceListTemplateTableOptions) {
  "use no memo";
  const { dateTimeFormat } = useProfile();
  const t = useTranslations("vendorManagement.priceListTemplate");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const deleteGate = useDeleteGate();
  const { showIndex, showTerms } = columnTier(containerWidth);

  const dataColumns: ColumnDef<PriceListTemplate>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      // คำอธิบายซ้อนใต้ชื่อเฉพาะใบที่กรอก — template ชื่อสั้นคล้ายกันหลายใบ
      // คำอธิบายคือสิ่งที่แยกว่าใบไหนส่งให้ใคร
      // กล่องแคบ: สกุลเงิน · ระยะเวลามีผลที่ถูกซ่อนมาต่อหน้าคำอธิบายในบรรทัดเดียวกัน
      cell: ({ row }) => {
        const { currency, validity_period } = row.original;
        const description = [
          ...(showTerms
            ? []
            : [
                currency?.code,
                validity_period == null
                  ? undefined
                  : t("validityDays", { count: validity_period }),
              ]),
          row.original.description?.trim(),
        ]
          .filter(Boolean)
          .join(" · ");
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
      size: 200,
      meta: {
        headerTitle: tfl("name"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
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
      size: 120,
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
      size: 110,
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
      size: 150,
      meta: {
        headerTitle: tfl("validityPeriod"),
        cellClassName: "text-right whitespace-nowrap tabular-nums",
        skeleton: columnSkeletons.textShort,
      },
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("status");
        const labelMap: Record<string, string> = {
          draft: ts("draft"),
          active: ts("active"),
          inactive: ts("inactive"),
        };
        return (
          <StatusChip status={status} label={labelMap[status] ?? status} />
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
      },
    },
    ...auditColumns<PriceListTemplate>(tfl, dateTimeFormat),
  ];

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น · ตัดออกจากรายการเลย เมนู Toggle Columns ของผู้ใช้จึงไม่ถูกทับ
  const hidden = new Set(showTerms ? [] : ["currency_code", "validity_period"]);
  const visibleDataColumns = dataColumns.filter((c) => {
    const key =
      c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
    return !key || !hidden.has(key);
  });

  const allColumns: ColumnDef<PriceListTemplate>[] = [
    selectColumn<PriceListTemplate>(),
    ...(showIndex ? [indexColumn<PriceListTemplate>(params)] : []),
    ...visibleDataColumns,
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
