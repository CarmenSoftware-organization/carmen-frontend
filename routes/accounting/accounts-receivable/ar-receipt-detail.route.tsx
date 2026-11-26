import { useState, type FormEvent } from "react";
import { Ban, Check, Copy, Plus, Send, Trash2, Undo2, X } from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
import { useClaimFormPrimary } from "@/components/share/form-primary-action";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/constant/permissions";
import { useBankAccounts } from "@/hooks/use-accounting-master";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useCurrencyAll } from "@/hooks/use-currency";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { formatDate, isoToDateInput } from "@/lib/date-utils";
import { isDraftDocNo } from "@/lib/draft-doc-no";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { SendBackFields } from "../shared/send-back-fields";
import { arActionsAllowed, arDocActions } from "./ar-doc-actions";
import { ArCustomerLookup } from "./ar-customer-lookup";
import { ReceiptInvoiceDialog } from "./ar-receipt-dialogs";
import { ReceiptJournal } from "./ar-receipt-journal";
import {
  AR_RECEIPT_PATH,
  newReceipt,
  newReceiptFromInvoice,
  receiptAllocationTax,
  receiptFromDocument,
  refreshCopyAllocations,
  receiptProfileDefaults,
  receiptTaxEntityFromCustomer,
  receiptTotals,
  receiptValidation,
  toArReceiptPayload,
  type ArReceipt,
  type ReceiptTaxEntity,
  type ReceiptTender,
} from "./ar-receipt-model";
import { ReceiptTenderSection, ReceiptWhtSection } from "./ar-receipt-tender";
import { readProfileExtension } from "./ar-profile-model";
import { useArCustomer, type ArCustomer } from "./use-ar-customer";
import {
  useArOutstandingInvoices,
  useArReceiptAction,
  useArReceiptPreviousStages,
  useArReceiptDocument,
  useCreateArReceipt,
  useDeleteArReceipt,
  useUpdateArReceipt,
  type ArReceiptDocument,
} from "./use-ar-receipt";
import type { ArRegisterDocument } from "./use-ar-register";

const FORM_ID = "ar-receipt-form";
const DESTRUCTIVE_ACTION =
  "text-destructive hover:bg-destructive/10 hover:text-destructive";

export function Component() {
  const bu = useBuCode();
  const { id = "new" } = useParams();
  return bu ? <ReceiptDetail key={`${bu}:${id}`} id={id} /> : null;
}

function ReceiptDetail({ id }: { readonly id: string }) {
  const t = useTranslations("accounting.arReceipt");
  const location = useLocation();
  const { defaultCurrencyCode } = useProfile();
  const currencies = useCurrencyAll();
  const isNew = id === "new";
  const doc = useArReceiptDocument(isNew ? undefined : id);
  // the receipt's own reservations are excluded so the cap and invoice numbers are restorable
  const outstanding = useArOutstandingInvoices(
    doc.data?.customer_id,
    doc.data?.currency_id,
    isNew ? undefined : id,
    // balances only matter while the receipt can still change; after that they would show today's figures
    doc.data?.doc_status === "draft",
  );
  const state = (isNew ? location.state : null) as {
    receiptInvoice?: ArRegisterDocument;
    receiptCopy?: ArReceipt;
  } | null;
  const copySource = state?.receiptCopy;
  // a copy takes its caps from the live balances, not from the original applied amounts
  const copyOutstanding = useArOutstandingInvoices(
    copySource?.customerId,
    copySource?.currencyId,
    undefined,
    !!copySource && copySource.allocations.length > 0,
  );
  if (isNew) {
    if (
      copySource &&
      copySource.allocations.length > 0 &&
      copyOutstanding.isLoading
    )
      return <Skeleton className="h-40 w-full" />;
    const source = state?.receiptInvoice;
    const today = isoToDateInput(new Date().toISOString());
    const currencyId = (code: string) =>
      currencies.data?.find((row) => row.code === code)?.id ?? "";
    const receipt = copySource
      ? copyOutstanding.data
        ? refreshCopyAllocations(copySource, copyOutstanding.data)
        : { ...copySource, allocations: [] }
      : source
        ? newReceiptFromInvoice(source, today)
        : newReceipt(
            today,
            defaultCurrencyCode,
            currencyId(defaultCurrencyCode),
          );
    return (
      <ReceiptForm
        key={`new:${receipt.currencyId}`}
        initial={receipt}
        isNew
        document={undefined}
        outstandingFailed={!!copySource && copyOutstanding.isError}
      />
    );
  }
  if (doc.isPending || (doc.data && outstanding.isLoading))
    return <Skeleton className="h-40 w-full" />;
  if (doc.error || !doc.data)
    return (
      <ErrorState
        error={doc.error}
        notFoundMessage={t("receiptNotFound")}
        backTo={AR_RECEIPT_PATH}
        onRetry={() => doc.refetch()}
      />
    );
  return (
    <ReceiptForm
      key={`${doc.data.id}:${doc.data.doc_version}:${doc.data.doc_status}`}
      initial={receiptFromDocument(doc.data, outstanding.data)}
      isNew={false}
      document={doc.data}
      outstandingFailed={outstanding.isError}
    />
  );
}

function ReceiptForm({
  initial,
  isNew,
  document,
  outstandingFailed,
}: {
  readonly initial: ArReceipt;
  readonly isNew: boolean;
  readonly document: ArReceiptDocument | undefined;
  /** outstanding list failed to load: caps fall back to the applied amount */
  readonly outstandingFailed: boolean;
}) {
  const bu = useBuCode() ?? "";
  const t = useTranslations("accounting.arReceipt");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const navigate = useNavigate();
  const { dateFormat, defaultCurrencyCode, userId } = useProfile();
  const { canWrite, can } = useCan();
  const currencies = useCurrencyAll();
  const bankAccounts = useBankAccounts().data ?? [];
  const create = useCreateArReceipt();
  const update = useUpdateArReceipt();
  const remove = useDeleteArReceipt();
  const action = useArReceiptAction();
  const [receiptDraft, setReceipt] = useState(initial);
  const [defaultsCustomerId, setDefaultsCustomerId] = useState(
    isNew ? initial.customerId || undefined : undefined,
  );
  const [taxEdited, setTaxEdited] = useState(!isNew);
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
  const [confirmation, setConfirmation] = useState<
    "delete" | "submit" | "cancel" | null
  >(null);
  const [voidOpen, setVoidOpen] = useState(false);
  const [workflowDialog, setWorkflowDialog] = useState<
    "approve" | "sendback" | "reject" | null
  >(null);
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("");
  const sendingBack = workflowDialog === "sendback";
  const stagesQuery = useArReceiptPreviousStages(document?.id, sendingBack);
  const [pendingCustomer, setPendingCustomer] = useState<ArCustomer>();
  const [error, setError] = useState("");
  const totals = receiptTotals(receipt);
  const isDraft = receipt.status === "draft";
  const readonly = !editing || !canWrite;
  const busy =
    create.isPending ||
    update.isPending ||
    remove.isPending ||
    action.isPending;
  const dirty = editing && JSON.stringify(receipt) !== JSON.stringify(baseline);
  useUnsavedChanges(dirty);
  const canSubmit =
    !isNew &&
    isDraft &&
    !editing &&
    canWrite &&
    can(PERMISSIONS.accounting.ar.view);
  useClaimFormPrimary(canSubmit);
  const set = <K extends keyof ArReceipt>(key: K, value: ArReceipt[K]) =>
    setReceipt((previous) => ({ ...previous, [key]: value }));
  const patchReceipt = (patch: Partial<ArReceipt>) =>
    setReceipt((previous) => ({ ...previous, ...patch }));
  // a bank account only fits the receipt currency or the base currency
  const tenderForCurrency = (tender: ReceiptTender, code: string) => {
    const bank = bankAccounts.find((row) => row.id === tender.bankAccountId);
    return !bank?.currency_code ||
      bank.currency_code === code ||
      bank.currency_code === defaultCurrencyCode
      ? tender
      : { ...tender, bankAccountId: "", bankAccountLabel: "" };
  };
  const patchTender = (patch: Partial<ReceiptTender>) =>
    setReceipt((previous) => ({
      ...previous,
      tender: { ...previous.tender, ...patch },
    }));
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
  const currencyIdOf = (code: string) =>
    currencies.data?.find((row) => row.code === code)?.id ?? "";

  function applyCustomer(value: ArCustomer) {
    const code = value.default_currency_code ?? receipt.currency;
    setReceipt((previous) => ({
      ...previous,
      customerId: value.id,
      customerCode: value.code,
      customerName: value.name,
      currency: code,
      currencyId: currencyIdOf(code) || previous.currencyId,
      rate: code === defaultCurrencyCode ? 1 : previous.rate,
      allocations: [],
      whtAmount: 0,
      whtBase: 0,
      whtCertificate: "",
      source: "manual",
      sourceDoc: "",
      taxEntity: receiptTaxEntityFromCustomer(value),
      tender: {
        ...tenderForCurrency(previous.tender, code),
        method: receiptProfileDefaults(readProfileExtension(bu, value.id))
          .defaultPaymentType,
        amount: 0,
        charge: 0,
      },
    }));
    setTaxEdited(false);
    setDefaultsCustomerId(value.id);
    setPendingCustomer(undefined);
  }
  function changeCustomer(value?: ArCustomer) {
    if (!value || value.id === receipt.customerId) return;
    if (receipt.allocations.length || receipt.tender.amount > 0)
      setPendingCustomer(value);
    else applyCustomer(value);
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !editing || busy) return;
    if (!taxEdited && customerDefaults.isLoading) return;
    const invalid = receiptValidation(receipt);
    if (invalid) {
      setError(t(invalid));
      return;
    }
    setError("");
    const payload = toArReceiptPayload(receipt);
    if (isNew)
      create.mutate(payload, {
        onSuccess: (response) => {
          setEditing(false);
          setBaseline(receipt);
          toast.success(t("saved"));
          navigate(`${AR_RECEIPT_PATH}/${response.data.id}`, { replace: true });
        },
      });
    else
      update.mutate(
        { id: receipt.id, ...payload },
        {
          onSuccess: () => {
            setEditing(false);
            toast.success(t("saved"));
          },
        },
      );
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
    if (confirmation === "delete")
      remove.mutate(receipt.id, {
        onSuccess: () => {
          toast.success(t("deleted"));
          navigate(AR_RECEIPT_PATH);
        },
      });
    else if (confirmation === "submit")
      action.mutate(
        {
          id: receipt.id,
          action: "submit",
          doc_version: receipt.version ?? undefined,
        },
        {
          onSuccess: () => {
            toast.success(t("submitted"));
            setConfirmation(null);
          },
          onError: () => setConfirmation(null),
        },
      );
    else cancel();
  }
  function voidReceipt() {
    action.mutate(
      {
        id: receipt.id,
        action: "void",
        doc_version: receipt.version ?? undefined,
        reason: reason.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("voided"));
          setVoidOpen(false);
          setReason("");
        },
      },
    );
  }
  function closeWorkflowDialog() {
    setWorkflowDialog(null);
    setReason("");
    setStage("");
  }
  function workflowAction() {
    if (!workflowDialog || !canWrite) return;
    const note = reason.trim();
    action.mutate(
      {
        id: receipt.id,
        action: sendingBack ? "review" : workflowDialog,
        doc_version: receipt.version ?? undefined,
        ...(workflowDialog === "reject" && { reason: note }),
        ...(sendingBack && { stage, ...(note && { reason: note }) }),
      },
      {
        onSuccess: () => {
          toast.success(
            t(
              workflowDialog === "approve"
                ? "approved"
                : sendingBack
                  ? "sentBack"
                  : "rejected",
            ),
          );
          closeWorkflowDialog();
        },
      },
    );
  }
  function copy() {
    navigate(`${AR_RECEIPT_PATH}/new`, {
      state: {
        receiptCopy: {
          ...receipt,
          id: crypto.randomUUID(),
          number: "",
          version: null,
          status: "draft" as const,
          source: "copy" as const,
          sourceDoc: receipt.number,
          taxInvoiceNo: "",
        },
      },
    });
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
  // in_review → backend allowed_actions only (no void/delete); everything ANDed with canWrite
  const actions =
    !isNew && canWrite && !editing && document
      ? arActionsAllowed(
          arDocActions({
            doc_status: receipt.status,
            doc_no: receipt.number,
            allowed_actions: document.allowed_actions,
          }),
          can,
        )
      : [];
  const canVoid = actions.includes("void");
  const canDelete = actions.includes("delete");
  const inReview = receipt.status === "in_review";
  // creator is a stage actor (can reject / send back) but cannot approve → say why
  const showCreatorHint =
    inReview &&
    !editing &&
    !!userId &&
    !!document &&
    document.created_by_id === userId &&
    !document.allowed_actions.includes("approve") &&
    document.allowed_actions.length > 0;
  const sameAsBase = receipt.currency === defaultCurrencyCode;

  return (
    <div className="@container/receipt flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-4">
      <FormToolbar
        title={receipt.number || t("newReceipt")}
        mode={editing ? (isNew ? "add" : "edit") : "view"}
        formId={FORM_ID}
        isPending={create.isPending || update.isPending}
        writeDisabledReason={
          editing && !taxEdited && customerDefaults.isLoading
            ? tc("loading")
            : undefined
        }
        flush
        badges={
          <>
            <StatusChip
              status={receipt.status}
              label={t(`statuses.${receipt.status}`)}
            />
            {inReview && document?.workflow_current_stage && (
              <span className="text-muted-foreground text-xs">
                {t("stageLabel", { stage: document.workflow_current_stage })}
              </span>
            )}
          </>
        }
        onBack={() =>
          dirty ? setConfirmation("cancel") : navigate(AR_RECEIPT_PATH)
        }
        onCancel={() => (dirty ? setConfirmation("cancel") : cancel())}
        onEdit={
          !editing && isDraft && !isNew ? () => setEditing(true) : undefined
        }
        onDelete={
          !editing && canDelete ? () => setConfirmation("delete") : undefined
        }
        deleteIsPending={remove.isPending}
        submitLabel={tc("saveDraft")}
      >
        {!editing && !isNew && (
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
        )}
        {actions.includes("approve") && (
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() => setWorkflowDialog("approve")}
            title={t("approve")}
          >
            <Check />
            <ToolbarLabel>{t("approve")}</ToolbarLabel>
          </Button>
        )}
        {actions.includes("sendback") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => setWorkflowDialog("sendback")}
            title={t("sendBack")}
          >
            <Undo2 />
            <ToolbarLabel>{t("sendBack")}</ToolbarLabel>
          </Button>
        )}
        {actions.includes("reject") && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={DESTRUCTIVE_ACTION}
            disabled={busy}
            onClick={() => setWorkflowDialog("reject")}
            title={t("reject")}
          >
            <X />
            <ToolbarLabel>{t("reject")}</ToolbarLabel>
          </Button>
        )}
        {showCreatorHint && (
          <span className="text-muted-foreground text-xs">
            {t("creatorCannotApproveHint")}
          </span>
        )}
        {canVoid && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={DESTRUCTIVE_ACTION}
            onClick={() => setVoidOpen(true)}
            title={t("void")}
          >
            <Ban />
            <ToolbarLabel>{t("void")}</ToolbarLabel>
          </Button>
        )}
      </FormToolbar>
      <form
        id={FORM_ID}
        onSubmit={save}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
      >
        <div className="grid grid-cols-1 gap-x-4 gap-y-3 border-b pb-4 @xl/receipt:grid-cols-4 @4xl/receipt:grid-cols-8">
          <Field className="@xl/receipt:col-span-2">
            <FieldLabel>{t("number")}</FieldLabel>
            <FieldPlainText>{receipt.number || t("autoNumber")}</FieldPlainText>
            {isDraftDocNo(receipt.number) && (
              <p className="text-muted-foreground text-xs">
                {t("draftNumberHint")}
              </p>
            )}
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
                disabled={receipt.allocations.length > 0}
                onValueChange={(value) =>
                  setReceipt((previous) => ({
                    ...previous,
                    currency: value,
                    currencyId: currencyIdOf(value),
                    rate: value === defaultCurrencyCode ? 1 : previous.rate,
                    tender: tenderForCurrency(previous.tender, value),
                  }))
                }
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
            {readonly || sameAsBase ? (
              <FieldPlainText className="tabular-nums">
                {receipt.rate.toFixed(5)}
              </FieldPlainText>
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
            {sameAsBase && !readonly && (
              <p className="text-muted-foreground text-xs">
                {t("rateReadOnlyHint")}
              </p>
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
          <Field className="min-w-0 @xl/receipt:col-span-4">
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
        </div>
        {outstandingFailed && (
          <p role="alert" className="text-warning-ink text-xs">
            {t("outstandingLoadError")}
          </p>
        )}
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
        <Tabs defaultValue="items" className="min-h-0 min-w-0 flex-1">
          <div className="min-w-0 shrink-0 overflow-x-auto overflow-y-hidden pb-1">
            <TabsList variant="line">
              <TabsTrigger value="items">{t("tabs.items")}</TabsTrigger>
              <TabsTrigger value="receipt">{t("tabs.receipt")}</TabsTrigger>
              <TabsTrigger value="tax">{t("tabs.tax")}</TabsTrigger>
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
                  cell: ({ row }) => (
                    <CellAction
                      onClick={() =>
                        navigate(
                          `/accounts-receivable/invoice/${row.original.id}`,
                        )
                      }
                    >
                      {row.original.number || "—"}
                    </CellAction>
                  ),
                },
                {
                  accessorKey: "date",
                  header: t("date"),
                  cell: ({ row }) => dates(row.original.date),
                },
                ...(isDraft
                  ? [
                      {
                        accessorKey: "outstanding",
                        header: t("outstanding"),
                        meta: {
                          cellClassName: "text-right tabular-nums",
                          headerClassName: "text-right",
                        },
                        cell: ({
                          row,
                        }: {
                          row: { original: ArReceipt["allocations"][number] };
                        }) => money(row.original.outstanding),
                      },
                    ]
                  : []),
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
                ...(isDraft
                  ? [
                      {
                        id: "remaining",
                        header: t("remaining"),
                        meta: { cellClassName: "text-right tabular-nums" },
                        cell: ({
                          row,
                        }: {
                          row: { original: ArReceipt["allocations"][number] };
                        }) =>
                          money(row.original.outstanding - row.original.amount),
                      },
                    ]
                  : []),
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
          <TabsContent value="receipt" className="min-w-0 space-y-5">
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{t("tender")}</h2>
              <ReceiptTenderSection
                receipt={receipt}
                readonly={readonly}
                baseCurrency={defaultCurrencyCode}
                patch={patchTender}
              />
            </section>
            <section className="space-y-3">
              <h2 className="text-sm font-semibold">{t("whtSection")}</h2>
              <ReceiptWhtSection
                receipt={receipt}
                readonly={readonly}
                set={patchReceipt}
              />
            </section>
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
          <TabsContent value="journal" className="min-w-0">
            <ReceiptJournal
              jvId={document?.gl_jv_id}
              jvNo={document?.gl_jv_no}
              voidJvId={document?.void_gl_jv_id}
              currency={receipt.currency}
            />
          </TabsContent>
        </Tabs>
        {totals.unapplied > 0 && (
          <p role="status" className="text-warning-ink text-xs">
            {t("unappliedHint")}
          </p>
        )}
        <SummaryFooterBar
          hasRecord
          items={[
            {
              key: "applied",
              label: t("appliedAmount"),
              value: money(totals.applied),
              suffix: receipt.currency,
            },
            {
              key: "received",
              label: t("receivedAmount"),
              value: money(totals.received),
              suffix: receipt.currency,
            },
            {
              key: "wht",
              label: t("whtAmount"),
              value: money(totals.wht),
              suffix: receipt.currency,
            },
            {
              key: "charge",
              label: t("bankCharge"),
              value: money(totals.charge),
              suffix: receipt.currency,
            },
            {
              key: "unapplied",
              label: t("unapplied"),
              value: money(totals.unapplied),
              suffix: receipt.currency,
              emphasis: true,
              valueClassName:
                totals.unapplied < 0 ? "text-destructive" : undefined,
            },
          ]}
        >
          {canSubmit && (
            <Button
              type="button"
              size="sm"
              disabled={busy || receipt.version === null}
              onClick={() => setConfirmation("submit")}
            >
              <Send />
              {tc("submit")}
            </Button>
          )}
        </SummaryFooterBar>
      </form>
      {invoicePicker && (
        <ReceiptInvoiceDialog
          customerId={receipt.customerId}
          customerName={receipt.customerName}
          currency={receipt.currency}
          currencyId={receipt.currencyId}
          receiptId={isNew ? undefined : receipt.id}
          selectedIds={receipt.allocations.map((line) => line.id)}
          close={() => setInvoicePicker(false)}
          onAdd={(allocations) => {
            set("allocations", [...receipt.allocations, ...allocations]);
            setInvoicePicker(false);
          }}
        />
      )}
      <ConfirmDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !busy) setConfirmation(null);
        }}
        title={t(`${confirmation ?? "cancel"}Confirm`)}
        description={
          confirmation === "cancel"
            ? t("discardHint")
            : confirmation === "submit"
              ? t("submitHint")
              : t("deleteHint")
        }
        variant={confirmation === "delete" ? "destructive" : "default"}
        onConfirm={confirmAction}
      />
      <Dialog
        open={voidOpen}
        onOpenChange={(open) => {
          if (!open && !action.isPending) {
            setVoidOpen(false);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("voidConfirm")}</DialogTitle>
            <DialogDescription>
              {receipt.status === "posted"
                ? t("voidPostedHint")
                : t("voidDraftHint")}
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="receipt-void-reason" required>
              {t("voidReason")}
            </FieldLabel>
            <Textarea
              id="receipt-void-reason"
              value={reason}
              maxLength={255}
              onChange={(event) => setReason(event.target.value)}
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={action.isPending}
              onClick={() => {
                setVoidOpen(false);
                setReason("");
              }}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={action.isPending || !reason.trim()}
              onClick={voidReceipt}
            >
              {t("void")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={workflowDialog !== null}
        onOpenChange={(open) => {
          if (!open && !action.isPending) closeWorkflowDialog();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {workflowDialog
                ? t(sendingBack ? "sendBackTitle" : `${workflowDialog}Title`)
                : ""}
            </DialogTitle>
            {!sendingBack && workflowDialog && (
              <DialogDescription>
                {t(`${workflowDialog}Confirm`, { number: receipt.number })}
              </DialogDescription>
            )}
          </DialogHeader>
          {sendingBack && (
            <SendBackFields
              labels={{
                stage: t("sendBackStage"),
                stagePlaceholder: t("sendBackStagePlaceholder"),
                stagesError: t("sendBackStagesError"),
                noStages: t("sendBackNoStages"),
              }}
              stage={stage}
              onStageChange={setStage}
              stages={stagesQuery.data ?? []}
              isLoading={stagesQuery.isLoading}
              isError={stagesQuery.isError}
            />
          )}
          {(workflowDialog === "reject" || sendingBack) && (
            <Field>
              <FieldLabel
                htmlFor="receipt-workflow-reason"
                required={workflowDialog === "reject"}
              >
                {sendingBack ? t("sendBackNote") : t("rejectReason")}
              </FieldLabel>
              <Textarea
                id="receipt-workflow-reason"
                value={reason}
                maxLength={255}
                onChange={(event) => setReason(event.target.value)}
              />
              {workflowDialog === "reject" && !reason.trim() && (
                <p className="text-muted-foreground text-xs">
                  {t("rejectReasonRequired")}
                </p>
              )}
            </Field>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={action.isPending}
              onClick={closeWorkflowDialog}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant={workflowDialog === "reject" ? "destructive" : "default"}
              disabled={
                action.isPending ||
                (workflowDialog === "reject" && !reason.trim()) ||
                (sendingBack && !stage)
              }
              onClick={workflowAction}
            >
              {workflowDialog
                ? t(sendingBack ? "sendBack" : workflowDialog)
                : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
