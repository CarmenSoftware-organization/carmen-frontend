import { useState } from "react";
import { X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuCode } from "@/hooks/use-bu-code";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import type { ApInvoiceReferenceInput } from "@/types/accounts-payable";
import { httpApRepository } from "../shared/ap-http-repository";
import { addDecimal, compareDecimal } from "../shared/ap-decimal";

export function InvoiceReferenceEditor({
  vendorId,
  currencyId,
  invoiceId,
  value,
  onChange,
  originalValue = [],
}: {
  readonly vendorId: string;
  readonly currencyId: string;
  readonly invoiceId?: string;
  readonly value: ApInvoiceReferenceInput[];
  readonly onChange: (value: ApInvoiceReferenceInput[]) => void;
  readonly originalValue?: ApInvoiceReferenceInput[];
}) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const invoiceText = useTranslations("accounting.accountsPayable.invoice");
  const format = useAmountFormatter();
  const bu = useBuCode();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ApInvoiceReferenceInput[]>([]);
  const [search, setSearch] = useState("");
  const query = useQuery({
    queryKey: [
      "accounts-payable",
      bu,
      "reference-options",
      vendorId,
      currencyId,
    ],
    enabled: (open || value.length > 0) && !!bu && !!vendorId && !!currencyId,
    queryFn: () =>
      fetchAllPages((page, perpage) =>
        httpApRepository.listInvoices(bu!, {
          page,
          perpage,
          filter: `vendor_id|string:${vendorId}`,
        }),
      ),
  });
  const currentIds = new Set(value.map((item) => item.ref_ap_invoice_id));
  const options = (query.data ?? []).filter(
    (doc) =>
      doc.id !== invoiceId &&
      doc.vendor_id === vendorId &&
      doc.currency_id === currencyId &&
      doc.doc_type !== "invoice" &&
      (doc.doc_status === "posted" || doc.doc_status === "in_review") &&
      (compareDecimal(doc.outstanding_amount, "0") > 0 ||
        currentIds.has(doc.id)),
  );
  const optionMap = new Map(options.map((doc) => [doc.id, doc]));
  const draftById = new Map(
    draft.map((item) => [item.ref_ap_invoice_id, item]),
  );
  const originalAmounts = new Map(
    originalValue.map((item) => [item.ref_ap_invoice_id, item.applied_amount]),
  );
  const cap = (id: string, outstanding: string) =>
    addDecimal([outstanding, originalAmounts.get(id) ?? "0"]);
  const invalid = draft.some((item) => {
    const doc = optionMap.get(item.ref_ap_invoice_id);
    return (
      !doc ||
      !/^\d+(\.\d{1,2})?$/.test(item.applied_amount) ||
      compareDecimal(item.applied_amount, "0") <= 0 ||
      compareDecimal(item.applied_amount, cap(doc.id, doc.outstanding_amount)) >
        0
    );
  });
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {t("selectedDocuments", { count: value.length })}
        </span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!vendorId || !currencyId}
          onClick={() => {
            setDraft(value.map((item) => ({ ...item })));
            setSearch("");
            setOpen(true);
          }}
        >
          {t("applyDocument")}
        </Button>
      </div>
      {value.length > 0 && (
        <div className="divide-y text-xs">
          {value.map((item) => (
            <div
              key={item.ref_ap_invoice_id}
              className="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <span>
                {optionMap.get(item.ref_ap_invoice_id)?.doc_no ||
                  item.ref_ap_invoice_id}
              </span>
              <span className="tabular-nums">
                {format(Number(item.applied_amount))}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`${t("removeReference")} ${optionMap.get(item.ref_ap_invoice_id)?.doc_no || item.ref_ap_invoice_id}`}
                onClick={() =>
                  onChange(
                    value.filter(
                      (reference) =>
                        reference.ref_ap_invoice_id !== item.ref_ap_invoice_id,
                    ),
                  )
                }
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
      {value.length > 0 && (
        <p className="text-muted-foreground text-xs">
          {t("referenceSaveNote")}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("applyDocument")}</DialogTitle>
          </DialogHeader>
          <Input
            aria-label={t("searchDocuments")}
            placeholder={t("searchDocuments")}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div className="min-h-0 flex-1 space-y-2 overflow-auto">
            {query.isLoading ? (
              <Skeleton className="h-24" />
            ) : query.isError ? (
              <ErrorState
                error={query.error}
                onRetry={() => void query.refetch()}
              />
            ) : (
              options
                .filter((doc) =>
                  `${doc.doc_no} ${doc.description ?? ""}`
                    .toLowerCase()
                    .includes(search.toLowerCase()),
                )
                .map((doc) => {
                  const selected = draftById.get(doc.id);
                  return (
                    <div
                      key={doc.id}
                      className="flex flex-wrap items-center gap-3 border-b py-2 text-xs"
                    >
                      <Checkbox
                        aria-label={doc.doc_no}
                        checked={!!selected}
                        onCheckedChange={(checked) =>
                          setDraft((current) =>
                            checked
                              ? [
                                  ...current,
                                  {
                                    ref_ap_invoice_id: doc.id,
                                    applied_amount: cap(
                                      doc.id,
                                      doc.outstanding_amount,
                                    ),
                                  },
                                ]
                              : current.filter(
                                  (item) => item.ref_ap_invoice_id !== doc.id,
                                ),
                          )
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <strong>{doc.doc_no}</strong>
                        <span className="text-muted-foreground ml-2">
                          {invoiceText(`docTypes.${doc.doc_type}`)}
                        </span>
                      </span>
                      <span className="tabular-nums">
                        {format(Number(doc.outstanding_amount))}{" "}
                        {doc.currency_code}
                      </span>
                      {selected && (
                        <Input
                          aria-label={`${t("appliedAmount")} ${doc.doc_no}`}
                          className="w-32 text-right tabular-nums"
                          inputMode="decimal"
                          value={selected.applied_amount}
                          onChange={(event) => {
                            if (/^\d*(\.\d{0,2})?$/.test(event.target.value))
                              setDraft((current) =>
                                current.map((item) =>
                                  item.ref_ap_invoice_id === doc.id
                                    ? {
                                        ...item,
                                        applied_amount: event.target.value,
                                      }
                                    : item,
                                ),
                              );
                          }}
                        />
                      )}
                    </div>
                  );
                })
            )}
            {!query.isLoading && !query.isError && options.length === 0 && (
              <p className="text-muted-foreground text-xs">
                {t("noEligibleReferences")}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {t("close")}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={query.isLoading || query.isError || invalid}
              onClick={() => {
                onChange(draft);
                setOpen(false);
              }}
            >
              {t("applyChanges")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
