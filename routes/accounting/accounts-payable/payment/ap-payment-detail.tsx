import { useState } from "react";
import {
  Ban,
  Check,
  FileClock,
  MoreHorizontal,
  Paperclip,
  Plus,
  Save,
  Send,
  Undo2,
  X,
} from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { WorkflowTrack } from "@/components/share/workflow-track";
import { Button } from "@/components/ui/button";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  ApInvoice,
  ApPayment,
  ApPaymentApplication,
  ApPaymentInput,
} from "@/types/accounts-payable";
import {
  addDecimal,
  compareDecimal,
  divideDecimal,
  multiplyDecimal,
  percentOf,
  subtractDecimal,
} from "../shared/ap-decimal";
import { PaymentSections } from "./ap-payment-sections";
import { paymentSummary } from "./ap-payment-totals";
import { ApStatusBadge, Money } from "../shared/ap-ui";
import {
  useApInvoices,
  useApPayment,
  useApPaymentAction,
  useSaveApPayment,
} from "../shared/use-accounts-payable";

const today = () => new Date().toISOString().slice(0, 10);
const Field = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <label className={`grid gap-1 text-sm ${className}`}>
    <span className="text-muted-foreground text-xs">{label}</span>
    {children}
  </label>
);
const applicationFromInvoice = (invoice: ApInvoice): ApPaymentApplication => {
  const rate = invoice.lines[0]?.wht_rate ?? "3";
  const whtBase = divideDecimal(
    multiplyDecimal(invoice.net_amount, invoice.open_amount),
    invoice.total_amount,
  );
  const whtAmount = percentOf(whtBase, rate);
  return {
    id: crypto.randomUUID(),
    invoice_id: invoice.id,
    invoice_no: invoice.ap_no,
    vendor_invoice_no: invoice.vendor_invoice_no,
    po_no: invoice.lines[0]?.po_no ?? null,
    grn_no: invoice.lines[0]?.grn_no ?? null,
    original_amount: invoice.total_amount,
    open_amount: invoice.open_amount,
    apply_amount: invoice.open_amount,
    wht_base: whtBase,
    wht_rate: rate,
    wht_amount: whtAmount,
    net_cash: subtractDecimal(invoice.open_amount, whtAmount),
    match_status: invoice.match_status,
    invoice_date: invoice.invoice_date,
    due_date: invoice.due_date ?? undefined,
    description: invoice.description,
    original_rate: invoice.exchange_rate,
    net_amount: invoice.net_amount,
    vat_amount: invoice.vat_amount,
    tax_status: invoice.tax_status,
    undue_vat_base:
      invoice.tax_status === "confirmed" || invoice.tax_status === "filed"
        ? "0"
        : subtractDecimal(
            multiplyDecimal(invoice.vat_amount, invoice.exchange_rate),
            invoice.claimed_vat_base ?? "0",
          ),
  };
};
const initialPaymentForm = (
  loaded: ApPayment | null | undefined,
  invoices: ApInvoice[],
  selectedIds: string[],
): ApPaymentInput => {
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));
  if (loaded)
    return {
      vendor_id: loaded.vendor_id,
      vendor_name: loaded.vendor_name,
      payment_date: loaded.payment_date,
      due_date: loaded.due_date,
      currency_code: loaded.currency_code,
      exchange_rate: loaded.exchange_rate,
      payment_method: loaded.payment_method,
      bank_account_masked: loaded.bank_account_masked,
      payment_reference: loaded.payment_reference,
      description: loaded.description,
      urgent: loaded.urgent,
      workflow_enabled: loaded.workflow_enabled,
      applications: loaded.applications.map((item) => {
        const invoice = invoiceById.get(item.invoice_id);
        return invoice ? { ...applicationFromInvoice(invoice), ...item } : item;
      }),
      wht_services: loaded.wht_services,
      paid_date: loaded.paid_date ?? loaded.payment_date,
      payment_methods: loaded.payment_methods,
      other_expenses: loaded.other_expenses ?? [],
      tax_invoices: loaded.tax_invoices ?? [],
      tax_allocations: loaded.tax_allocations ?? [],
      wht_form: loaded.wht_form ?? "PND53",
      wht_tax_id: loaded.wht_tax_id ?? "",
      wht_branch: loaded.wht_branch ?? "00000",
      wht_address: loaded.wht_address ?? "",
    };
  const selection = new Set(selectedIds);
  const selected = invoices.filter((invoice) => selection.has(invoice.id));
  const first = selected[0];
  const grouped = first
    ? selected.filter(
        (invoice) =>
          invoice.vendor_id === first.vendor_id &&
          invoice.currency_code === first.currency_code,
      )
    : [];
  return {
    vendor_id: first?.vendor_id ?? "",
    vendor_name: first?.vendor_name ?? "",
    payment_date: today(),
    paid_date: today(),
    due_date: today(),
    currency_code: first?.currency_code ?? "THB",
    exchange_rate: first?.exchange_rate ?? "1",
    payment_method: "bank_transfer",
    bank_account_masked: "•••• 8821",
    payment_reference: "",
    description: "",
    urgent: false,
    workflow_enabled: true,
    applications: grouped.map(applicationFromInvoice),
    wht_services: grouped.map(applicationFromInvoice),
  };
};

export default function ApPaymentDetail() {
  const { id = "new" } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const query = useApPayment(id);
  const invoices = useApInvoices();
  if (query.isLoading || invoices.isLoading)
    return <Skeleton className="h-[70vh] rounded-lg" />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        message="Unable to load AP payment"
        onRetry={() => void query.refetch()}
      />
    );
  if (id !== "new" && !query.data)
    return (
      <ErrorState
        notFoundMessage="Payment not found"
        backTo="/accounting/accounts-payable/payment"
      />
    );
  if (invoices.isError)
    return (
      <ErrorState
        error={invoices.error}
        message="Unable to load eligible invoices"
        onRetry={() => void invoices.refetch()}
      />
    );
  const selectedIds = (params.get("invoice_ids") ?? "")
    .split(",")
    .filter(Boolean);
  return (
    <ApPaymentEditor
      key={`${id}:${query.data?.doc_version ?? 0}:${selectedIds.join(",")}`}
      id={id}
      loaded={query.data}
      eligibleInvoices={invoices.data?.data ?? []}
      selectedIds={selectedIds}
      approvalContext={params.get("context") === "approval"}
    />
  );
}

function ApPaymentEditor({
  id,
  loaded,
  eligibleInvoices,
  selectedIds,
  approvalContext,
}: {
  id: string;
  loaded?: ApPayment | null;
  eligibleInvoices: ApInvoice[];
  selectedIds: string[];
  approvalContext: boolean;
}) {
  const navigate = useNavigate();
  const saveMutation = useSaveApPayment();
  const actionMutation = useApPaymentAction();
  const [editing, setEditing] = useState(id === "new");
  const [activeTab, setActiveTab] = useState("invoices");
  const [confirmation, setConfirmation] = useState<
    "submit" | "approve" | "void" | "reject" | "clarify" | null
  >(null);
  const [reason, setReason] = useState("");
  const busy = saveMutation.isPending || actionMutation.isPending;
  const [sheet, setSheet] = useState<"attachments" | "activity" | null>(null);
  const [form, setForm] = useState<ApPaymentInput>(() =>
    initialPaymentForm(loaded, eligibleInvoices, selectedIds),
  );
  const applications = form.applications;
  const applied = addDecimal(applications.map((item) => item.apply_amount));
  const wht = addDecimal(applications.map((item) => item.wht_amount));
  const summary = paymentSummary(form);
  const journalDebit = addDecimal(summary.journal.map((row) => row.debit));
  const journalCredit = addDecimal(summary.journal.map((row) => row.credit));
  const journalVariance = subtractDecimal(journalDebit, journalCredit);
  const netCash = summary.net_cash;
  const editable = id === "new" || (loaded?.capabilities.can_edit && editing);
  const addInvoice = (invoiceId: string) => {
    const invoice = eligibleInvoices.find((item) => item.id === invoiceId);
    if (!invoice || applications.some((item) => item.invoice_id === invoice.id))
      return;
    if (
      applications.length &&
      (invoice.vendor_id !== form.vendor_id ||
        invoice.currency_code !== form.currency_code)
    )
      return toast.error("Payments are grouped by vendor and currency");
    setForm({
      ...form,
      vendor_id: invoice.vendor_id,
      vendor_name: invoice.vendor_name,
      currency_code: invoice.currency_code,
      exchange_rate: applications.length
        ? form.exchange_rate
        : invoice.exchange_rate,
      applications: [...applications, applicationFromInvoice(invoice)],
    });
  };
  const save = async () => {
    try {
      const result = await saveMutation.mutateAsync({
        input: form,
        id: id === "new" ? undefined : id,
        docVersion: loaded?.doc_version,
      });
      toast.success("Payment saved");
      navigate(`/accounting/accounts-payable/payment/${result.id}`, {
        replace: true,
      });
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save payment",
      );
    }
  };
  const runAction = async (
    action: "submit" | "approve" | "return" | "reject" | "void" | "clarify",
  ) => {
    try {
      let target = loaded;
      if (!target || (action === "submit" && editing))
        target = await saveMutation.mutateAsync({
          input: form,
          id: loaded?.id,
          docVersion: loaded?.doc_version,
        });
      const result = await actionMutation.mutateAsync({
        id: target.id,
        action,
        docVersion: target.doc_version,
        reason,
        idempotencyKey:
          action === "submit" || action === "approve"
            ? `${action}:${target.id}:${target.doc_version}`
            : undefined,
      });
      toast.success(`Payment ${action} completed`);
      navigate(`/accounting/accounts-payable/payment/${result.id}`, {
        replace: true,
      });
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : `Unable to ${action}`,
      );
    }
  };
  return (
    <div className="flex w-full min-w-0 shrink-0 grow flex-col gap-5">
      <DocFormHeader
        title={loaded?.pv_no ?? "New Payment Voucher"}
        mock
        subtitle={approvalContext ? "Approval review" : "Supplier disbursement"}
        backLabel="Back to AP Payment Directory"
        onBack={() => navigate("/accounting/accounts-payable/payment")}
        actions={
          <>
            {loaded?.lifecycle === "submitted" && (
              <>
                <Button
                  size="sm"
                  disabled={busy || !loaded.capabilities.can_approve}
                  onClick={() => setConfirmation("approve")}
                >
                  <Check className="size-4" />
                  Approve & post
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || !loaded.capabilities.can_return}
                  onClick={() => setConfirmation("clarify")}
                >
                  <Undo2 className="size-4" />
                  Request clarification
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy || !loaded.capabilities.can_reject}
                  onClick={() => setConfirmation("reject")}
                >
                  <X className="size-4" />
                  Reject
                </Button>
              </>
            )}
            {loaded?.capabilities.can_edit && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (id === "new")
                      navigate("/accounting/accounts-payable/payment");
                    else {
                      setForm(
                        initialPaymentForm(
                          loaded,
                          eligibleInvoices,
                          selectedIds,
                        ),
                      );
                      setEditing(false);
                    }
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void save()}>
                  <Save className="size-4" /> Save
                </Button>
              </>
            )}
            {loaded?.capabilities.can_void && (
              <Button
                variant="ghost"
                size="sm"
                disabled={busy}
                onClick={() => setConfirmation("void")}
              >
                <Ban className="size-4" /> Void
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="size-4" />
                  More
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onSelect={() =>
                    navigate("/accounting/accounts-payable/payment/new")
                  }
                >
                  <Plus className="size-4" />
                  New
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSheet("attachments")}>
                  <Paperclip className="size-4" />
                  Attachments
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSheet("activity")}>
                  <FileClock className="size-4" />
                  Log
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {loaded?.lifecycle === "submitted" && (
        <div className="border-b pb-3">
          <WorkflowTrack
            previousStage="Prepared"
            currentStage={loaded.current_stage ?? "Approval"}
            nextStage="Posted"
          />
        </div>
      )}
      <section className="space-y-4 border-b pb-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Payment details</h2>
            <div className="flex gap-2">
              {loaded && (
                <>
                  <ApStatusBadge value={loaded.lifecycle} />
                  <ApStatusBadge value={loaded.execution_status} />
                </>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="PV no." className="order-1">
            <Input readOnly value={loaded?.pv_no ?? "Auto-generated"} />
          </Field>
          <Field label="Vendor" className="order-2 lg:col-span-2">
            <Input
              readOnly
              value={form.vendor_name || "Select invoice(s) below"}
            />
          </Field>
          <Field label="Payment date" className="order-3">
            <DatePicker
              value={form.payment_date}
              onValueChange={(value) =>
                setForm({ ...form, payment_date: value.slice(0, 10) })
              }
              readOnly={!editable}
            />
          </Field>
          <Field label="Currency" className="order-5">
            <Input readOnly value={form.currency_code} />
          </Field>
          <Field label="Paid date / GL posting date" className="order-4">
            <DatePicker
              value={form.paid_date ?? form.payment_date}
              readOnly={!editable}
              onValueChange={(value) =>
                setForm({ ...form, paid_date: value.slice(0, 10) })
              }
            />
            <span
              className={
                (form.paid_date ?? form.payment_date).slice(0, 7) ===
                today().slice(0, 7)
                  ? "text-xs text-emerald-600 dark:text-emerald-400"
                  : "text-destructive text-xs"
              }
            >
              {(form.paid_date ?? form.payment_date).slice(0, 7) ===
              today().slice(0, 7)
                ? "Period open (mock)"
                : "Period closed (mock)"}
            </span>
          </Field>
          <Field
            label="Exchange rate"
            className="order-6 lg:col-start-6 lg:row-start-2"
          >
            <Input
              disabled={!editable || form.currency_code === "THB"}
              value={form.exchange_rate}
              onChange={(event) =>
                /^\d*(\.\d*)?$/.test(event.target.value) &&
                setForm({ ...form, exchange_rate: event.target.value })
              }
            />
          </Field>
          <Field
            label="Method"
            className="order-7 lg:col-start-1 lg:row-start-2"
          >
            <Select
              disabled={!editable}
              value={form.payment_method}
              onValueChange={(value: ApPaymentInput["payment_method"]) =>
                setForm({ ...form, payment_method: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="bank_transfer">Bank transfer</SelectItem>
                <SelectItem value="direct_debit">Direct debit</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Beneficiary account"
            className="order-8 lg:col-span-2 lg:col-start-2 lg:row-start-2"
          >
            <Input
              disabled={!editable}
              value={form.bank_account_masked}
              onChange={(event) =>
                setForm({ ...form, bank_account_masked: event.target.value })
              }
            />
          </Field>
          <Field
            label="Reference"
            className="order-9 lg:col-start-4 lg:row-start-2"
          >
            <Input
              disabled={!editable}
              value={form.payment_reference}
              onChange={(event) =>
                setForm({ ...form, payment_reference: event.target.value })
              }
            />
          </Field>
          <Field
            label="Description"
            className="order-10 sm:col-span-2 lg:col-start-5 lg:row-start-2"
          >
            <Input
              disabled={!editable}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
          <label className="order-11 flex items-center gap-2 self-end pb-2 text-sm">
            <Checkbox
              disabled={!editable}
              checked={form.urgent}
              onCheckedChange={(checked) =>
                setForm({ ...form, urgent: checked === true })
              }
            />
            Urgent payment
          </label>
        </div>
      </section>
      <PaymentSections
        activeTab={activeTab}
        onTabChange={setActiveTab}
        form={form}
        onChange={setForm}
        editable={Boolean(editable)}
        invoices={eligibleInvoices.filter(
          (invoice) =>
            invoice.lifecycle === "posted" &&
            !invoice.is_on_hold &&
            compareDecimal(invoice.open_amount, "0") > 0,
        )}
        onAddInvoice={addInvoice}
      />
      <SummaryFooterBar
        hasRecord
        items={
          activeTab === "journal"
            ? [
                { key: "rows", label: "Rows", value: summary.journal.length },
                {
                  key: "balance",
                  label: "Base Balance",
                  value:
                    compareDecimal(journalVariance, "0") === 0
                      ? "Balanced"
                      : "Variance",
                },
                {
                  key: "debit",
                  label: "Base Debit",
                  value: <Money value={journalDebit} currency="THB" />,
                  emphasis: true,
                },
                {
                  key: "credit",
                  label: "Base Credit",
                  value: <Money value={journalCredit} currency="THB" />,
                  emphasis: true,
                },
                {
                  key: "variance",
                  label: "Variance",
                  value: <Money value={journalVariance} currency="THB" />,
                },
              ]
            : [
                {
                  key: "applied",
                  label: "Applied",
                  value: (
                    <Money value={applied} currency={form.currency_code} />
                  ),
                },
                {
                  key: "wht",
                  label: "WHT",
                  value: <Money value={wht} currency={form.currency_code} />,
                },
                {
                  key: "net",
                  label: "Net cash",
                  value: (
                    <Money value={netCash} currency={form.currency_code} />
                  ),
                  emphasis: true,
                },
                {
                  key: "fx",
                  label: "Realized FX",
                  value: <Money value={summary.fx} currency="THB" />,
                },
              ]
        }
      >
        {editing && (
          <Button
            size="sm"
            disabled={busy || !applications.length}
            onClick={() =>
              form.workflow_enabled
                ? void runAction("submit")
                : setConfirmation("submit")
            }
          >
            <Send className="size-4" />
            {form.workflow_enabled ? "Submit" : "Submit & post"}
          </Button>
        )}
      </SummaryFooterBar>
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheet === "attachments" ? "Attachments" : "Activity log"}
            </SheetTitle>
            <SheetDescription>Seeded view-only information.</SheetDescription>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4">
            {sheet === "attachments" &&
              (loaded?.attachments.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  {item.name}
                </div>
              )) ?? (
                <p className="text-muted-foreground text-sm">No attachments.</p>
              ))}
            {sheet === "activity" &&
              loaded?.activity.map((item) => (
                <div key={item.id} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{item.action}</p>
                  <p>{item.detail}</p>
                  <p className="text-muted-foreground">
                    {item.actor} · {item.at}
                  </p>
                </div>
              ))}
          </div>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => !open && setConfirmation(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation === "approve" || confirmation === "submit"
                ? "Post payment?"
                : `Confirm ${confirmation ?? "action"}`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {loaded?.pv_no} · {form.vendor_name}.{" "}
              {confirmation === "approve" || confirmation === "submit"
                ? `Post the mock payment using paid date ${form.paid_date ?? form.payment_date} and apply ${applied} ${form.currency_code} to the selected invoices. No real bank transfer is made.`
                : "This action will be recorded in the document activity log."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmation &&
            ["void", "reject", "clarify"].includes(confirmation) && (
              <Field label="Reason">
                <Input
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Required reason"
                />
              </Field>
            )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={
                busy ||
                Boolean(
                  confirmation &&
                  ["void", "reject", "clarify"].includes(confirmation) &&
                  !reason.trim(),
                )
              }
              onClick={() => {
                const action = confirmation;
                setConfirmation(null);
                if (action) void runAction(action);
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
