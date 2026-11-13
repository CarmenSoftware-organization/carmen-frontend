import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { StatusChip } from "@/components/ui/status-chip";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/currency-utils";
import type { ParamsDto } from "@/types/params";
import type { JournalVoucher } from "@/types/journal-voucher";
import { jvSourceLabel, jvStatusLabel } from "./jv-status";

interface UseJvTableOptions {
  journals: JournalVoucher[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (journal: JournalVoucher) => void;
  onDelete: (journal: JournalVoucher) => void;
}

function renderAmount(value: string | number) {
  const amount = Number(value);
  if (Number.isNaN(amount)) return <span>{value}</span>;
  return (
    <span className="font-medium whitespace-nowrap tabular-nums">
      {formatCurrency(amount)}
    </span>
  );
}

/**
 * ตารางหน้า list JV — ท่าเดียวกับ `usePoTable`
 *
 * id ของคอลัมน์ที่เรียงได้ต้องตรงชื่อ field ใน `tb_gl_jv_header` เพราะส่งไปเป็น
 * `sort=<id>:<dir>` ตรง ๆ — เลขที่จึงใช้ id `jv_no` แม้จะแสดง `display_no`
 * · ไม่มีคอลัมน์ audit / เมนู Activity: list ของ JV ไม่ส่ง `audit` มา และ
 * `tb_gl_jv_header` ไม่อยู่ใน activity registry ของ backend
 */
export function useJvTable({
  journals,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseJvTableOptions) {
  const t = useTranslations("accounting.journalVoucher");
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();

  const columns: ColumnDef<JournalVoucher>[] = [
    {
      id: "jv_no",
      accessorFn: (row) => row.display_no,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("jvNo")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.display_no}
        </CellAction>
      ),
      size: 170,
      enableHiding: false,
      meta: { headerTitle: t("jvNo"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "jv_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("jvDate")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDate(row.original.jv_date, dateFormat)}
        </span>
      ),
      size: 110,
      meta: {
        headerTitle: t("jvDate"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.description || undefined}
        >
          {row.original.description}
        </span>
      ),
      size: 280,
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      id: "source",
      accessorFn: (row) => row.source_type,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("source")} />
      ),
      cell: ({ row }) => (
        <span className="text-muted-foreground whitespace-nowrap">
          {jvSourceLabel(row.original.source_type)}
        </span>
      ),
      size: 110,
      meta: { headerTitle: t("source"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "jv_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => (
        <StatusChip
          status={row.original.jv_status}
          label={jvStatusLabel(row.original.jv_status)}
        />
      ),
      size: 120,
      meta: { headerTitle: tfl("status"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "total_debit",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("debit")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => renderAmount(row.original.total_debit),
      size: 130,
      meta: {
        headerTitle: t("debit"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    {
      accessorKey: "total_credit",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("credit")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => renderAmount(row.original.total_credit),
      size: 130,
      meta: {
        headerTitle: t("credit"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
  ];

  return useConfigTable<JournalVoucher>({
    data: journals,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    deleteDisabledTitle: (row) =>
      row.jv_status === "draft" ? undefined : t("deleteDraftOnly"),
  });
}
