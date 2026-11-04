import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { CellAction } from "@/components/ui/cell-action";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { ParamsDto } from "@/types/params";
import type { ApInvoice } from "@/types/accounts-payable";
import { apSettlement } from "../shared/ap-status";
import { ApFromGrnBadge, ApSettlementBadge } from "./ap-invoice-badges";

interface UseApInvoiceTableOptions {
  invoices: ApInvoice[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onOpen: (invoice: ApInvoice) => void;
}

/**
 * ตารางหน้า list AP invoice — id ของคอลัมน์ที่เรียงได้ตรงชื่อ field ใน
 * `tb_ap_invoice` เพราะส่งเป็น `sort=<id>:<dir>` ตรง ๆ · คอลัมน์ derive
 * (settlement) และ vendor ไม่เปิดให้เรียง
 */
export function useApInvoiceTable({
  invoices,
  totalRecords,
  params,
  tableConfig,
  onOpen,
}: UseApInvoiceTableOptions) {
  const t = useTranslations("accounting.accountsPayable.invoice");
  const tfl = useTranslations("field");
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();

  const money = (value: string, currency: string) => (
    <span className="whitespace-nowrap tabular-nums">
      {formatAmount(Number(value))} {currency}
    </span>
  );

  const columns: ColumnDef<ApInvoice>[] = [
    {
      accessorKey: "doc_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("docNo")} />
      ),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <CellAction onClick={() => onOpen(row.original)}>
            {row.original.doc_no}
          </CellAction>
          <ApFromGrnBadge invoice={row.original} />
        </div>
      ),
      size: 220,
      enableHiding: false,
      meta: { headerTitle: t("docNo"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "doc_date",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("docDate")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap tabular-nums">
          {formatDate(row.original.doc_date, dateFormat)}
        </span>
      ),
      size: 110,
      meta: { headerTitle: t("docDate"), skeleton: columnSkeletons.text },
    },
    {
      id: "vendor",
      accessorFn: (row) => row.vendor_name,
      header: t("vendor"),
      cell: ({ row }) => (
        <span
          className="block max-w-56 truncate"
          title={row.original.vendor_name}
        >
          {row.original.vendor_name}
        </span>
      ),
      size: 220,
      enableSorting: false,
      meta: { headerTitle: t("vendor"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "vendor_invoice_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("vendorInvoiceNo")} />
      ),
      size: 160,
      meta: {
        headerTitle: t("vendorInvoiceNo"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "doc_type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("docType")} />
      ),
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {t(`docTypes.${row.original.doc_type}`)}
        </span>
      ),
      size: 120,
      meta: { headerTitle: t("docType"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "total_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("total")}
          className="justify-end"
        />
      ),
      cell: ({ row }) =>
        money(row.original.total_amount, row.original.currency_code),
      size: 150,
      meta: {
        headerTitle: t("total"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    {
      accessorKey: "outstanding_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("outstanding")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => (
        <span className="font-medium">
          {money(row.original.outstanding_amount, row.original.currency_code)}
        </span>
      ),
      size: 150,
      meta: {
        headerTitle: t("outstanding"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
      },
    },
    {
      id: "settlement",
      accessorFn: (row) => apSettlement(row),
      header: t("settlement"),
      cell: ({ row }) => <ApSettlementBadge invoice={row.original} />,
      size: 130,
      enableSorting: false,
      meta: { headerTitle: t("settlement"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "doc_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      cell: ({ row }) => (
        <StatusIconLabel
          status={row.original.doc_status}
          label={t(`statuses.${row.original.doc_status}`)}
        />
      ),
      size: 130,
      meta: { headerTitle: tfl("status"), skeleton: columnSkeletons.text },
    },
  ];

  return useConfigTable<ApInvoice>({
    data: invoices,
    columns,
    totalRecords,
    params,
    tableConfig,
    hideStatus: true,
  });
}
