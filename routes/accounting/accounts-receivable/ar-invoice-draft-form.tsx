import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { LookupCurrency } from "@/components/lookup/lookup-currency";
import { FormToolbar } from "@/components/share/form-toolbar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { StatusChip } from "@/components/ui/status-chip";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useBuCode } from "@/hooks/use-bu-code";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { isoToDateInput } from "@/lib/date-utils";
import {
  arLineAmounts,
  arLineBaseTotal,
  draftLineFromRecord,
  draftLineToInput,
  newArDraftLine,
  type ArDraftLine,
  type ArInvoiceReferenceInput,
} from "./ar-invoice-draft-model";
import { ArInvoiceLineDialog } from "./ar-invoice-line-dialog";
import { InvoiceJournal } from "./ar-invoice-journal";
import { ArInvoiceTaxLines } from "./ar-invoice-tax-lines";
import { ArInvoiceLines } from "./ar-invoice-lines";
import {
  InvoiceTaxEntityFields,
  InvoiceMockDeposits,
} from "./ar-invoice-supplement";
import {
  invoiceTaxEntity,
  invoiceTaxEntityValidation,
  readInvoiceSupplement,
  saveInvoiceSupplement,
  validInvoiceSupplement,
  type InvoiceSupplement,
} from "./ar-invoice-supplement-model";
import { ArInvoiceReferences } from "./ar-invoice-references";
import { useArCustomer, type ArCustomer } from "./use-ar-customer";
import { ArCustomerLookup } from "./ar-customer-lookup";
import {
  useCreateArInvoice,
  useUpdateArInvoice,
  type ArRegisterDocument,
} from "./use-ar-register";

const FORM_ID = "ar-invoice-draft";
const GRID =
  "grid min-w-0 gap-x-4 gap-y-3 @md:grid-cols-2 @3xl:grid-cols-4 @5xl:grid-cols-6";

export function ArInvoiceDraftForm({
  document,
  canWrite,
  cancel,
  saved,
}: {
  readonly document?: ArRegisterDocument;
  readonly canWrite: boolean;
  readonly cancel: () => void;
  readonly saved: (id: string) => void | Promise<void>;
}) {
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const bu = useBuCode();
  const { defaultCurrencyId, defaultCurrencyCode } = useProfile();
  const [customer, setCustomer] = useState<ArCustomer>();
  const [initialDate] = useState(() =>
    isoToDateInput(document?.doc_date ?? new Date().toISOString()),
  );
  const [date, setDate] = useState(initialDate);
  const [description, setDescription] = useState(document?.description ?? "");
  const [currencyId, setCurrencyId] = useState(document?.currency_id ?? "");
  const [currencyCode, setCurrencyCode] = useState(
    document?.currency_code ?? defaultCurrencyCode,
  );
  const [rate, setRate] = useState(String(document?.exchange_rate ?? 1));
  const [creditDays, setCreditDays] = useState(document?.credit_term_days ?? 0);
  const [sourceDoc, setSourceDoc] = useState(document?.source_doc_ref ?? "");
  const [taxInvoice, setTaxInvoice] = useState(
    document?.is_tax_invoice ?? false,
  );
  const [whtEnabled, setWhtEnabled] = useState(
    document?.is_wht_recorded ?? false,
  );
  const [whtAmount, setWhtAmount] = useState(String(document?.wht_amount ?? 0));
  const [initialLines] = useState(
    () => document?.tb_ar_invoice_detail?.map(draftLineFromRecord) ?? [],
  );
  const [lines, setLines] = useState(initialLines);
  const [initialReferences] = useState<ArInvoiceReferenceInput[]>(() =>
    (document?.tb_ar_invoice_reference ?? []).map((row) => ({
      ref_ar_invoice_id: row.ref_ar_invoice_id,
      applied_amount: row.applied_amount,
      remarks: row.remarks,
    })),
  );
  const [references, setReferences] = useState(initialReferences);
  const [initialSupplement] = useState<InvoiceSupplement>(
    () =>
      (bu && document ? readInvoiceSupplement(bu, document.id) : undefined) ?? {
        taxEntity: invoiceTaxEntity(document),
        deposits: [],
      },
  );
  const [supplementDraft, setSupplement] = useState(initialSupplement);
  const [taxEntityEdited, setTaxEntityEdited] = useState(
    Boolean(bu && document && readInvoiceSupplement(bu, document.id)),
  );
  const customerDetail = useArCustomer(document?.customer_id ?? customer?.id);
  const [committedId, setCommittedId] = useState<string>();
  // Customer defaults stay derived until the user overrides tax fields. Query refreshes cannot overwrite edits.
  const supplement =
    taxEntityEdited || !customerDetail.data
      ? supplementDraft
      : {
          ...supplementDraft,
          taxEntity: invoiceTaxEntity(document, customerDetail.data),
        };
  const [editor, setEditor] = useState<ArDraftLine | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const create = useCreateArInvoice();
  const update = useUpdateArInvoice();
  const dirty =
    Boolean(customer) ||
    date !== initialDate ||
    description !== (document?.description ?? "") ||
    supplementDraft !== initialSupplement ||
    lines !== initialLines ||
    references !== initialReferences ||
    currencyId !== (document?.currency_id ?? "") ||
    rate !== String(document?.exchange_rate ?? 1) ||
    creditDays !== (document?.credit_term_days ?? 0) ||
    sourceDoc !== (document?.source_doc_ref ?? "") ||
    taxInvoice !== !!document?.is_tax_invoice ||
    whtEnabled !== !!document?.is_wht_recorded ||
    whtAmount !== String(document?.wht_amount ?? 0);
  useUnsavedChanges(dirty && !saving);
  const totals = lines.reduce(
    (sum, line) => {
      const amount = arLineAmounts(line);
      return {
        subtotal: sum.subtotal + amount.subtotal,
        discount: sum.discount + amount.discount,
        net: sum.net + amount.net,
        vat: sum.vat + amount.vat,
        tax2: sum.tax2 + amount.tax2,
        total: sum.total + amount.total,
      };
    },
    { subtotal: 0, discount: 0, net: 0, vat: 0, tax2: 0, total: 0 },
  );
  const dueDate = new Date(`${date}T00:00:00Z`);
  dueDate.setUTCDate(dueDate.getUTCDate() + creditDays);
  const due = Number.isFinite(dueDate.getTime())
    ? dueDate.toISOString().slice(0, 10)
    : "";
  const disabled = saving || !canWrite || !!committedId;
  const applied = references.reduce(
    (sum, row) => sum + Number(row.applied_amount || 0),
    0,
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    if (committedId) {
      setSaving(true);
      try {
        if (persistSupplement(committedId)) {
          setError("");
          await saved(committedId);
        }
      } finally {
        setSaving(false);
      }
      return;
    }
    if (!document && !customer) {
      setError(t("customerRequired"));
      return;
    }
    if (!lines.length) {
      setError(t("lineRequired"));
      return;
    }
    if (
      !Number.isFinite(Number(rate)) ||
      Number(rate) <= 0 ||
      !Number.isInteger(creditDays) ||
      creditDays < 0 ||
      (whtEnabled &&
        (!Number.isFinite(Number(whtAmount)) || Number(whtAmount) < 0)) ||
      applied > totals.total
    ) {
      setError(t("invalidHeader"));
      return;
    }
    const taxEntityError = invoiceTaxEntityValidation(
      supplement.taxEntity,
      taxInvoice,
    );
    if (taxEntityError) {
      setError(t(taxEntityError));
      return;
    }
    if (
      !validInvoiceSupplement(supplement, totals.total - applied, taxInvoice)
    ) {
      setError(t("invalidHeader"));
      return;
    }
    setError("");
    setSaving(true);
    const header = {
      doc_date: date,
      description: description.trim() || null,
      credit_term_days: creditDays,
      currency_id: currencyId || undefined,
      exchange_rate: rate,
      source_doc_ref: sourceDoc.trim() || null,
      is_tax_invoice: taxInvoice,
      is_wht_recorded: whtEnabled,
      wht_amount: whtEnabled ? whtAmount : 0,
    };
    try {
      if (document) {
        if (document.doc_version == null) return;
        await update.mutateAsync({
          id: document.id,
          doc_version: document.doc_version,
          ...header,
          ...(lines !== initialLines && {
            details: { add: lines.map(draftLineToInput) },
          }),
          ...(references !== initialReferences && { references }),
        });
        if (!persistSupplement(document.id)) return;
        toast.success(t("saved"));
        await saved(document.id);
      } else if (customer) {
        const result = await create.mutateAsync({
          doc_type: "invoice",
          customer_id: customer.id,
          ...header,
          details: { add: lines.map(draftLineToInput) },
          references,
        });
        if (!result.data?.id) {
          setError(t("missingCreatedId"));
          return;
        }
        if (!persistSupplement(result.data.id)) return;
        toast.success(t("created"));
        await saved(result.data.id);
      }
    } catch {
      /* Shared API handler reports the server error; keep all entered values. */
    } finally {
      setSaving(false);
    }
  }
  function persistSupplement(id: string) {
    if (!bu || supplementDraft === initialSupplement) return true;
    try {
      saveInvoiceSupplement(bu, id, supplement);
      return true;
    } catch {
      setSupplement(supplement);
      setTaxEntityEdited(true);
      setCommittedId(id);
      setError(t("mockSaveError"));
      return false;
    }
  }
  function saveLine(line: ArDraftLine) {
    setLines((previous) =>
      previous.some((item) => item.id === line.id)
        ? previous.map((item) => (item.id === line.id ? line : item))
        : [...previous, line],
    );
    setError("");
    setEditor(null);
  }
  function selectCustomer(value: ArCustomer | undefined) {
    setTaxEntityEdited(false);
    setCustomer(value);
    setCreditDays(value?.credit_term_days ?? 0);
    setCurrencyId(value?.default_currency_id ?? "");
    setCurrencyCode(value?.default_currency_code ?? defaultCurrencyCode);
    setRate(
      (value?.default_currency_id &&
        value.default_currency_id !== defaultCurrencyId) ||
        (value?.default_currency_code &&
          value.default_currency_code !== defaultCurrencyCode)
        ? ""
        : "1",
    );
    setReferences([]);
    setSupplement({
      taxEntity: invoiceTaxEntity(undefined, value),
      deposits: [],
    });
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <FormToolbar
        title={document?.doc_no ?? t("newInvoice")}
        mode={document ? "edit" : "add"}
        formId={FORM_ID}
        isPending={saving}
        onBack={saving ? undefined : cancel}
        onCancel={cancel}
        submitLabel={
          committedId ? t("retryMockSave") : tc(document ? "save" : "saveDraft")
        }
        writeDisabledReason={canWrite ? undefined : t("writeUnavailable")}
        flush={false}
        badges={<StatusChip status="draft" label={t("statuses.draft")} />}
      />
      <form
        id={FORM_ID}
        onSubmit={submit}
        className="@container flex min-h-0 min-w-0 flex-1 flex-col gap-3"
      >
        <div className={`${GRID} border-b pb-3`}>
          <Field>
            <FieldLabel>{t("number")}</FieldLabel>
            <FieldPlainText>
              {document?.doc_no || t("autoNumber")}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel htmlFor="ar-invoice-date" required>
              {t("date")}
            </FieldLabel>
            <FieldInput
              id="ar-invoice-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              disabled={disabled}
            />
          </Field>
          <Field className="min-w-0 @md:col-span-2">
            <FieldLabel required={!document}>{t("customer")}</FieldLabel>
            {document ? (
              <FieldPlainText>
                {document.customer_code} · {document.customer_name}
              </FieldPlainText>
            ) : (
              <ArCustomerLookup
                customer={customer}
                change={selectCustomer}
                disabled={disabled}
              />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("currency")}</FieldLabel>
            <LookupCurrency
              value={
                currencyId ||
                (currencyCode === defaultCurrencyCode
                  ? defaultCurrencyId
                  : undefined) ||
                ""
              }
              fullWidth
              disabled={disabled}
              onValueChange={(id) => {
                setCurrencyId(id);
                setReferences([]);
                setSupplement((previous) => ({ ...previous, deposits: [] }));
              }}
              onItemChange={(item) => {
                setCurrencyCode(item.code ?? "");
                setRate(String(item.exchange_rate ?? 1));
              }}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ar-invoice-rate" required>
              {t("exchangeRate")}
            </FieldLabel>
            <FieldInput
              id="ar-invoice-rate"
              type="number"
              min="0.00001"
              step="any"
              value={rate}
              onChange={(event) => setRate(event.target.value)}
              disabled={disabled}
              required
            />
          </Field>
          <Field>
            <FieldLabel>{t("source")}</FieldLabel>
            <FieldPlainText>
              {document?.doc_source ?? t("manual")}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel htmlFor="ar-invoice-source">
              {t("sourceDoc")}
            </FieldLabel>
            <FieldInput
              id="ar-invoice-source"
              value={sourceDoc}
              onChange={(event) => setSourceDoc(event.target.value)}
              disabled={disabled}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ar-invoice-credit">
              {t("creditDays")}
            </FieldLabel>
            <FieldInput
              id="ar-invoice-credit"
              type="number"
              min={0}
              step={1}
              value={creditDays}
              onChange={(event) => setCreditDays(Number(event.target.value))}
              disabled={disabled}
            />
          </Field>
          <Field>
            <FieldLabel>{t("due")}</FieldLabel>
            <FieldPlainText>{due || "—"}</FieldPlainText>
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="ar-invoice-memo">{t("memo")}</FieldLabel>
            <Textarea
              id="ar-invoice-memo"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              maxLength={255}
              disabled={disabled}
            />
          </Field>
          <Field>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Checkbox
                checked={taxInvoice}
                onCheckedChange={(value) => setTaxInvoice(value === true)}
                disabled={disabled}
              />
              {t("taxInvoiceEnabled")}
            </label>
            <FieldPlainText>
              {document?.tax_invoice?.tax_invoice_no || t("taxNumberOnSubmit")}
            </FieldPlainText>
          </Field>
          <Field>
            <label className="flex items-center gap-2 text-xs font-semibold">
              <Checkbox
                checked={whtEnabled}
                onCheckedChange={(value) => setWhtEnabled(value === true)}
                disabled={disabled}
              />
              {t("whtAmount")}
            </label>
            <FieldInput
              aria-label={t("whtAmount")}
              type="number"
              min={0}
              step="any"
              value={whtAmount}
              onChange={(event) => setWhtAmount(event.target.value)}
              disabled={disabled || !whtEnabled}
            />
          </Field>
        </div>
        <Tabs defaultValue="items" className="min-w-0 flex-1">
          <div className="shrink-0 overflow-x-auto overflow-y-hidden pb-1">
            <TabsList variant="line">
              {(
                ["items", "tax", "references", "receipt", "journal"] as const
              ).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  disabled={
                    tab === "references" &&
                    !!document &&
                    document.doc_type !== "invoice"
                  }
                >
                  {t(tab)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
          <TabsContent value="items">
            <section
              className="min-w-0 space-y-2"
              aria-labelledby="ar-invoice-items"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 id="ar-invoice-items" className="text-sm font-semibold">
                  {t("items")}
                </h2>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setEditor(
                      newArDraftLine(
                        lines.reduce(
                          (max, line) => Math.max(max, line.sequence_no),
                          0,
                        ) + 1,
                      ),
                    )
                  }
                  disabled={disabled}
                >
                  <Plus />
                  {t("addLine")}
                </Button>
              </div>
              <ArInvoiceLines
                lines={lines}
                edit={disabled ? undefined : setEditor}
                remove={
                  disabled
                    ? undefined
                    : (line) =>
                        setLines((previous) =>
                          previous.filter((item) => item.id !== line.id),
                        )
                }
              />
            </section>
          </TabsContent>
          <TabsContent value="tax">
            <InvoiceTaxEntityFields
              value={supplement.taxEntity}
              required={taxInvoice}
              change={
                disabled
                  ? undefined
                  : (taxEntity) => {
                      setTaxEntityEdited(true);
                      setSupplement((previous) => ({ ...previous, taxEntity }));
                    }
              }
            />
            <div className="mt-3">
              <ArInvoiceTaxLines
                lines={lines}
                exchangeRate={Number(rate || 0)}
                baseCurrency={defaultCurrencyCode}
              />
            </div>
          </TabsContent>
          <TabsContent value="references">
            <div className="space-y-4">
              <ArInvoiceReferences
                customerId={document?.customer_id ?? customer?.id}
                currency={currencyCode}
                rate={Number(rate)}
                references={references}
                change={setReferences}
                disabled={disabled}
              />
              <InvoiceMockDeposits
                rows={supplement.deposits}
                change={(rows) =>
                  setSupplement((previous) => ({ ...previous, deposits: rows }))
                }
                rate={Number(rate)}
                currency={currencyCode}
                maxAmount={
                  totals.total -
                  applied -
                  supplement.deposits.reduce((sum, row) => sum + row.amount, 0)
                }
                disabled={disabled || (!document && !customer)}
              />
            </div>
          </TabsContent>
          <TabsContent value="receipt">
            <p className="text-muted-foreground text-sm">
              {t("receiptAfterSave")}
            </p>
          </TabsContent>
          <TabsContent value="journal">
            <InvoiceJournal
              document={{
                id: document?.id ?? "new",
                doc_no: document?.doc_no ?? "",
                doc_type: document?.doc_type ?? "invoice",
                doc_status: "draft",
                doc_date: date,
                due_date: due,
                customer_id: document?.customer_id ?? customer?.id ?? "",
                customer_code: document?.customer_code ?? customer?.code ?? "",
                customer_name: document?.customer_name ?? customer?.name ?? "",
                currency_code: currencyCode,
                exchange_rate: Number(rate || 0),
                net_amount: totals.net,
                vat_amount: totals.vat,
                total_amount: totals.total,
                outstanding_amount: totals.total - applied,
                tb_ar_invoice_detail: lines.map((line) => ({
                  ...line,
                  total_amount: arLineAmounts(line).total,
                  tb_ar_invoice_detail_dimension: line.dimensions,
                })),
              }}
            />
          </TabsContent>
        </Tabs>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
        <SummaryFooterBar
          hasRecord
          items={[
            {
              key: "subtotal",
              label: t("subtotal"),
              value: money(totals.subtotal),
            },
            {
              key: "discount",
              label: t("discount"),
              value: money(totals.discount),
              valueClassName: "text-destructive",
            },
            { key: "net", label: t("net"), value: money(totals.net) },
            { key: "vat", label: t("tax1Amount"), value: money(totals.vat) },
            { key: "tax2", label: t("tax2Amount"), value: money(totals.tax2) },
            {
              key: "total",
              label: t("total"),
              value: money(totals.total),
              suffix: currencyCode,
              emphasis: true,
            },
            {
              key: "unpaid",
              label: t("outstanding"),
              value: money(totals.total - applied),
              suffix: currencyCode,
            },
            {
              key: "base",
              label: t("baseTotal"),
              value: money(
                lines.reduce(
                  (sum, line) => sum + arLineBaseTotal(line, Number(rate || 0)),
                  0,
                ),
              ),
              suffix: defaultCurrencyCode,
            },
          ]}
        />
      </form>
      {editor && (
        <ArInvoiceLineDialog
          key={editor.id}
          line={editor}
          isNew={!lines.some((line) => line.id === editor.id)}
          close={() => setEditor(null)}
          save={saveLine}
        />
      )}
    </div>
  );
}
