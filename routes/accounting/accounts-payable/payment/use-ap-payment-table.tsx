import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "@/components/ui/cell-action";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { StatusChip } from "@/components/ui/status-chip";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { ParamsDto } from "@/types/params";
import type { ApPayment } from "@/types/accounts-payable";

interface UseApPaymentTableOptions {
  payments: ApPayment[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onOpen: (payment: ApPayment) => void;
}

/**
 * ตารางหน้า list AP payment — id ของคอลัมน์ที่เรียงได้ตรงชื่อ field ใน
 * `tb_ap_payment` เพราะส่งเป็น `sort=<id>:<dir>` ตรง ๆ
 */
export function useApPaymentTable({
  payments,
  totalRecords,
  params,
  tableConfig,
  onOpen,
}: UseApPaymentTableOptions) {
  const t = useTranslations("accounting.accountsPayable.payment");
  const tfl = useTranslations("field");
  const ui = useTranslations("accounting.accountsPayable.ui");
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();

  const columns: ColumnDef<ApPayment>[] = [
    {
      accessorKey: "doc_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("docNo")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onOpen(row.original)}>
          {row.original.doc_no}
        </CellAction>
      ),
      size: 170,
      enableHiding: false,
      meta: { headerTitle: t("docNo"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "payment_date",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("paymentDate")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDate(row.original.payment_date, dateFormat)}
        </span>
      ),
      size: 120,
      meta: { headerTitle: t("paymentDate"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "vendor_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("vendor")} />
      ),
      cell: ({ row }) => (
        <span
          className="block max-w-56 truncate"
          title={row.original.vendor_name}
        >
          {row.original.vendor_name}
        </span>
      ),
      size: 220,
      meta: {
        headerTitle: t("vendor"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      accessorKey: "bank_account_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("bankAccount")} />
      ),
      cell: ({ row }) => (
        <span
          className="block max-w-56 truncate"
          title={row.original.bank_account_name}
        >
          {row.original.bank_account_code
            ? `${row.original.bank_account_code} · ${row.original.bank_account_name}`
            : row.original.bank_account_name}
        </span>
      ),
      size: 220,
      meta: { headerTitle: t("bankAccount"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "payment_method",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("method")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {t(`methods.${row.original.payment_method}`)}
        </span>
      ),
      size: 140,
      meta: { headerTitle: t("method"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "reference_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("referenceNo")} />
      ),
      cell: ({ row }) => row.original.reference_no || "—",
      size: 160,
      meta: { headerTitle: t("referenceNo"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "total_applied_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("detail.summary.applied")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatAmount(Number(row.original.total_applied_amount))}{" "}
          {row.original.currency_code}
        </span>
      ),
      size: 150,
      meta: {
        headerTitle: t("detail.summary.applied"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    {
      accessorKey: "total_wht_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("detail.summary.wht")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatAmount(Number(row.original.total_wht_amount))}{" "}
          {row.original.currency_code}
        </span>
      ),
      size: 150,
      meta: {
        headerTitle: t("detail.summary.wht"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    {
      accessorKey: "net_paid_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("netPaid")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <span className="font-medium whitespace-nowrap tabular-nums">
          {formatAmount(Number(row.original.net_paid_amount))}{" "}
          {row.original.currency_code}
        </span>
      ),
      size: 160,
      meta: {
        headerTitle: t("netPaid"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    {
      accessorKey: "doc_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => (
        <StatusChip
          status={row.original.doc_status}
          label={t(`statuses.${row.original.doc_status}`)}
        />
      ),
      size: 130,
      meta: { headerTitle: tfl("status"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "workflow_current_stage",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={ui("workflow")} />
      ),
      cell: ({ row }) => row.original.workflow_current_stage || "—",
      size: 160,
      meta: { headerTitle: ui("workflow"), skeleton: columnSkeletons.text },
    },
  ];

  return useConfigTable<ApPayment>({
    data: payments,
    columns,
    totalRecords,
    params,
    tableConfig: {
      ...tableConfig,
      ...{ getRowId: (payment: ApPayment) => payment.id },
    },
    hideStatus: true,
  });
}
