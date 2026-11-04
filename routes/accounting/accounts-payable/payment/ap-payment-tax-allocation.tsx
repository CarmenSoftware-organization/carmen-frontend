import type { ApPaymentInput } from "@/types/accounts-payable-mock";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApDetailGrid } from "../shared/ap-detail-grid";
import { ApStatusBadge, Money } from "../shared/ap-ui";
import {
  addDecimal,
  compareDecimal,
  divideDecimal,
  multiplyDecimal,
  subtractDecimal,
} from "../shared/ap-decimal";

export function PaymentTaxAllocation({
  form,
  onChange,
  editable,
}: {
  form: ApPaymentInput;
  onChange: (value: ApPaymentInput) => void;
  editable: boolean;
}) {
  const allocations = form.tax_allocations ?? [];
  const byInvoice = new Map(allocations.map((item) => [item.invoice_id, item]));
  const rows = form.applications.map((item) => {
    const allocation = byInvoice.get(item.invoice_id);
    const original =
      item.undue_vat_base ??
      (item.tax_status === "confirmed" || item.tax_status === "filed"
        ? "0"
        : multiplyDecimal(
            item.vat_amount ?? "0",
            item.original_rate ?? form.exchange_rate,
          ));
    return {
      ...item,
      original,
      claim: allocation?.claim_amount ?? "0",
      linked: allocation?.tax_invoice_id ?? "",
      prorata:
        compareDecimal(item.original_amount, "0") > 0
          ? divideDecimal(
              multiplyDecimal(original, item.apply_amount),
              item.original_amount,
            )
          : "0",
    };
  });
  const update = (
    invoice_id: string,
    patch: Partial<(typeof allocations)[number]>,
  ) => {
    const existing = byInvoice.get(invoice_id) ?? {
      invoice_id,
      tax_invoice_id: "",
      claim_amount: "0",
    };
    onChange({
      ...form,
      tax_allocations: [
        ...allocations.filter((item) => item.invoice_id !== invoice_id),
        { ...existing, ...patch },
      ],
    });
  };
  return (
    <Card className="gap-3 py-3">
      <CardHeader className="px-3">
        <CardTitle className="text-sm">Input VAT allocation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 px-3">
        <ApDetailGrid
          rows={rows}
          columns={[
            { accessorKey: "invoice_no", header: "Settled invoice no." },
            { accessorKey: "description", header: "Service description" },
            {
              id: "original",
              header: "Original undue VAT",
              cell: ({ row }) => <Money value={row.original.original} />,
            },
            {
              id: "paid",
              header: "Paid amt. (THB)",
              cell: ({ row }) => (
                <Money
                  value={multiplyDecimal(
                    row.original.apply_amount,
                    form.exchange_rate,
                  )}
                  className="text-primary"
                />
              ),
            },
            {
              id: "linked",
              header: "Linked tax invoice",
              cell: ({ row }) =>
                editable ? (
                  <Select
                    value={row.original.linked || "none"}
                    onValueChange={(value) =>
                      update(row.original.invoice_id, {
                        tax_invoice_id: value === "none" ? "" : value,
                        ...(value === "none" ? { claim_amount: "0" } : {}),
                      })
                    }
                  >
                    <SelectTrigger
                      className="min-w-40"
                      aria-label={`Linked tax invoice ${row.original.invoice_no}`}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        None / Separate later
                      </SelectItem>
                      {(form.tax_invoices ?? []).map((tax) => (
                        <SelectItem key={tax.id} value={tax.id}>
                          {tax.document_no || "New tax invoice"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  ((form.tax_invoices ?? []).find(
                    (item) => item.id === row.original.linked,
                  )?.document_no ?? "—")
                ),
            },
            {
              id: "prorata",
              header: "Pro-rata VAT",
              cell: ({ row }) => <Money value={row.original.prorata} />,
            },
            {
              id: "claim",
              header: "Claim VAT (THB)",
              cell: ({ row }) =>
                editable ? (
                  <Input
                    aria-label={`Claim VAT ${row.original.invoice_no}`}
                    disabled={
                      !row.original.linked ||
                      compareDecimal(row.original.original, "0") === 0
                    }
                    value={row.original.claim}
                    inputMode="decimal"
                    className="min-w-28 text-right tabular-nums"
                    onChange={(event) => {
                      if (/^\d*(\.\d*)?$/.test(event.target.value))
                        update(row.original.invoice_id, {
                          claim_amount: event.target.value,
                        });
                    }}
                  />
                ) : (
                  <Money
                    value={row.original.claim}
                    className="text-emerald-600 dark:text-emerald-400"
                  />
                ),
            },
            {
              id: "remaining",
              header: "Remaining undue",
              cell: ({ row }) => (
                <Money
                  value={subtractDecimal(
                    row.original.original,
                    row.original.claim,
                  )}
                  className="text-amber-600 dark:text-amber-400"
                />
              ),
            },
            {
              id: "status",
              header: "Tax status",
              cell: ({ row }) => (
                <ApStatusBadge
                  value={
                    compareDecimal(row.original.claim, "0") > 0
                      ? "confirmed"
                      : compareDecimal(row.original.original, "0") === 0
                        ? "not_applicable"
                        : "pending"
                  }
                />
              ),
            },
          ]}
          empty="Select invoices before allocating input VAT."
        />
        <p className="text-right text-sm">
          Claimed VAT{" "}
          <Money
            value={addDecimal(allocations.map((item) => item.claim_amount))}
            className="text-emerald-600 dark:text-emerald-400"
          />
        </p>
      </CardContent>
    </Card>
  );
}
