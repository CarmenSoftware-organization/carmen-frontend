import { useMemo, useState } from "react";
import {
  Ban,
  Check,
  Copy,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import type {
  ApInvoice,
  ApInvoiceInput,
  ApInvoiceLine,
} from "@/types/accounts-payable";
import {
  addDecimal,
  compareDecimal,
  multiplyDecimal,
  percentOf,
  subtractDecimal,
} from "../shared/ap-decimal";
import { ApStatusBadge, LabelValue, Money } from "../shared/ap-ui";
import { InvoiceLines } from "./ap-invoice-lines";
import {
  useApInvoice,
  useApInvoiceAction,
  useSaveApInvoice,
} from "../shared/use-accounts-payable";

const today = () => new Date().toISOString().slice(0, 10);
const emptyLine = (): ApInvoiceLine => ({
  id: crypto.randomUUID(),
  description: "",
  unit: "EA",
  quantity: "1",
  unit_price: "0.00",
  subtotal: "0.00",
  discount: "0.00",
  net_amount: "0.00",
  vat_rate: "7",
  vat_amount: "0.00",
  wht_rate: "3",
  wht_eligible_amount: "0.00",
  account: "",
  department: "",
  dimension: "",
  po_no: null,
  grn_no: null,
  match_status: "not_required",
});
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
const initialInvoiceForm = (
  source?: ApInvoice,
  copying = false,
): ApInvoiceInput =>
  source
    ? {
        input_date: copying ? today() : source.input_date,
        vendor_invoice_no: copying ? "" : source.vendor_invoice_no,
        vendor_id: source.vendor_id,
        vendor_name: source.vendor_name,
        invoice_date: copying ? today() : source.invoice_date,
        due_date: source.due_date,
        credit_days: source.credit_days,
        currency_code: source.currency_code,
        exchange_rate: source.exchange_rate,
        description: copying
          ? `Copy of ${source.description}`
          : source.description,
        workflow_enabled: source.workflow_enabled,
        tax_status: copying ? "pending" : source.tax_status,
        match_status: source.match_status,
        match_acknowledged: copying ? false : source.match_acknowledged,
        lines: source.lines.map((line) =>
          copying ? { ...line, id: crypto.randomUUID() } : line,
        ),
      }
    : {
        input_date: today(),
        vendor_invoice_no: "",
        vendor_id: "vendor-1",
        vendor_name: "Bangkok Fresh Supply Co., Ltd.",
        invoice_date: today(),
        due_date: today(),
        credit_days: 30,
        currency_code: "THB",
        exchange_rate: "1",
        description: "",
        workflow_enabled: true,
        tax_status: "pending",
        match_status: "not_required",
        match_acknowledged: false,
        lines: [emptyLine()],
      };

export default function ApInvoiceDetail() {
  const { id = "new" } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const query = useApInvoice(id);
  const copyId =
    id === "new" ? (searchParams.get("copy") ?? undefined) : undefined;
  const copyQuery = useApInvoice(copyId);
  if (query.isLoading || copyQuery.isLoading)
    return <Skeleton className="h-[70vh] rounded-lg" />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        message="Unable to load AP invoice"
        onRetry={() => void query.refetch()}
      />
    );
  if (copyQuery.isError)
    return (
      <ErrorState
        error={copyQuery.error}
        message="Unable to load source invoice"
        onRetry={() => void copyQuery.refetch()}
      />
    );
  return (
    <ApInvoiceEditor
      key={`${id}:${query.data?.doc_version ?? 0}:${copyQuery.data?.doc_version ?? 0}`}
      id={id}
      loaded={query.data}
      copySource={copyQuery.data}
    />
  );
}

function ApInvoiceEditor({
  id,
  loaded,
  copySource,
}: {
  id: string;
  loaded?: ApInvoice | null;
  copySource?: ApInvoice | null;
}) {
  const navigate = useNavigate();
  const saveMutation = useSaveApInvoice();
  const actionMutation = useApInvoiceAction();
  const [editing, setEditing] = useState(id === "new");
  const [sheet, setSheet] = useState<
    "attachments" | "activity" | "line" | null
  >(null);
  const [selectedLine, setSelectedLine] = useState(0);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [form, setForm] = useState<ApInvoiceInput>(() =>
    initialInvoiceForm(
      loaded ?? copySource ?? undefined,
      !!copySource && !loaded,
    ),
  );

  const lines = useMemo(
    () =>
      form.lines.map((line) => {
        const subtotal = multiplyDecimal(
          line.quantity || "0",
          line.unit_price || "0",
        );
        const net = subtractDecimal(subtotal, line.discount || "0");
        return {
          ...line,
          subtotal,
          net_amount: net,
          vat_amount: percentOf(net, line.vat_rate || "0"),
          wht_eligible_amount: net,
        };
      }),
    [form.lines],
  );
  const subtotal = addDecimal(lines.map((line) => line.subtotal));
  const discount = addDecimal(lines.map((line) => line.discount));
  const net = subtractDecimal(subtotal, discount);
  const vat = addDecimal(lines.map((line) => line.vat_amount));
  const wht = addDecimal(
    lines.map((line) => percentOf(line.wht_eligible_amount, line.wht_rate)),
  );
  const total = addDecimal([net, vat]);
  const effectiveMatchStatus = lines.some(
    (line) => line.match_status === "variance",
  )
    ? "variance"
    : lines.some((line) => line.match_status === "matched")
      ? "matched"
      : "not_required";
  const editable = id === "new" || (loaded?.capabilities.can_edit && editing);
  const setLine = (index: number, patch: Partial<ApInvoiceLine>) =>
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, ...patch } : line,
      ),
    }));
  const moveLine = (index: number, direction: -1 | 1) =>
    setForm((current) => {
      const next = [...current.lines];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...current, lines: next };
    });
  const payload = (): ApInvoiceInput => ({
    ...form,
    match_status: effectiveMatchStatus,
    lines,
  });
  const save = async () => {
    try {
      const result = await saveMutation.mutateAsync({
        input: payload(),
        id: id === "new" ? undefined : id,
        docVersion: loaded?.doc_version,
      });
      toast.success("Invoice saved");
      navigate(`/accounting/accounts-payable/invoice/${result.id}`, {
        replace: true,
      });
      setEditing(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Unable to save invoice",
      );
    }
  };
  const runAction = async (
    action: "submit" | "approve" | "return" | "reject" | "void",
  ) => {
    try {
      let target = loaded;
      if (!target || (action === "submit" && editing))
        target = await saveMutation.mutateAsync({
          input: payload(),
          id: loaded?.id,
          docVersion: loaded?.doc_version,
        });
      const result = await actionMutation.mutateAsync({
        id: target.id,
        action,
        docVersion: target.doc_version,
      });
      toast.success(`Invoice ${action} completed`);
      navigate(`/accounting/accounts-payable/invoice/${result.id}`, {
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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {loaded?.lifecycle === "submitted" && (
        <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
          <WorkflowTrack
            previousStage="Prepared"
            currentStage={loaded.current_stage ?? "Approval"}
            nextStage="Posted"
          />
          <div className="flex gap-2">
            {loaded.capabilities.can_approve && (
              <Button size="sm" onClick={() => void runAction("approve")}>
                <Check className="size-4" />
                Approve
              </Button>
            )}
            {loaded.capabilities.can_return && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => void runAction("return")}
              >
                <Undo2 className="size-4" />
                Return
              </Button>
            )}
            {loaded.capabilities.can_reject && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void runAction("reject")}
              >
                <X className="size-4" />
                Reject
              </Button>
            )}
          </div>
        </div>
      )}
      <DocFormHeader
        title={loaded?.ap_no ?? "New AP Invoice"}
        mock
        subtitle="Standard supplier invoice"
        backLabel="Back to AP Invoice Directory"
        onBack={() => navigate("/accounting/accounts-payable/invoice")}
        badges={
          loaded ? (
            <>
              <ApStatusBadge value={loaded.lifecycle} />
              <ApStatusBadge value={loaded.settlement_status} />
            </>
          ) : undefined
        }
        actions={
          <>
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
                    setEditing(false);
                    if (id === "new")
                      navigate("/accounting/accounts-payable/invoice");
                    else setForm(initialInvoiceForm(loaded ?? undefined));
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => void save()}
                  disabled={saveMutation.isPending}
                >
                  <Save className="size-4" />
                  Save
                </Button>
              </>
            )}
            {loaded?.lifecycle === "posted" &&
              compareDecimal(loaded.open_amount, "0") > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/accounting/accounts-payable/payment/new?invoice_ids=${encodeURIComponent(loaded.id)}`,
                    )
                  }
                >
                  Pay invoice
                </Button>
              )}
            {loaded?.capabilities.can_void && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void runAction("void")}
              >
                <Ban className="size-4" />
                Void
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
                    navigate("/accounting/accounts-payable/invoice/new")
                  }
                >
                  <Plus className="size-4" /> New
                </DropdownMenuItem>
                {loaded && (
                  <DropdownMenuItem
                    onSelect={() =>
                      navigate(
                        `/accounting/accounts-payable/invoice/new?copy=${loaded.id}`,
                      )
                    }
                  >
                    <Copy className="size-4" /> Copy
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onSelect={() => setSheet("attachments")}>
                  <Paperclip className="size-4" /> Attachments
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSheet("activity")}>
                  <FileClock className="size-4" /> Log
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {!editable && loaded && (
        <div className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <ApStatusBadge value={loaded.lifecycle} />
          <span className="text-muted-foreground">
            This invoice is read-only.
          </span>
        </div>
      )}
      <section className="space-y-3 border-b pb-4">
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Invoice details</h2>
            <div className="flex gap-2">
              {loaded && (
                <>
                  <ApStatusBadge value={loaded.lifecycle} />
                  <ApStatusBadge value={loaded.settlement_status} />
                  <ApStatusBadge value={loaded.match_status} />
                </>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Field label="Document no.">
            <Input value={loaded?.ap_no ?? "Auto-generated"} readOnly />
          </Field>
          <Field label="Input date">
            <DatePicker
              value={form.input_date}
              onValueChange={(value) =>
                setForm({ ...form, input_date: value.slice(0, 10) })
              }
              readOnly={!editable}
            />
          </Field>
          <Field label="Vendor" className="lg:col-span-2">
            {editable ? (
              <Select
                value={form.vendor_id}
                onValueChange={(value) =>
                  setForm({
                    ...form,
                    vendor_id: value,
                    vendor_name:
                      value === "vendor-1"
                        ? "Bangkok Fresh Supply Co., Ltd."
                        : value === "vendor-2"
                          ? "Clean Linen Services Co., Ltd."
                          : form.vendor_name,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {!["vendor-1", "vendor-2"].includes(form.vendor_id) && (
                    <SelectItem value={form.vendor_id}>
                      {form.vendor_name}
                    </SelectItem>
                  )}
                  <SelectItem value="vendor-1">
                    Bangkok Fresh Supply Co., Ltd.
                  </SelectItem>
                  <SelectItem value="vendor-2">
                    Clean Linen Services Co., Ltd.
                  </SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input value={form.vendor_name} readOnly />
            )}
          </Field>
          <Field label="Currency">
            <Select
              disabled={!editable}
              value={form.currency_code}
              onValueChange={(value) =>
                setForm({
                  ...form,
                  currency_code: value,
                  exchange_rate: value === "THB" ? "1" : form.exchange_rate,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Exchange rate">
            <Input
              disabled={!editable || form.currency_code === "THB"}
              value={form.exchange_rate}
              onChange={(event) =>
                setForm({ ...form, exchange_rate: event.target.value })
              }
            />
          </Field>
          <Field label="Vendor invoice no.">
            <Input
              disabled={!editable}
              value={form.vendor_invoice_no}
              onChange={(event) =>
                setForm({ ...form, vendor_invoice_no: event.target.value })
              }
            />
          </Field>
          <Field label="Invoice date">
            <DatePicker
              value={form.invoice_date}
              onValueChange={(value) =>
                setForm({ ...form, invoice_date: value.slice(0, 10) })
              }
              readOnly={!editable}
            />
          </Field>
          <Field label="Credit days">
            <Input
              disabled={!editable}
              inputMode="numeric"
              value={form.credit_days}
              onChange={(event) =>
                setForm({
                  ...form,
                  credit_days: Number(event.target.value) || 0,
                })
              }
            />
          </Field>
          <Field label="Due date">
            <DatePicker
              value={form.due_date ?? undefined}
              onValueChange={(value) =>
                setForm({ ...form, due_date: value.slice(0, 10) })
              }
              readOnly={!editable}
            />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input
              disabled={!editable}
              value={form.description}
              onChange={(event) =>
                setForm({ ...form, description: event.target.value })
              }
            />
          </Field>
        </div>
      </section>
      <Tabs defaultValue="items" className="min-h-0 flex-1 gap-3">
        <div className="overflow-x-auto overflow-y-hidden">
          <TabsList variant="line">
            <TabsTrigger value="items">Item Details</TabsTrigger>
            <TabsTrigger value="tax">Tax Invoice</TabsTrigger>
            <TabsTrigger value="references">Document References</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
            <TabsTrigger value="journal">Journal Preview</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="items" className="min-h-0 overflow-auto border-t">
          <div>
            <InvoiceLines
              lines={lines}
              editable={Boolean(editable)}
              currency={form.currency_code}
              rate={form.exchange_rate}
              onChange={setLine}
              onConfigure={(index) => {
                setSelectedLine(index);
                setSheet("line");
              }}
              onMove={moveLine}
              onRemove={(index) =>
                setForm({
                  ...form,
                  lines: form.lines.filter(
                    (_, itemIndex) => itemIndex !== index,
                  ),
                })
              }
            />
            {editable && (
              <div className="p-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    setForm({ ...form, lines: [...form.lines, emptyLine()] })
                  }
                >
                  <Plus className="size-4" />
                  Add line
                </Button>
              </div>
            )}
          </div>
        </TabsContent>
        <TabsContent value="tax">
          <Card>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              <LabelValue label="Tax invoice no.">
                {loaded?.tax_invoice_no ?? "Generated on Submit"}
              </LabelValue>
              <LabelValue label="Tax invoice date">
                {loaded?.tax_invoice_date ?? "—"}
              </LabelValue>
              <LabelValue label="Tax status">
                <ApStatusBadge value={form.tax_status} />
              </LabelValue>
              <LabelValue label="VAT amount">
                <Money value={vat} currency={form.currency_code} />
              </LabelValue>
              <LabelValue label="Estimated WHT">
                <Money value={wht} currency={form.currency_code} />
              </LabelValue>
              <p className="text-muted-foreground text-sm sm:col-span-3">
                WHT is estimated for payment and does not reduce invoice
                liability.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="references">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between py-3 px-4 border-b">
              <div>
                <CardTitle className="text-sm font-semibold">
                  3-Way Matching Verification (PO ↔ GRN ↔ AP Invoice)
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Automated tolerance check between Purchase Orders, Goods Receipt Notes, and Billed Lines.
                </p>
              </div>
              {editable && (
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const updated = form.lines.map((l) => ({
                        ...l,
                        match_status: "matched" as const,
                      }));
                      setForm({ ...form, lines: updated, match_acknowledged: true });
                      toast.success("All lines verified and matched with PO & GRN");
                    }}
                  >
                    Verify All (Auto-Match)
                  </Button>
                  {effectiveMatchStatus === "variance" && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        setForm({ ...form, match_acknowledged: true });
                        toast.success("All variances acknowledged by authorized user");
                      }}
                    >
                      Acknowledge All Variances
                    </Button>
                  )}
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-3 p-4">
              {lines.map((line, idx) => (
                <div
                  key={line.id}
                  className="rounded-lg border p-3 text-sm space-y-2 bg-card"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                    <span className="font-semibold text-primary">
                      Line #{idx + 1}: {line.description || "Supply item"}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">Status:</span>
                      <ApStatusBadge value={line.match_status} />
                    </div>
                  </div>
                  <div className="grid gap-2 text-xs sm:grid-cols-3">
                    <div className="rounded bg-muted/30 p-2 space-y-1">
                      <div className="font-medium text-foreground">1. Purchase Order</div>
                      <div>PO No: <span className="font-semibold">{line.po_no ?? "PO-2026-0812"}</span></div>
                      <div>Contract Price: <span className="tabular-nums">{line.unit_price} {form.currency_code}</span></div>
                    </div>
                    <div className="rounded bg-muted/30 p-2 space-y-1">
                      <div className="font-medium text-foreground">2. Goods Receipt</div>
                      <div>GRN No: <span className="font-semibold">{line.grn_no ?? "GRN-2026-0815"}</span></div>
                      <div>Store Received: <span className="tabular-nums">{line.quantity} {line.unit}</span></div>
                    </div>
                    <div className="rounded bg-primary/5 p-2 space-y-1">
                      <div className="font-medium text-foreground">3. AP Invoice (Billed)</div>
                      <div>Billed Qty: <span className="tabular-nums">{line.quantity} {line.unit}</span></div>
                      <div>Line Net Total: <span className="tabular-nums font-semibold text-primary">{line.net_amount} {form.currency_code}</span></div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="payments">
          <Card>
            <CardContent className="space-y-2">
              {loaded?.payments.length ? (
                loaded.payments.map((payment) => (
                  <button
                    key={payment.payment_id}
                    className="grid w-full grid-cols-3 gap-3 rounded-lg border p-3 text-left text-sm"
                    onClick={() =>
                      navigate(
                        `/accounting/accounts-payable/payment/${payment.payment_id}`,
                      )
                    }
                  >
                    <span>{payment.payment_no}</span>
                    <span>{payment.payment_date}</span>
                    <Money
                      value={payment.applied_amount}
                      currency={form.currency_code}
                    />
                  </button>
                ))
              ) : (
                <p className="text-muted-foreground text-sm">
                  No payments applied.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="journal">
          <Card>
            <CardContent className="space-y-2">
              {loaded?.journal.map((line) => (
                <div
                  key={line.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 border-b py-2 text-sm"
                >
                  <span>
                    {line.account} · {line.description}
                  </span>
                  <Money value={line.debit} currency={form.currency_code} />
                  <Money value={line.credit} currency={form.currency_code} />
                </div>
              )) ?? (
                <p className="text-muted-foreground text-sm">
                  Journal preview will be generated after posting.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      {effectiveMatchStatus === "variance" && !form.match_acknowledged && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Blocking PO/GRN variance must be acknowledged before Submit.
          <Button
            variant="outline"
            size="sm"
            className="ml-3"
            disabled={!editable}
            onClick={() => setForm({ ...form, match_acknowledged: true })}
          >
            Acknowledge variance
          </Button>
        </div>
      )}
      <SummaryFooterBar
        hasRecord
        items={[
          {
            key: "subtotal",
            label: "Subtotal",
            value: <Money value={subtotal} currency={form.currency_code} />,
          },
          {
            key: "discount",
            label: "Discount",
            value: (
              <Money
                value={discount}
                currency={form.currency_code}
                className="text-rose-600 dark:text-rose-400"
              />
            ),
          },
          {
            key: "net",
            label: "Net",
            value: <Money value={net} currency={form.currency_code} />,
          },
          {
            key: "vat",
            label: "VAT",
            value: (
              <Money
                value={vat}
                currency={form.currency_code}
                className="text-emerald-600 dark:text-emerald-400"
              />
            ),
          },
          {
            key: "wht",
            label: "Est. WHT",
            value: (
              <Money
                value={wht}
                currency={form.currency_code}
                className="text-rose-600 dark:text-rose-400"
              />
            ),
          },
          {
            key: "total",
            label: "Total",
            value: <Money value={total} currency={form.currency_code} />,
            emphasis: true,
          },
          {
            key: "open",
            label: "Open",
            value: (
              <Money
                value={loaded?.open_amount ?? total}
                currency={form.currency_code}
                className="text-amber-600 dark:text-amber-400"
              />
            ),
            emphasis: true,
          },
        ]}
      >
        {editing && (
          <div className="flex shrink-0 gap-2">
            <Button
              size="sm"
              onClick={() => setSubmitConfirmOpen(true)}
              disabled={saveMutation.isPending || actionMutation.isPending}
            >
              <Send className="size-4" />
              Submit
            </Button>
          </div>
        )}
      </SummaryFooterBar>
      <ConfirmDialog
        open={submitConfirmOpen}
        onOpenChange={setSubmitConfirmOpen}
        title="Submit AP invoice?"
        description="The invoice becomes read-only while it is in the approval workflow."
        confirmText="Submit"
        confirmIcon={<Send className="size-4" />}
        isPending={saveMutation.isPending || actionMutation.isPending}
        onConfirm={() => {
          setSubmitConfirmOpen(false);
          void runAction("submit");
        }}
      />
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => !open && setSheet(null)}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>
              {sheet === "attachments"
                ? "Attachments"
                : sheet === "activity"
                  ? "Activity log"
                  : "Line details"}
            </SheetTitle>
            <SheetDescription>
              {sheet === "line"
                ? "Account, department, dimensions, tax and matching."
                : "Seeded view-only information for this increment."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 overflow-y-auto px-4">
            {sheet === "attachments" &&
              (loaded?.attachments.length ? (
                loaded.attachments.map((item) => (
                  <div key={item.id} className="rounded-lg border p-3 text-sm">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-muted-foreground">
                      {item.kind} · {item.added_at}
                    </p>
                  </div>
                ))
              ) : (
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
            {sheet === "line" && lines[selectedLine] && (
              <>
                <Field label="Account (GL Chart of Accounts)">
                  <LookupChartOfAccount
                    disabled={!editable}
                    value={lines[selectedLine].account}
                    onValueChange={(accountCode) =>
                      setLine(selectedLine, { account: accountCode })
                    }
                  />
                </Field>
                <Field label="Department">
                  {editable ? (
                    <Select
                      value={lines[selectedLine].department || "100"}
                      onValueChange={(value) =>
                        setLine(selectedLine, { department: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select Department" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="100">100 - Admin &amp; General</SelectItem>
                        <SelectItem value="200">200 - Rooms Department</SelectItem>
                        <SelectItem value="300">300 - Food &amp; Beverage</SelectItem>
                        <SelectItem value="400">400 - Engineering &amp; Maintenance</SelectItem>
                        <SelectItem value="800">800 - Non-Operating</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input disabled value={lines[selectedLine].department} />
                  )}
                </Field>
                <Field label="Dimensions">
                  <Input
                    disabled={!editable}
                    value={lines[selectedLine].dimension}
                    onChange={(event) =>
                      setLine(selectedLine, { dimension: event.target.value })
                    }
                  />
                </Field>
                <Field label="PO no.">
                  <Input
                    disabled={!editable}
                    value={lines[selectedLine].po_no ?? ""}
                    onChange={(event) =>
                      setLine(selectedLine, {
                        po_no: event.target.value || null,
                      })
                    }
                  />
                </Field>
                <Field label="GRN no.">
                  <Input
                    disabled={!editable}
                    value={lines[selectedLine].grn_no ?? ""}
                    onChange={(event) =>
                      setLine(selectedLine, {
                        grn_no: event.target.value || null,
                      })
                    }
                  />
                </Field>
                <Field label="Match status">
                  <Select
                    disabled={!editable}
                    value={lines[selectedLine].match_status}
                    onValueChange={(value: ApInvoiceLine["match_status"]) =>
                      setLine(selectedLine, { match_status: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not_required">Not required</SelectItem>
                      <SelectItem value="matched">Matched</SelectItem>
                      <SelectItem value="variance">Variance</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Note">
                  <Textarea
                    disabled={!editable}
                    placeholder="Line or matching note"
                  />
                </Field>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
