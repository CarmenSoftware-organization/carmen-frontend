import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { formatCurrency } from "@/lib/currency-utils";
import type { ParamsDto } from "@/types/params";
import type { JvTemplatePageKind } from "./jv-template-config";
import type { JvTemplate } from "./jv-template-types";
import {
  jvTemplateActiveLabel,
  jvTemplateAmount,
  jvTemplateAmountLabelKey,
  jvTemplatePeriodRange,
  jvTemplateTypeLabel,
} from "./jv-template-labels";

interface UseJvTemplateTableOptions {
  kind: JvTemplatePageKind;
  templates: JvTemplate[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onOpen: (template: JvTemplate) => void;
  /** ไม่ส่ง = ไม่มีคอลัมน์ลบ (ไม่มีสิทธิ์ / สัญญาเขียนไม่ได้) */
  onDelete?: (template: JvTemplate) => void;
}

/**
 * ตารางหน้า list template — ท่าเดียวกับ `useJvTable`
 * id ของคอลัมน์ที่เรียงได้ต้องตรงชื่อ field ของ backend (ส่งเป็น `sort=<id>:<dir>`)
 */
export function useJvTemplateTable({
  kind,
  templates,
  totalRecords,
  params,
  tableConfig,
  onOpen,
  onDelete,
}: UseJvTemplateTableOptions) {
  const t = useTranslations("accounting.jvTemplate");

  const columns: ColumnDef<JvTemplate>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onOpen(row.original)}>
          {row.original.code}
        </CellAction>
      ),
      size: 150,
      enableHiding: false,
      meta: { headerTitle: t("code"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("name")} />
      ),
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.name}>
          {row.original.name}
        </span>
      ),
      size: 260,
      meta: { headerTitle: t("name"), skeleton: columnSkeletons.text },
    },
    ...(kind === "all"
      ? [
          {
            accessorKey: "template_type",
            header: ({ column }) => (
              <DataGridColumnHeader column={column} title={t("type")} />
            ),
            cell: ({ row }) => (
              <span className="whitespace-nowrap">
                {jvTemplateTypeLabel(t, row.original.template_type)}
              </span>
            ),
            size: 120,
            meta: { headerTitle: t("type"), skeleton: columnSkeletons.text },
          } satisfies ColumnDef<JvTemplate>,
        ]
      : []),
    {
      accessorKey: "from_fiscal_year",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("periodRange")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {jvTemplatePeriodRange(row.original)}
        </span>
      ),
      size: 170,
      meta: { headerTitle: t("periodRange"), skeleton: columnSkeletons.text },
    },
    ...(kind !== "recurring"
      ? [
          {
            id: "amount",
            accessorFn: (row) => jvTemplateAmount(row),
            enableSorting: false,
            header: ({ column }) => (
              <DataGridColumnHeader
                column={column}
                title={t(jvTemplateAmountLabelKey(kind))}
                className="justify-end"
              />
            ),
            cell: ({ row }) => {
              const amount = jvTemplateAmount(row.original);
              return amount === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <span className="font-medium whitespace-nowrap tabular-nums">
                  {formatCurrency(amount)}
                </span>
              );
            },
            size: 140,
            meta: {
              headerTitle: t(jvTemplateAmountLabelKey(kind)),
              skeleton: columnSkeletons.text,
              cellClassName: "text-right",
            },
          } satisfies ColumnDef<JvTemplate>,
        ]
      : []),
    ...(kind !== "allocation"
      ? [
          {
            accessorKey: "frequency_months",
            header: ({ column }) => (
              <DataGridColumnHeader
                column={column}
                title={t("frequencyMonths")}
                className="justify-center"
              />
            ),
            cell: ({ row }) => (
              <span className="tabular-nums">
                {row.original.template_type === "recurring"
                  ? (row.original.frequency_months ?? "—")
                  : "—"}
              </span>
            ),
            size: 130,
            meta: {
              headerTitle: t("frequencyMonths"),
              skeleton: columnSkeletons.text,
              cellClassName: "text-center",
            },
          } satisfies ColumnDef<JvTemplate>,
        ]
      : []),
    {
      accessorKey: "is_active",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("active")} />
      ),
      cell: ({ row }) => (
        <StatusIconLabel
          status={row.original.is_active ? "active" : "inactive"}
          label={jvTemplateActiveLabel(t, row.original.is_active)}
        />
      ),
      size: 110,
      meta: { headerTitle: t("active"), skeleton: columnSkeletons.text },
    },
  ];

  return useConfigTable<JvTemplate>({
    data: templates,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
  });
}
