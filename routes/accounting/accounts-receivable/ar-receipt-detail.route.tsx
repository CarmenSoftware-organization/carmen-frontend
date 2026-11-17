import { useState, type FormEvent } from "react";
import { Ban, Copy, Plus, Send, Trash2 } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import EmptyComponent from "@/components/empty-component";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
import { MockBadge } from "@/components/ui/mock-badge";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import {
  Field,
  FieldDatePicker,
  FieldInput,
  FieldLabel,
  FieldPlainText,
  FieldSelect,
} from "@/components/ui/field";
import { SelectContent, SelectItem } from "@/components/ui/select";
import { StatusChip } from "@/components/ui/status-chip";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useCurrencyAll } from "@/hooks/use-currency";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { addDays, formatDate, isoToDateInput } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { ArCustomerLookup } from "./ar-customer-lookup";
import {
  ReceiptInvoiceDialog,
  ReceiptPaymentDialog,
} from "./ar-receipt-dialogs";
import {
  AR_RECEIPT_PATH,
  deleteReceipt,
  newReceipt,
  newReceiptFromInvoice,
  newReceiptPayment,
  readReceipts,
  receiptAllocationTax,
  receiptProfileDefaults,
  receiptTaxEntityFromCustomer,
  receiptTotals,
  receiptValidation,
  saveReceipt,
  suggestedReceiptWht,
  voidReceipt,
  type ArReceipt,
  type ReceiptPayment,
  type ReceiptTaxEntity,
} from "./ar-receipt-model";
import { useArCustomer, type ArCustomer } from "./use-ar-customer";
import type { ArRegisterDocument } from "./use-ar-register";
import { readProfileExtension } from "./ar-profile-model";

const FORM_ID = "ar-receipt-form";
const DESTRUCTIVE_ACTION =
  "text-destructive hover:bg-destructive/10 hover:text-destructive";

export function Component() {
  const bu = useBuCode();
  const { id = "new" } = useParams();
  return bu ? <ReceiptDetail key={`${bu}:${id}`} bu={bu} id={id} /> : null;
}

function ReceiptDetail({
  bu,
  id,
}: {
  readonly bu: string;
  readonly id: string;
}) {
  const t = useTranslations("accounting.arReceipt");
  const location = useLocation();
  const { defaultCurrencyCode } = useProfile();
  const [loaded] = useState(() => {
    try {
      const state = location.state as {
        receiptInvoice?: ArRegisterDocument;
        receiptCopy?: ArReceipt;
      } | null;
      const source = state?.receiptInvoice;
      const today = isoToDateInput(new Date().toISOString());
      return {
        receipt:
          id === "new"
            ? (state?.receiptCopy ??
              (source
                ? {
                    ...newReceiptFromInvoice(source, today),
                    ...receiptProfileDefaults(
                      readProfileExtension(bu, source.customer_id),
                    ),
                  }
                : newReceipt(today, defaultCurrencyCode)))
            : readReceipts(bu).find((row) => row.id === id),
        error: false,
      };
    } catch {
      return { receipt: undefined, error: true };
    }
  });
  if (loaded.error)
    return <ErrorState message={t("storageError")} backTo={AR_RECEIPT_PATH} />;
  if (!loaded.receipt)
    return (
      <ErrorState
        notFoundMessage={t("receiptNotFound")}
        backTo={AR_RECEIPT_PATH}
      />
    );
  return <ReceiptForm bu={bu} initial={loaded.receipt} isNew={id === "new"} />;
}

function ReceiptForm({
  bu,
  initial,
  isNew,
}: {
  readonly bu: string;
  readonly initial: ArReceipt;
  readonly isNew: boolean;
}) {
  const t = useTranslations("accounting.arReceipt");
  const tp = useTranslations("accounting.arProfile");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const navigate = useNavigate();
  const { dateFormat } = useProfile();
  const { canWrite } = useCan();
  const currencies = useCurrencyAll();
  const [receiptDraft, setReceipt] = useState(initial);
  const [defaultsCustomerId, setDefaultsCustomerId] = useState(
    isNew && !initial.customerId.startsWith("sample-")
      ? initial.customerId || undefined
      : undefined,
  );
  const [taxEdited, setTaxEdited] = useState(false);
  const customerDefaults = useArCustomer(defaultsCustomerId);
  const receipt =
    !taxEdited && customerDefaults.data?.id === receiptDraft.customerId
      ? {
          ...receiptDraft,
          taxEntity: receiptTaxEntityFromCustomer(customerDefaults.data),
        }
      : receiptDraft;
  const [baseline, setBaseline] = useState(initial);
  const [editing, setEditing] = useState(isNew);
  const [invoicePicker, setInvoicePicker] = useState(false);
  const [paymentEditor, setPaymentEditor] = useState<ReceiptPayment>();
  const [confirmation, setConfirmation] = useState<
    "delete" | "void" | "cancel" | null
  >(null);
  const [pendingCustomer, setPendingCustomer] = useState<ArCustomer>();
  const [error, setError] = useState("");
  const totals = receiptTotals(receipt);
  const readonly = !editing || !canWrite;
  const dirty = editing && JSON.stringify(receipt) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty);
  const set = <K extends keyof ArReceipt>(key: K, value: ArReceipt[K]) =>
    setReceipt((previous) => ({ ...previous, [key]: value }));
  const changeTax = (key: keyof ReceiptTaxEntity, value: string) => {
    setTaxEdited(true);
    setReceipt((previous) => ({
      ...previous,
      taxEntity: { ...receipt.taxEntity, [key]: value },
    }));
  };
  const customer: ArCustomer | undefined = receipt.customerId
    ? {
        id: receipt.customerId,
        code: receipt.customerCode,
        name: receipt.customerName,
      }
    : undefined;

  function applyCustomer(value: ArCustomer) {
    setReceipt((previous) => ({
      ...previous,
      ...receiptProfileDefaults(readProfileExtension(bu, value.id)),
      customerId: value.id,
      customerCode: value.code,
      customerName: value.name,
      currency: value.default_currency_code ?? previous.currency,
      creditDays: value.credit_term_days ?? 0,
      allocations: [],
      payments: [],
      whtAmount: 0,
      whtCertificate: "",
      source: "manual",
      sourceDoc: "",
      taxEntity: receiptTaxEntityFromCustomer(value),
    }));
    setTaxEdited(false);
    setDefaultsCustomerId(value.id);
    setPendingCustomer(undefined);
  }
  function changeCustomer(value?: ArCustomer) {
    if (!value || value.id === receipt.customerId) return;
    if (receipt.allocations.length || receipt.payments.length)
      setPendingCustomer(value);
    else applyCustomer(value);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !editing || (!taxEdited && customerDefaults.isLoading))
      return;
    const invalid = receiptValidation(receipt);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    try {
      const saved = saveReceipt(bu, receipt);
      setReceipt(saved);
      setTaxEdited(true);
      setBaseline(saved);
      setEditing(false);
      setError("");
      toast.success(t("saved"));
      navigate(`${AR_RECEIPT_PATH}/${saved.id}`, { replace: true });
    } catch {
      setError(t("storageError"));
    }
  }
  function cancel() {
    if (isNew) navigate(AR_RECEIPT_PATH);
    else {
      setReceipt(baseline);
      setTaxEdited(true);
      setEditing(false);
      setError("");
    }
    setConfirmation(null);
  }
  function confirmAction() {
    try {
      if (confirmation === "delete") {
        deleteReceipt(bu, receipt.id);
        toast.success(t("deleted"));
        navigate(AR_RECEIPT_PATH);
      } else if (confirmation === "void") {
        const saved = voidReceipt(bu, receipt.id);
        setReceipt(saved);
        setBaseline(saved);
        toast.success(t("voided"));
      } else cancel();
      setConfirmation(null);
    } catch {
      setError(t("storageError"));
    }
  }
  function copy() {
    const next = {
      ...receipt,
      id: crypto.randomUUID(),
      number: "",
      status: "draft" as const,
      source: "copy" as const,
      sourceDoc: receipt.number,
      taxInvoiceNo: "",
    };
    navigate(`${AR_RECEIPT_PATH}/new`, { state: { receiptCopy: next } });
  }
  const dates = (value: string) =>
    value ? formatDate(value, dateFormat) : "—";
  const currencyOptions = [
    ...new Set([
      receipt.currency,
      ...(currencies.data ?? [])
        .filter((currency) => currency.is_active)
        .map((currency) => currency.code),
    ]),
  ];

  return (
    <div className="@container/receipt flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-4">
      <FormToolbar
        title={receipt.number || t("newReceipt")}
        mode={editing ? (isNew ? "add" : "edit") : "view"}
        formId={FORM_ID}
        isPending={false}
        writeDisabledReason={
          editing && !taxEdited && customerDefaults.isLoading
            ? tc("loading")
            : undefined
        }
        flush
        badges={
          <>
            <MockBadge />
            <StatusChip
              status={receipt.status}
              label={t(`statuses.${receipt.status}`)}
            />
          </>
        }
        onBack={() =>
          dirty ? setConfirmation("cancel") : navigate(AR_RECEIPT_PATH)
        }
        onCancel={() => (dirty ? setConfirmation("cancel") : cancel())}
        onEdit={
          !editing && receipt.status === "draft"
            ? () => setEditing(true)
            : undefined
        }
        onDelete={
          !editing && receipt.status === "draft"
            ? () => setConfirmation("delete")
            : undefined
        }
        submitLabel={tc("saveDraft")}
      >
        {!editing && (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={copy}
              disabled={!canWrite}
              title={t("copy")}
            >
              <Copy />
              <ToolbarLabel>{t("copy")}</ToolbarLabel>
            </Button>
            {receipt.status === "draft" && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={DESTRUCTIVE_ACTION}
                onClick={() => setConfirmation("void")}
                disabled={!canWrite}
                title={t("void")}
              >
                <Ban />
                <ToolbarLabel>{t("void")}</ToolbarLabel>
              </Button>
            )}
          </>
        )}
      </FormToolbar>
      <p role="note" className="text-muted-foreground text-xs">
        {t("mockNotice")}
      </p>
      <form
        id={FORM_ID}
        onSubmit={save}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b pb-4 @xl/receipt:grid-cols-4 @4xl/receipt:grid-cols-8">
          <Field>
            <FieldLabel>{t("number")}</FieldLabel>
            <FieldPlainText>{receipt.number || t("autoNumber")}</FieldPlainText>
          </Field>
          <Field>
            <FieldLabel required>{t("inputDate")}</FieldLabel>
            <FieldDatePicker
              className="w-full"
              value={receipt.date}
              onValueChange={(value) => set("date", isoToDateInput(value))}
              readOnly={readonly}
              hideClear
            />
          </Field>
          <Field className="min-w-0 @xl/receipt:col-span-2">
            <FieldLabel required>{t("customer")}</FieldLabel>
            {readonly ? (
              <FieldPlainText>
                {receipt.customerCode} · {receipt.customerName}
              </FieldPlainText>
            ) : (
              <ArCustomerLookup customer={customer} change={changeCustomer} />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("currency")}</FieldLabel>
            {readonly ? (
              <FieldPlainText>{receipt.currency}</FieldPlainText>
            ) : (
              <FieldSelect
                value={receipt.currency}
                disabled={
                  receipt.allocations.length > 0 || receipt.payments.length > 0
                }
                onValueChange={(value) => set("currency", value)}
              >
                <SelectContent>
                  {currencyOptions.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </FieldSelect>
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt-rate" required>
              {t("exchangeRate")}
            </FieldLabel>
            {readonly ? (
              <FieldPlainText>{receipt.rate.toFixed(5)}</FieldPlainText>
            ) : (
              <FieldInput
                id="receipt-rate"
                type="number"
                min="0.00001"
                step="0.00001"
                value={receipt.rate || ""}
                required
                onChange={(event) => set("rate", Number(event.target.value))}
              />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("source")}</FieldLabel>
            <FieldPlainText>{t(`sources.${receipt.source}`)}</FieldPlainText>
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt-source-doc">
              {t("sourceDoc")}
            </FieldLabel>
            {readonly ? (
              <FieldPlainText>{receipt.sourceDoc || "—"}</FieldPlainText>
            ) : (
              <FieldInput
                id="receipt-source-doc"
                value={receipt.sourceDoc}
                maxLength={100}
                onChange={(event) => set("sourceDoc", event.target.value)}
              />
            )}
          </Field>
          <Field className="@xl/receipt:col-span-2">
            <FieldLabel htmlFor="receipt-tax-toggle">
              <Checkbox
                id="receipt-tax-toggle"
                checked={receipt.taxInvoice}
                disabled={readonly}
                onCheckedChange={(value) => set("taxInvoice", value === true)}
              />
              {t("taxInvoice")}
            </FieldLabel>
            <FieldPlainText>
              {receipt.taxInvoiceNo ||
                (receipt.taxInvoice ? t("taxNumberOnSubmit") : "—")}
            </FieldPlainText>
          </Field>
          <Field>
            <FieldLabel htmlFor="receipt-credit">{t("creditDays")}</FieldLabel>
            {readonly ? (
              <FieldPlainText>{receipt.creditDays}</FieldPlainText>
            ) : (
              <FieldInput
                id="receipt-credit"
                type="number"
                min="0"
                max="3650"
                step="1"
                value={receipt.creditDays}
                onChange={(event) =>
                  set("creditDays", Number(event.target.value))
                }
              />
            )}
          </Field>
          <Field>
            <FieldLabel>{t("dueDate")}</FieldLabel>
            <FieldPlainText>
              {dates(addDays(receipt.date, receipt.creditDays))}
            </FieldPlainText>
          </Field>
          <Field className="min-w-0 @xl/receipt:col-span-2">
            <FieldLabel htmlFor="receipt-description">
              {t("description")}
            </FieldLabel>
            {readonly ? (
              <FieldPlainText className="break-words">
                {receipt.description || "—"}
              </FieldPlainText>
            ) : (
              <FieldInput
                id="receipt-description"
                value={receipt.description}
                maxLength={255}
                onChange={(event) => set("description", event.target.value)}
              />
            )}
          </Field>
          <Field className="@xl/receipt:col-span-2">
            <FieldLabel htmlFor="receipt-wht-toggle">
              <Checkbox
                id="receipt-wht-toggle"
                checked={receipt.whtEnabled}
                disabled={readonly}
                onCheckedChange={(value) =>
                  setReceipt((previous) => ({
                    ...previous,
                    whtEnabled: value === true,
                    whtAmount:
                      value === true
                        ? previous.whtAmount || suggestedReceiptWht(previous)
                        : 0,
                  }))
                }
              />
              {t("whtAmount")}
            </FieldLabel>
            {readonly ? (
              <FieldPlainText>{money(totals.wht)}</FieldPlainText>
            ) : (
              <FieldInput
                type="number"
                min="0"
                step="0.01"
                aria-label={t("whtAmount")}
                value={receipt.whtAmount}
                disabled={!receipt.whtEnabled}
                onChange={(event) =>
                  set("whtAmount", Number(event.target.value))
                }
                className="text-right tabular-nums"
              />
            )}
          </Field>
        </div>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
        <Tabs defaultValue="items" className="min-h-0 min-w-0 flex-1">
          <div className="min-w-0 shrink-0 overflow-x-auto overflow-y-hidden pb-1">
            <TabsList variant="line">
              <TabsTrigger value="items">{t("tabs.items")}</TabsTrigger>
              <TabsTrigger value="tax">{t("tabs.tax")}</TabsTrigger>
              <TabsTrigger value="reference" disabled>
                {t("tabs.reference")}
              </TabsTrigger>
              <TabsTrigger value="receipt">{t("tabs.receipt")}</TabsTrigger>
              <TabsTrigger value="journal">{t("tabs.journal")}</TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="items" className="min-w-0 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("allocationLines")}</h2>
              {!readonly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!receipt.customerId}
                  onClick={() => setInvoicePicker(true)}
                >
                  <Plus />
                  {t("selectInvoices")}
                </Button>
              )}
            </div>
            <ApDetailGrid
              rows={receipt.allocations}
              empty={t("noAllocations")}
              columns={[
                {
                  id: "sequence",
                  header: "#",
                  size: 45,
                  cell: ({ row }) => row.index + 1,
                },
                {
                  accessorKey: "number",
                  header: t("invoiceNo"),
                  cell: ({ row }) =>
                    row.original.id.startsWith("sample-") ? (
                      row.original.number
                    ) : (
                      <CellAction
                        onClick={() =>
                          navigate(
                            `/accounting/accounts-receivable/invoice/${row.original.id}`,
                          )
                        }
                      >
                        {row.original.number}
                      </CellAction>
                    ),
                },
                {
                  accessorKey: "date",
                  header: t("date"),
                  cell: ({ row }) => dates(row.original.date),
                },
                {
                  accessorKey: "outstanding",
                  header: t("outstanding"),
                  meta: {
                    cellClassName: "text-right tabular-nums",
                    headerClassName: "text-right",
                  },
                  cell: ({ row }) => money(row.original.outstanding),
                },
                {
                  accessorKey: "amount",
                  header: t("appliedAmount"),
                  size: 160,
                  meta: {
                    cellClassName: "text-right tabular-nums",
                    headerClassName: "text-right",
                  },
                  cell: ({ row }) =>
                    readonly ? (
                      money(row.original.amount)
                    ) : (
                      <FieldInput
                        type="number"
                        min="0"
                        step="0.01"
                        max={row.original.outstanding}
                        aria-label={`${t("appliedAmount")} ${row.original.number}`}
                        value={row.original.amount}
                        className="min-w-28 text-right tabular-nums"
                        onChange={(event) =>
                          set(
                            "allocations",
                            receipt.allocations.map((line) =>
                              line.id === row.original.id
                                ? {
                                    ...line,
                                    amount: Number(event.target.value),
                                  }
                                : line,
                            ),
                          )
                        }
                      />
                    ),
                },
                {
                  id: "remaining",
                  header: t("remaining"),
                  meta: { cellClassName: "text-right tabular-nums" },
                  cell: ({ row }) =>
                    money(row.original.outstanding - row.original.amount),
                },
                ...(!readonly
                  ? [
                      {
                        id: "remove",
                        size: 45,
                        cell: ({
                          row,
                        }: {
                          row: { original: ArReceipt["allocations"][number] };
                        }) => (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={DESTRUCTIVE_ACTION}
                            aria-label={t("removeInvoice", {
                              number: row.original.number,
                            })}
                            onClick={() =>
                              set(
                                "allocations",
                                receipt.allocations.filter(
                                  (line) => line.id !== row.original.id,
                                ),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <p className="text-muted-foreground text-xs">
              {t("allocationHint")}
            </p>
          </TabsContent>
          <TabsContent value="tax" className="min-w-0 space-y-4">
            <div className="grid grid-cols-1 gap-4 @xl/receipt:grid-cols-4">
              <Field className="@xl/receipt:col-span-2">
                <FieldLabel htmlFor="receipt-registered-name">
                  {t("registeredName")}
                </FieldLabel>
                {readonly ? (
                  <FieldPlainText>
                    {receipt.taxEntity.registeredName || "—"}
                  </FieldPlainText>
                ) : (
                  <FieldInput
                    id="receipt-registered-name"
                    value={receipt.taxEntity.registeredName}
                    maxLength={255}
                    onChange={(event) =>
                      changeTax("registeredName", event.target.value)
                    }
                  />
                )}
              </Field>
              {(["taxId", "branchNo"] as const).map((key) => (
                <Field key={key}>
                  <FieldLabel htmlFor={`receipt-${key}`}>{t(key)}</FieldLabel>
                  {readonly ? (
                    <FieldPlainText>
                      {receipt.taxEntity[key] || "—"}
                    </FieldPlainText>
                  ) : (
                    <FieldInput
                      id={`receipt-${key}`}
                      value={receipt.taxEntity[key]}
                      inputMode="numeric"
                      maxLength={key === "taxId" ? 13 : 5}
                      hideCounter
                      onChange={(event) => changeTax(key, event.target.value)}
                    />
                  )}
                </Field>
              ))}
              {(
                ["address1", "address2", "province", "postalCode"] as const
              ).map((key) => (
                <Field
                  key={key}
                  className={
                    key.startsWith("address") ? "@xl/receipt:col-span-2" : ""
                  }
                >
                  <FieldLabel htmlFor={`receipt-${key}`}>{t(key)}</FieldLabel>
                  {readonly ? (
                    <FieldPlainText>
                      {receipt.taxEntity[key] || "—"}
                    </FieldPlainText>
                  ) : (
                    <FieldInput
                      id={`receipt-${key}`}
                      value={receipt.taxEntity[key]}
                      maxLength={
                        key === "postalCode"
                          ? 5
                          : key === "province"
                            ? 100
                            : 255
                      }
                      onChange={(event) => changeTax(key, event.target.value)}
                    />
                  )}
                </Field>
              ))}
              <Field>
                <FieldLabel>{t("taxDate")}</FieldLabel>
                <FieldDatePicker
                  className="w-full"
                  value={receipt.taxDate}
                  onValueChange={(value) =>
                    set("taxDate", isoToDateInput(value))
                  }
                  readOnly={readonly}
                  hideClear
                />
              </Field>
            </div>
            <ApDetailGrid
              rows={receipt.allocations}
              empty={t("noTaxLines")}
              columns={[
                {
                  id: "sequence",
                  header: "#",
                  cell: ({ row }) => row.index + 1,
                },
                { accessorKey: "number", header: t("invoiceNo") },
                { id: "taxType", header: t("taxType"), cell: () => "VAT" },
                {
                  id: "base",
                  header: t("taxBaseTHB"),
                  cell: ({ row }) =>
                    money(
                      receiptAllocationTax(row.original, receipt.rate).base,
                    ),
                  meta: { cellClassName: "text-right tabular-nums" },
                },
                {
                  id: "rate",
                  header: t("taxRate"),
                  cell: ({ row }) =>
                    `${receiptAllocationTax(row.original, receipt.rate).rate}%`,
                },
                {
                  id: "tax",
                  header: t("taxAmountTHB"),
                  cell: ({ row }) =>
                    money(receiptAllocationTax(row.original, receipt.rate).tax),
                  meta: { cellClassName: "text-right tabular-nums" },
                },
                {
                  id: "total",
                  header: t("totalTHB"),
                  cell: ({ row }) =>
                    money(
                      receiptAllocationTax(row.original, receipt.rate).total,
                    ),
                  meta: { cellClassName: "text-right tabular-nums" },
                },
              ]}
            />
            <p className="text-muted-foreground text-xs">{t("taxHint")}</p>
          </TabsContent>
          <TabsContent value="receipt" className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">{t("paymentLines")}</h2>
              {!readonly && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setPaymentEditor(
                      newReceiptPayment(
                        receipt.date,
                        receipt.defaultPaymentType,
                      ),
                    )
                  }
                >
                  <Plus />
                  {t("addPayment")}
                </Button>
              )}
            </div>
            <ApDetailGrid
              rows={receipt.payments}
              empty={t("noPayments")}
              columns={[
                {
                  id: "sequence",
                  header: "#",
                  cell: ({ row }) => row.index + 1,
                },
                {
                  accessorKey: "type",
                  header: t("payType"),
                  cell: ({ row }) =>
                    readonly ? (
                      t(`payTypes.${row.original.type}`)
                    ) : (
                      <CellAction
                        onClick={() => setPaymentEditor(row.original)}
                      >
                        {t(`payTypes.${row.original.type}`)}
                      </CellAction>
                    ),
                },
                {
                  accessorKey: "date",
                  header: t("paymentDate"),
                  cell: ({ row }) => dates(row.original.date),
                },
                { accessorKey: "reference", header: t("reference") },
                { accessorKey: "bank", header: t("bank") },
                { accessorKey: "chequeNo", header: t("chequeNo") },
                { accessorKey: "accountLabel", header: t("cashBankAccount") },
                {
                  accessorKey: "amount",
                  header: t("receivedAmount"),
                  meta: {
                    cellClassName: "text-right tabular-nums",
                    headerClassName: "text-right",
                  },
                  cell: ({ row }) => money(row.original.amount),
                },
                ...(!readonly
                  ? [
                      {
                        id: "remove",
                        size: 45,
                        cell: ({
                          row,
                        }: {
                          row: { original: ReceiptPayment };
                        }) => (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className={DESTRUCTIVE_ACTION}
                            aria-label={t("removePayment")}
                            onClick={() =>
                              set(
                                "payments",
                                receipt.payments.filter(
                                  (line) => line.id !== row.original.id,
                                ),
                              )
                            }
                          >
                            <Trash2 />
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <div className="grid grid-cols-1 gap-4 @xl/receipt:grid-cols-4">
              <Field>
                <FieldLabel>{tp("whtService")}</FieldLabel>
                {readonly ? (
                  <FieldPlainText>
                    {tp(`wht${receipt.whtService}`)}
                  </FieldPlainText>
                ) : (
                  <FieldSelect
                    value={receipt.whtService}
                    onValueChange={(value) =>
                      setReceipt((previous) => {
                        const next = { ...previous, whtService: value };
                        return {
                          ...next,
                          whtAmount: previous.whtEnabled
                            ? suggestedReceiptWht(next)
                            : 0,
                        };
                      })
                    }
                  >
                    <SelectContent>
                      {["NONE", "01", "02", "03", "04", "05"].map((value) => (
                        <SelectItem key={value} value={value}>
                          {tp(`wht${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </FieldSelect>
                )}
              </Field>
              <Field className="@xl/receipt:col-span-2">
                <FieldLabel htmlFor="receipt-wht-certificate">
                  {t("whtCertificate")}
                </FieldLabel>
                {readonly ? (
                  <FieldPlainText>
                    {receipt.whtCertificate || "—"}
                  </FieldPlainText>
                ) : (
                  <FieldInput
                    id="receipt-wht-certificate"
                    value={receipt.whtCertificate}
                    maxLength={100}
                    disabled={!receipt.whtEnabled}
                    onChange={(event) =>
                      set("whtCertificate", event.target.value)
                    }
                  />
                )}
              </Field>
            </div>
          </TabsContent>
          <TabsContent value="journal" className="min-w-0">
            <EmptyComponent
              title={t("journalUnavailable")}
              description={t("journalHint")}
            />
          </TabsContent>
        </Tabs>
        <SummaryFooterBar
          hasRecord
          items={[
            {
              key: "allocated",
              label: t("appliedAmount"),
              value: money(totals.allocated),
              suffix: receipt.currency,
            },
            {
              key: "received",
              label: t("receivedAmount"),
              value: money(totals.received),
              suffix: receipt.currency,
              emphasis: true,
            },
            {
              key: "wht",
              label: t("whtAmount"),
              value: money(totals.wht),
              suffix: receipt.currency,
            },
            {
              key: "difference",
              label: t("unapplied"),
              value: money(totals.unapplied),
              suffix: receipt.currency,
              valueClassName:
                totals.unapplied < 0 ? "text-destructive" : undefined,
            },
            {
              key: "base",
              label: t("baseReceived"),
              value: money(totals.baseReceived),
              suffix: "THB",
            },
          ]}
        >
          <Button
            type="button"
            size="sm"
            disabled
            title={t("submitUnavailable")}
          >
            <Send />
            {tc("submit")}
          </Button>
        </SummaryFooterBar>
      </form>
      {invoicePicker && (
        <ReceiptInvoiceDialog
          receipt={receipt}
          close={() => setInvoicePicker(false)}
          add={(allocation) => {
            set("allocations", [...receipt.allocations, allocation]);
            setInvoicePicker(false);
          }}
        />
      )}
      {paymentEditor && (
        <ReceiptPaymentDialog
          key={paymentEditor.id}
          payment={paymentEditor}
          currency={receipt.currency}
          close={() => setPaymentEditor(undefined)}
          save={(payment) => {
            set(
              "payments",
              receipt.payments.some((line) => line.id === payment.id)
                ? receipt.payments.map((line) =>
                    line.id === payment.id ? payment : line,
                  )
                : [...receipt.payments, payment],
            );
            setPaymentEditor(undefined);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
        title={t(`${confirmation ?? "cancel"}Confirm`)}
        description={
          confirmation === "cancel" ? t("discardHint") : t("mockActionHint")
        }
        variant={confirmation === "cancel" ? "default" : "destructive"}
        onConfirm={confirmAction}
      />
      <ConfirmDialog
        open={Boolean(pendingCustomer)}
        onOpenChange={(open) => {
          if (!open) setPendingCustomer(undefined);
        }}
        title={t("changeCustomerConfirm")}
        description={t("changeCustomerHint")}
        onConfirm={() => {
          if (pendingCustomer) applyCustomer(pendingCustomer);
        }}
      />
    </div>
  );
}
