import { Link } from "react-router";
import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Field, FieldLabel } from "@/components/ui/field";
import { useProfile } from "@/hooks/use-profile";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { formatDate } from "@/lib/date-utils";
import type {
  ApInvoice,
  ApInvoiceReference,
  ApInvoiceTax,
} from "@/types/accounts-payable";
import { ApDetailGrid } from "../shared/ap-detail-grid";
import { ApReadValue } from "../shared/ap-read-value";
import { addDecimal, subtractDecimal } from "../shared/ap-decimal";
import { useApInvoice } from "../shared/use-accounts-payable";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";

export function InvoiceTaxPanel({
  invoice,
}: {
  readonly invoice?: ApInvoice | null;
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const money = useAmountFormatter();
  const { dateFormat, defaultCurrencyCode } = useProfile();
  const tax = invoice?.tax;
  const base = invoice?.base_currency_code || defaultCurrencyCode || "—";
  const columns: ColumnDef<ApInvoiceTax>[] = [
    { id: "type", header: t("taxType"), cell: () => t("inputVat") },
    {
      accessorKey: "base_amount",
      header: `${t("netAmount")} (${base})`,
      cell: ({ row }) => money(Number(row.original.base_amount)),
    },
    {
      accessorKey: "vat_amount",
      header: `${t("taxAmount")} (${base})`,
      cell: ({ row }) => money(Number(row.original.vat_amount)),
    },
    {
      id: "total",
      header: `${t("total")} (${base})`,
      cell: ({ row }) =>
        money(
          Number(
            addDecimal([row.original.base_amount, row.original.vat_amount]),
          ),
        ),
    },
  ];
  return (
    <div className="space-y-4">
      {tax ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [t("taxInvoiceNo"), tax.tax_invoice_no],
            [t("taxInvoiceDate"), formatDate(tax.tax_invoice_date, dateFormat)],
            [t("taxStatus"), t(`taxStatuses.${tax.tax_status}`)],
            [t("claimExpiry"), formatDate(tax.expiry_claim_date, dateFormat)],
          ].map(([label, value]) => (
            <Field key={label}>
              <FieldLabel>{label}</FieldLabel>
              <ApReadValue>{value}</ApReadValue>
            </Field>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{t("taxAfterSubmit")}</p>
      )}
      <ApDetailGrid
        rows={tax ? [tax] : []}
        columns={columns}
        empty={t("noTaxInvoice")}
      />
    </div>
  );
}

function InvoiceReferenceRow({
  reference,
  currency,
}: {
  readonly reference: ApInvoiceReference;
  readonly currency: string;
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const invoiceText = useTranslations("accounting.accountsPayable.invoice");
  const query = useApInvoice(reference.ref_ap_invoice_id);
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  if (query.isLoading) return <Skeleton className="h-8" />;
  if (query.isError)
    return (
      <ErrorState error={query.error} onRetry={() => void query.refetch()} />
    );
  return (
    <div className="grid items-center gap-2 border-b py-3 text-xs sm:grid-cols-4">
      <span>{invoiceText(`docTypes.${reference.ref_doc_type}`)}</span>
      <Link
        className="text-primary underline"
        to={`/accounting/accounts-payable/invoice/${reference.ref_ap_invoice_id}`}
      >
        {query.data?.doc_no || t("openDocument")}
      </Link>
      <span>
        {query.data?.doc_date
          ? formatDate(query.data.doc_date, dateFormat)
          : "—"}
      </span>
      <span className="text-right tabular-nums">
        {money(
          Number(
            reference.ref_doc_type === "debit_note" ||
              reference.applied_amount.startsWith("-")
              ? reference.applied_amount
              : subtractDecimal("0", reference.applied_amount),
          ),
        )}{" "}
        {currency}
      </span>
    </div>
  );
}

export function InvoiceReferencesPanel({
  invoice,
}: {
  readonly invoice?: ApInvoice | null;
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">{t("references")}</h3>
      {invoice?.references?.length ? (
        invoice.references.map((reference) => (
          <InvoiceReferenceRow
            key={reference.ref_ap_invoice_id}
            reference={reference}
            currency={invoice.currency_code}
          />
        ))
      ) : (
        <p className="text-muted-foreground text-xs">{t("noReferences")}</p>
      )}
    </div>
  );
}

export function InvoicePaymentsPanel({
  invoice,
}: {
  readonly invoice?: ApInvoice | null;
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const money = useAmountFormatter();
  return (
    <div className="space-y-3 text-xs">
      {invoice && (
        <div className="flex flex-wrap gap-6">
          <span>
            {t("total")}{" "}
            <strong className="tabular-nums">
              {money(Number(invoice.total_amount))} {invoice.currency_code}
            </strong>
          </span>
          <span>
            {t("unpaid")}{" "}
            <strong className="tabular-nums">
              {money(Number(invoice.outstanding_amount))}{" "}
              {invoice.currency_code}
            </strong>
          </span>
          {invoice.reference_applied_amount !== "0" && (
            <span>
              {t("referenceApplied")}{" "}
              {money(Number(invoice.reference_applied_amount))}
            </span>
          )}
        </div>
      )}
      <p className="text-muted-foreground">{t("paymentHistoryRegister")}</p>
      <Link
        className="text-primary underline"
        to="/accounting/accounts-payable/payment"
      >
        {t("openPaymentRegister")}
      </Link>
    </div>
  );
}
