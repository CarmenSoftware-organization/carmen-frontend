import { useMemo, useState } from "react";
import { Ban, Copy, MoreHorizontal, Plus, Save, Send } from "lucide-react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { WorkflowTrack } from "@/components/share/workflow-track";
import { Field as FormField, FieldLabel } from "@/components/ui/field";
import {
  ArInvoiceItemsTable,
  ArInvoiceTaxTable,
  ArInvoiceJournalTable,
} from "./ar-invoice-tables";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { useTitles } from "@/hooks/use-accounting-master";
import {
  AR_INVOICES,
  AR_INVOICE_PATH,
  AR_DOC_TYPE_LABELS,
  dueDate,
  invoiceTotals,
  journalPreviewTotals,
  lineTotals,
  money,
  newArInvoice,
  type ArInvoice,
  type ArInvoiceLine,
  type ArDocumentType,
} from "./ar-invoice-model";

const Field = ({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) => (
  <FormField className={className}>
    <FieldLabel>{label}</FieldLabel>
    {children}
  </FormField>
);

const blankLine = (): ArInvoiceLine => ({
  id: crypto.randomUUID(),
  description: "",
  unit: "ROOM",
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  taxRate: 7,
  tax2Rate: 0,
  tax1Account: "2151000",
  tax1CostCenter: "GEN",
  tax2Account: "2180000",
  tax2CostCenter: "GEN",
  account: "4110000",
  costCenter: "101",
  arAccount: "1130000",
  arCostCenter: "GEN",
  dimensions: "",
  reference: "",
  dateFrom: "",
  dateTo: "",
  groupNo: 1,
  source: "Manual",
});

export default function ArInvoiceDetail() {
  const { id = "new" } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const original = AR_INVOICES.find((item) => item.id === id);
  const [invoice, setInvoice] = useState<ArInvoice>(() => {
    const requestedType = (params.get("type") as ArDocumentType) || "ARIV";
    const source =
      id === "new"
        ? AR_INVOICES.find((item) => item.id === params.get("copy"))
        : undefined;
    return source
      ? {
          ...source,
          id: "new",
          docNo: "Auto-generated",
          docType: source.docType ?? requestedType,
          status: "Draft",
          source: "Copy",
          taxInvoiceNo: "",
          receiptAmount: 0,
          depositAmount: 0,
          lines: source.lines.map((line) => ({
            ...line,
            id: crypto.randomUUID(),
          })),
        }
      : (original ?? newArInvoice(requestedType));
  });
  const [activeTab, setActiveTab] = useState("items");
  const [editing, setEditing] = useState(id === "new");
  const [lineIndex, setLineIndex] = useState<number | null>(null);
  const [folioOpen, setFolioOpen] = useState(false);
  const [depositOpen, setDepositOpen] = useState(false);
  const { data: titles = [] } = useTitles();
  const totals = useMemo(() => invoiceTotals(invoice), [invoice]);
  const journalTotals = useMemo(() => journalPreviewTotals(invoice), [invoice]);
  const editable = invoice.status === "Draft" && editing;
  const rate = invoice.exchangeRate;
  const hasJournalPreview =
    invoice.source !== "PMS Folio" &&
    !invoice.lines.some((line) => line.source === "PMS Folio");
  const workflow = {
    Draft: { currentStage: "Draft", nextStage: "Submitted" },
    Submitted: {
      previousStage: "Draft",
      currentStage: "Submitted",
      nextStage: "Approved",
    },
    Approved: {
      previousStage: "Submitted",
      currentStage: "Approved",
      nextStage: "Posted",
    },
    Posted: { previousStage: "Approved", currentStage: "Posted" },
    Void: { currentStage: "Void", terminalState: "voided" as const },
  }[invoice.status];
  const set = <K extends keyof ArInvoice>(key: K, value: ArInvoice[K]) =>
    setInvoice((current) => ({ ...current, [key]: value }));
  const updateLine = (index: number, patch: Partial<ArInvoiceLine>) =>
    setInvoice((current) => ({
      ...current,
      lines: current.lines.map((line, i) => {
        if (i !== index) return line;
        const next = { ...line, ...patch };
        next.quantity = Math.max(0.01, next.quantity);
        next.unitPrice = Math.max(0, next.unitPrice);
        next.discount = Math.min(
          Math.max(0, next.discount),
          next.quantity * next.unitPrice,
        );
        next.taxRate = Math.min(100, Math.max(0, next.taxRate));
        next.tax2Rate = Math.min(100, Math.max(0, next.tax2Rate));
        return next;
      }),
    }));
  const copy = () => {
    navigate(`${AR_INVOICE_PATH}/new?copy=${encodeURIComponent(id)}`);
  };

  const availableOriginalInvoices = useMemo(
    () =>
      AR_INVOICES.filter(
        (inv) =>
          inv.id !== invoice.id && (inv.docType === "ARIV" || !inv.docType),
      ),
    [invoice.id],
  );

  const handleSaveDraft = () => {
    let docNo = invoice.docNo;
    if (docNo === "Auto-generated" || !docNo) {
      const type = invoice.docType ?? "ARIV";
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      docNo = `${type}2609${randomNum}`;
    }
    setInvoice((prev) => ({
      ...prev,
      docNo,
      status: "Draft",
    }));
    setEditing(false);
    toast.success(`Draft saved: ${docNo}`);
  };

  const handleSubmit = () => {
    let docNo = invoice.docNo;
    const type = invoice.docType ?? "ARIV";
    if (docNo === "Auto-generated" || !docNo) {
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      docNo = `${type}2609${randomNum}`;
    }

    let taxInvoiceNo = invoice.taxInvoiceNo;
    if (invoice.taxInvoice && !taxInvoiceNo) {
      const prefixMap: Record<ArDocumentType, string> = {
        ARIV: "TXIV",
        ARCN: "TXCN",
        ARDN: "TXDN",
        ARDP: "TXDP",
        ARRC: "TXRC",
      };
      const prefix = prefixMap[type] ?? "TXIV";
      const randomNum = Math.floor(1000 + Math.random() * 9000);
      taxInvoiceNo = `${prefix}2609${randomNum}`;
    }

    setInvoice((prev) => ({
      ...prev,
      docNo,
      taxInvoiceNo,
      status: "Submitted",
    }));
    setEditing(false);
    toast.success(`Document ${docNo} submitted successfully`);
  };

  if (id !== "new" && !original)
    return <p className="text-muted-foreground p-6">AR invoice not found.</p>;
  return (
    <div className="flex w-full min-w-0 grow shrink-0 flex-col gap-4 text-xs">
      <DocFormHeader
        title={invoice.docNo}
        mock
        subtitle={`${AR_DOC_TYPE_LABELS[invoice.docType ?? "ARIV"].description} · City Ledger`}
        backLabel="Back to AR Invoice Directory"
        onBack={() => navigate(AR_INVOICE_PATH)}
        badges={
          <>
            <Badge variant="secondary" className="font-semibold">
              {invoice.docType ?? "ARIV"}
            </Badge>
            <Badge variant="outline">{invoice.status}</Badge>
            <Badge variant="outline">{invoice.source}</Badge>
          </>
        }
        actions={
          <>
            {invoice.status === "Draft" && !editing && (
              <Button size="sm" onClick={() => setEditing(true)}>
                Edit
              </Button>
            )}
            {editable && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditing(false);
                    if (id === "new") navigate(AR_INVOICE_PATH);
                    else setInvoice(original!);
                  }}
                >
                  Cancel
                </Button>
                <Button size="sm" variant="outline" onClick={handleSaveDraft}>
                  <Save className="size-4" />
                  Save Draft
                </Button>
              </>
            )}
            {invoice.status === "Submitted" && (
              <>
                <Button
                  size="sm"
                  onClick={() => {
                    set("status", "Approved");
                    toast.success(`Approved document ${invoice.docNo}`);
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    set("status", "Draft");
                    setEditing(true);
                    toast.info(`Sent back document ${invoice.docNo} to Draft`);
                  }}
                >
                  Send Back
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    set("status", "Void");
                    toast.error(`Rejected document ${invoice.docNo}`);
                  }}
                >
                  Reject
                </Button>
              </>
            )}
            {id !== "new" && invoice.status !== "Void" && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  set("status", "Void");
                  toast.warning(`Document ${invoice.docNo} voided`);
                }}
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
                  onSelect={() => {
                    setInvoice(newArInvoice());
                    setEditing(true);
                    navigate(`${AR_INVOICE_PATH}/new`);
                  }}
                >
                  <Plus className="size-4" />
                  New
                </DropdownMenuItem>
                <DropdownMenuItem disabled={id === "new"} onSelect={copy}>
                  <Copy className="size-4" />
                  Copy
                </DropdownMenuItem>
                <DropdownMenuItem disabled>
                  Print · report pending
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      <p className="text-muted-foreground text-xs">
        ARIV interface preview · Save, Submit, tax numbering, approval and
        posting require the AR backend contract.
      </p>
      <div role="group" aria-label="Document workflow">
        <WorkflowTrack {...workflow} />
      </div>
      <section className="space-y-3 border-b pb-4">
        <h2 className="text-sm font-semibold">Invoice details</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
          <Field label="Doc Type">
            <Select
              disabled={!editable || id !== "new"}
              value={invoice.docType ?? "ARIV"}
              onValueChange={(val: ArDocumentType) => {
                setInvoice((prev) => ({
                  ...prev,
                  docType: val,
                  originalInvoiceNo:
                    val === "ARCN" || val === "ARDN"
                      ? prev.originalInvoiceNo
                      : undefined,
                }));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ARIV">ARIV (Invoice)</SelectItem>
                <SelectItem value="ARCN">ARCN (Credit Note)</SelectItem>
                <SelectItem value="ARDN">ARDN (Debit Note)</SelectItem>
                <SelectItem value="ARDP">ARDP (Deposit)</SelectItem>
                <SelectItem value="ARRC">ARRC (Receipt)</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Doc No.">
            <Input value={invoice.docNo} readOnly />
          </Field>
          <Field label="Input Date">
            <DatePicker
              value={invoice.inputDate}
              onValueChange={(value) => set("inputDate", value.slice(0, 10))}
              readOnly={!editable}
            />
          </Field>
          {(invoice.docType === "ARCN" || invoice.docType === "ARDN") && (
            <Field label="Original Invoice Ref." className="lg:col-span-2">
              <Select
                disabled={!editable}
                value={invoice.originalInvoiceNo ?? ""}
                onValueChange={(val) => set("originalInvoiceNo", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select original invoice" />
                </SelectTrigger>
                <SelectContent>
                  {availableOriginalInvoices.map((inv) => (
                    <SelectItem key={inv.id} value={inv.docNo}>
                      {inv.docNo} · {inv.customerName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Field label="Customer (AR)" className="lg:col-span-2">
            <div className="flex gap-1.5">
              {editable && titles.length > 0 ? (
                <Select
                  value={
                    titles.find(
                      (t) =>
                        invoice.customerName.startsWith(t.description) ||
                        invoice.customerName.startsWith(t.code),
                    )?.code ?? ""
                  }
                  onValueChange={(code) => {
                    const matched = titles.find((t) => t.code === code);
                    if (matched) {
                      const clean = invoice.customerName
                        .replace(/^(Mr\.|Mrs\.|Ms\.|Dr\.|Khun)\s*/i, "")
                        .trim();
                      setInvoice({
                        ...invoice,
                        customerName: `${matched.description} ${clean}`.trim(),
                        customerCode: clean ? "MANUAL" : "",
                      });
                    }
                  }}
                >
                  <SelectTrigger className="w-24 shrink-0">
                    <SelectValue placeholder="Title" />
                  </SelectTrigger>
                  <SelectContent>
                    {titles.map((t) => (
                      <SelectItem key={t.id} value={t.code}>
                        {t.code} ({t.description})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : null}
              <Input
                value={invoice.customerName}
                readOnly={!editable}
                placeholder="Customer Name"
                onChange={(event) =>
                  setInvoice({
                    ...invoice,
                    customerName: event.target.value,
                    customerCode: event.target.value ? "MANUAL" : "",
                  })
                }
              />
            </div>
          </Field>
          <Field label="Currency">
            <Select
              disabled={!editable}
              value={invoice.currency}
              onValueChange={(value) =>
                setInvoice({
                  ...invoice,
                  currency: value,
                  exchangeRate: value === "THB" ? 1 : invoice.exchangeRate,
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="THB">THB</SelectItem>
                <SelectItem value="USD">USD</SelectItem>
                <SelectItem value="EUR">EUR</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Exch Rate">
            <Input
              type="number"
              min="0.00001"
              step="0.00001"
              value={invoice.exchangeRate}
              readOnly={!editable || invoice.currency === "THB"}
              onChange={(event) =>
                set(
                  "exchangeRate",
                  Math.max(0.00001, Number(event.target.value)),
                )
              }
            />
          </Field>
          <Field label="Status">
            <Input value={invoice.status} readOnly />
          </Field>
          <Field label="Source">
            <Input value={invoice.source} readOnly />
          </Field>
          <Field label="Source Doc">
            <Input
              value={invoice.sourceDoc}
              readOnly={!editable}
              onChange={(event) => set("sourceDoc", event.target.value)}
            />
          </Field>
          <label className="flex items-center gap-2 self-end pb-2 text-xs">
            <Checkbox
              checked={invoice.taxInvoice}
              disabled={!editable}
              onCheckedChange={(checked) => set("taxInvoice", checked === true)}
            />
            Issue tax invoice
          </label>
          <Field label="Tax Inv No.">
            <Input
              value={invoice.taxInvoiceNo || "Assigned on Submit"}
              readOnly
            />
          </Field>
          <Field label="Credit (days)">
            <Input
              type="number"
              min="0"
              value={invoice.creditDays}
              readOnly={!editable}
              onChange={(event) =>
                set("creditDays", Math.max(0, Number(event.target.value)))
              }
            />
          </Field>
          <Field label="Due Date">
            <Input
              value={dueDate(invoice.inputDate, invoice.creditDays)}
              readOnly
            />
          </Field>
          <Field label="Description" className="lg:col-span-3">
            <Input
              value={invoice.description}
              readOnly={!editable}
              maxLength={255}
              onChange={(event) => set("description", event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:col-span-2 sm:grid-cols-2">
            <label className="flex items-center gap-2 self-end pb-2 text-xs">
              <Checkbox
                checked={invoice.whtRecorded}
                disabled={!editable}
                onCheckedChange={(checked) =>
                  set("whtRecorded", checked === true)
                }
              />
              Record WHT
            </label>
            <Field label="WHT Amount">
              <Input
                type="number"
                min="0"
                value={invoice.whtAmount}
                readOnly={!editable || !invoice.whtRecorded}
                onChange={(event) =>
                  set("whtAmount", Math.max(0, Number(event.target.value)))
                }
              />
            </Field>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          WHT is informational on the invoice and is recognized at receipt.
        </p>
      </section>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex-1 gap-3"
      >
        <div className="overflow-x-auto">
          <TabsList variant="line">
            <TabsTrigger value="items">Item Details</TabsTrigger>
            <TabsTrigger value="tax">Tax Invoice</TabsTrigger>
            <TabsTrigger value="references">Doc Reference</TabsTrigger>
            <TabsTrigger value="receipt">Receipt</TabsTrigger>
            <TabsTrigger value="journal">Journal (GL)</TabsTrigger>
          </TabsList>
        </div>
        <TabsContent value="items" className="space-y-2">
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={!editable || !invoice.customerCode}
              onClick={() => setFolioOpen(true)}
            >
              Add Folio
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={!editable}
              onClick={() => {
                set("lines", [...invoice.lines, blankLine()]);
                setLineIndex(invoice.lines.length);
              }}
            >
              <Plus className="size-4" />
              Add Item
            </Button>
          </div>
          <ArInvoiceItemsTable
            invoice={invoice}
            editable={editable}
            onDetail={setLineIndex}
            onRemove={(index) =>
              set(
                "lines",
                invoice.lines.filter((_, i) => i !== index),
              )
            }
          />
        </TabsContent>
        <TabsContent value="tax" className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Registered Name">
              <Input
                value={invoice.taxName}
                readOnly={!editable}
                onChange={(event) => set("taxName", event.target.value)}
              />
            </Field>
            <Field label="Tax ID (13 digits)">
              <Input
                value={invoice.taxId}
                readOnly={!editable}
                maxLength={13}
                onChange={(event) => set("taxId", event.target.value)}
              />
            </Field>
            <Field label="Branch No.">
              <Input
                value={invoice.branchNo}
                readOnly={!editable}
                maxLength={5}
                onChange={(event) => set("branchNo", event.target.value)}
              />
            </Field>
            <Field label="Tax Invoice No.">
              <Input
                value={invoice.taxInvoiceNo || "Assigned on Submit"}
                readOnly
              />
            </Field>
            <Field label="Address Line 1">
              <Input
                value={invoice.address1}
                readOnly={!editable}
                onChange={(event) => set("address1", event.target.value)}
              />
            </Field>
            <Field label="Address Line 2">
              <Input
                value={invoice.address2}
                readOnly={!editable}
                onChange={(event) => set("address2", event.target.value)}
              />
            </Field>
            <Field label="Province">
              <Input
                value={invoice.province}
                readOnly={!editable}
                onChange={(event) => set("province", event.target.value)}
              />
            </Field>
            <Field label="Postal Code">
              <Input
                value={invoice.postalCode}
                readOnly={!editable}
                maxLength={5}
                onChange={(event) => set("postalCode", event.target.value)}
              />
            </Field>
          </div>
          <ArInvoiceTaxTable invoice={invoice} />
        </TabsContent>
        <TabsContent value="references" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Advance deposits applied to this invoice
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled={!editable || !invoice.customerCode}
              onClick={() => setDepositOpen(true)}
            >
              Apply Deposit
            </Button>
          </div>
          {invoice.depositAmount ? (
            <div className="flex flex-wrap justify-between gap-3 border-b py-3 text-xs">
              <span>ARDP26090005 · {invoice.customerName}</span>
              <span className="text-destructive tabular-nums">
                −{money(invoice.depositAmount)} {invoice.currency}
              </span>
              <span className="text-muted-foreground">
                Original rate {invoice.depositRate.toFixed(5)} · Current rate{" "}
                {rate.toFixed(5)}
              </span>
            </div>
          ) : (
            <p className="text-muted-foreground py-8 text-center text-xs">
              No document references
            </p>
          )}
        </TabsContent>
        <TabsContent value="receipt" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              Receipt history and open balance
            </p>
            <Button
              size="sm"
              variant="outline"
              disabled
              title="Requires ARRC creation API"
            >
              Get Receipt
            </Button>
          </div>
          <div className="border-b py-3 text-xs">
            Unpaid Amount{" "}
            <strong className="ml-3 tabular-nums">
              {money(totals.unpaid)} {invoice.currency}
            </strong>
          </div>
          <p className="text-muted-foreground py-6 text-center text-xs">
            No receipts recorded for this invoice
          </p>
        </TabsContent>
        <TabsContent value="journal" className="space-y-3">
          {!hasJournalPreview ? (
            <p className="bg-muted/40 rounded-md p-4 text-xs">
              PMS Folio lines: revenue and AR were posted by Night Audit. No
              direct GL posting is previewed for this invoice.
            </p>
          ) : (
            <>
              <p className="text-muted-foreground text-xs">
                Preview of full invoice recognition. Deposit offset JV awaits
                the backend posting contract.
              </p>
              <ArInvoiceJournalTable invoice={invoice} />
            </>
          )}
        </TabsContent>
      </Tabs>
      <SummaryFooterBar
        hasRecord
        items={
          activeTab === "journal"
            ? hasJournalPreview
              ? [
                  {
                    key: "rows",
                    label: "Rows",
                    value:
                      invoice.lines.length +
                      1 +
                      Number(totals.tax1 > 0) +
                      Number(totals.tax2 > 0),
                  },
                  {
                    key: "balance",
                    label: "Base Balance",
                    value:
                      journalTotals.variance === 0 ? "Balanced" : "Variance",
                  },
                  {
                    key: "trans-debit",
                    label: "Trans Debit",
                    value: money(totals.total),
                    suffix: invoice.currency,
                  },
                  {
                    key: "trans-credit",
                    label: "Trans Credit",
                    value: money(totals.total),
                    suffix: invoice.currency,
                  },
                  {
                    key: "base-debit",
                    label: "Base Debit",
                    value: money(journalTotals.debit),
                    suffix: "THB",
                    emphasis: true,
                  },
                  {
                    key: "base-credit",
                    label: "Base Credit",
                    value: money(journalTotals.credit),
                    suffix: "THB",
                    emphasis: true,
                  },
                  {
                    key: "variance",
                    label: "Variance",
                    value: money(journalTotals.variance),
                    suffix: "THB",
                  },
                ]
              : [
                  {
                    key: "posting",
                    label: "GL Preview",
                    value: "Posted by PMS Night Audit",
                  },
                ]
            : [
                {
                  key: "currency",
                  label: "Currency",
                  value: (
                    <>
                      <span className="block">{invoice.currency}</span>
                      <span className="block">THB</span>
                    </>
                  ),
                },
                ...(
                  [
                    ["subtotal", "Subtotal", totals.subtotal],
                    ["discount", "Discount", totals.discount],
                    ["net", "Net", totals.net],
                    ["tax", "Tax 1", totals.tax1],
                    ["tax2", "Tax 2", totals.tax2],
                    ["total", "Grand Total", totals.total],
                    ["unpaid", "Unpaid", totals.unpaid],
                  ] as const
                ).map(([key, label, amount]) => ({
                  key,
                  label,
                  value: (
                    <>
                      <span className="block">{money(amount)}</span>
                      <span className="block">{money(amount * rate)}</span>
                    </>
                  ),
                  emphasis: key === "total" || key === "unpaid",
                })),
              ]
        }
      >
        {invoice.status === "Draft" && (
          <Button size="sm" disabled={!editable} onClick={handleSubmit}>
            <Send className="size-4" />
            Submit
          </Button>
        )}
      </SummaryFooterBar>
      <Sheet
        open={lineIndex !== null}
        onOpenChange={(open) => {
          if (!open) setLineIndex(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-xl">
          <SheetHeader>
            <SheetTitle>Invoice item detail</SheetTitle>
            <SheetDescription>
              Booking, discount, revenue and output tax
            </SheetDescription>
          </SheetHeader>
          {lineIndex !== null && invoice.lines[lineIndex] && (
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <h3 className="text-xs font-medium sm:col-span-2">
                Booking & Reference Details
              </h3>
              <Field label="Group No">
                <Input
                  type="number"
                  value={invoice.lines[lineIndex].groupNo}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      groupNo: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Unit">
                <Input
                  value={invoice.lines[lineIndex].unit}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, { unit: event.target.value })
                  }
                />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <Input
                  value={invoice.lines[lineIndex].description}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, { description: event.target.value })
                  }
                />
              </Field>
              <Field label="Reference" className="sm:col-span-2">
                <Textarea
                  value={invoice.lines[lineIndex].reference}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, { reference: event.target.value })
                  }
                />
              </Field>
              <Field label="Date From">
                <Input
                  type="date"
                  value={invoice.lines[lineIndex].dateFrom}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, { dateFrom: event.target.value })
                  }
                />
              </Field>
              <Field label="Date To">
                <Input
                  type="date"
                  value={invoice.lines[lineIndex].dateTo}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, { dateTo: event.target.value })
                  }
                />
              </Field>
              <h3 className="border-t pt-3 text-xs font-medium sm:col-span-2">
                Discount
              </h3>
              <Field label="Qty">
                <Input
                  type="number"
                  min="0.01"
                  value={invoice.lines[lineIndex].quantity}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      quantity: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Price / Unit">
                <Input
                  type="number"
                  min="0"
                  value={invoice.lines[lineIndex].unitPrice}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      unitPrice: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Discount Amount">
                <Input
                  type="number"
                  min="0"
                  max={
                    invoice.lines[lineIndex].quantity *
                    invoice.lines[lineIndex].unitPrice
                  }
                  value={invoice.lines[lineIndex].discount}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      discount: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Discount %">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={
                    invoice.lines[lineIndex].quantity *
                      invoice.lines[lineIndex].unitPrice >
                    0
                      ? Number(
                          (
                            (invoice.lines[lineIndex].discount /
                              (invoice.lines[lineIndex].quantity *
                                invoice.lines[lineIndex].unitPrice)) *
                            100
                          ).toFixed(2),
                        )
                      : 0
                  }
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      discount:
                        (invoice.lines[lineIndex].quantity *
                          invoice.lines[lineIndex].unitPrice *
                          Math.min(
                            100,
                            Math.max(0, Number(event.target.value)),
                          )) /
                        100,
                    })
                  }
                />
              </Field>
              <Field label="Net Amount">
                <Input
                  readOnly
                  value={money(lineTotals(invoice.lines[lineIndex]).net)}
                />
              </Field>
              <h3 className="border-t pt-3 text-xs font-medium sm:col-span-2">
                Revenue
              </h3>
              <Field label="Cr Acc Code (Revenue GL)">
                <LookupChartOfAccount
                  disabled={!editable}
                  value={invoice.lines[lineIndex].account}
                  onValueChange={(accountCode) =>
                    updateLine(lineIndex, { account: accountCode })
                  }
                />
              </Field>
              <Field label="Cost Center (Dept)">
                {editable ? (
                  <Select
                    value={invoice.lines[lineIndex].costCenter || "101"}
                    onValueChange={(value) =>
                      updateLine(lineIndex, { costCenter: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select Dept" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="101">
                        101 - Rooms (Front Office)
                      </SelectItem>
                      <SelectItem value="201">
                        201 - Food &amp; Beverage
                      </SelectItem>
                      <SelectItem value="301">
                        301 - Spa &amp; Recreation
                      </SelectItem>
                      <SelectItem value="GEN">GEN - General / Admin</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={invoice.lines[lineIndex].costCenter} readOnly />
                )}
              </Field>
              <Field label="Dimensions" className="sm:col-span-2">
                <Input
                  value={invoice.lines[lineIndex].dimensions}
                  readOnly={!editable}
                  placeholder="Market · Sales · Project · Event · Location · Channel"
                  onChange={(event) =>
                    updateLine(lineIndex, { dimensions: event.target.value })
                  }
                />
              </Field>
              <h3 className="border-t pt-3 text-xs font-medium sm:col-span-2">
                Output Tax
              </h3>
              <Field label="Tax 1 Profile (%)">
                <Input
                  type="number"
                  min="0"
                  value={invoice.lines[lineIndex].taxRate}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      taxRate: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Tax Amount 1">
                <Input
                  readOnly
                  value={money(lineTotals(invoice.lines[lineIndex]).tax)}
                />
              </Field>
              <Field label="Tax 1 Acc Code (GL)">
                <LookupChartOfAccount
                  disabled={!editable}
                  value={invoice.lines[lineIndex].tax1Account}
                  onValueChange={(accountCode) =>
                    updateLine(lineIndex, { tax1Account: accountCode })
                  }
                />
              </Field>
              <Field label="Tax 1 Cost Center">
                <Input
                  value={invoice.lines[lineIndex].tax1CostCenter}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      tax1CostCenter: event.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Tax 2 Profile (%)">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={invoice.lines[lineIndex].tax2Rate}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      tax2Rate: Number(event.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Tax Amount 2">
                <Input
                  readOnly
                  value={money(lineTotals(invoice.lines[lineIndex]).tax2)}
                />
              </Field>
              <Field label="Tax 2 Acc Code (GL)">
                <LookupChartOfAccount
                  disabled={!editable}
                  value={invoice.lines[lineIndex].tax2Account}
                  onValueChange={(accountCode) =>
                    updateLine(lineIndex, { tax2Account: accountCode })
                  }
                />
              </Field>
              <Field label="Tax 2 Cost Center">
                <Input
                  value={invoice.lines[lineIndex].tax2CostCenter}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, {
                      tax2CostCenter: event.target.value,
                    })
                  }
                />
              </Field>
              <h3 className="border-t pt-3 text-xs font-medium sm:col-span-2">
                Account Receivable
              </h3>
              <Field label="Dr Acc Code (AR Control)">
                <LookupChartOfAccount
                  disabled={!editable}
                  value={invoice.lines[lineIndex].arAccount}
                  onValueChange={(accountCode) =>
                    updateLine(lineIndex, { arAccount: accountCode })
                  }
                />
              </Field>
              <Field label="Dr Cost Center">
                <Input
                  value={invoice.lines[lineIndex].arCostCenter}
                  readOnly={!editable}
                  onChange={(event) =>
                    updateLine(lineIndex, { arCostCenter: event.target.value })
                  }
                />
              </Field>
              <Field label="Total Amount">
                <Input
                  readOnly
                  value={money(lineTotals(invoice.lines[lineIndex]).total)}
                />
              </Field>
            </div>
          )}
        </SheetContent>
      </Sheet>
      <Sheet open={folioOpen} onOpenChange={setFolioOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Add Folios from PMS</SheetTitle>
            <SheetDescription>
              Customer {invoice.customerName} · Folio date must be on or before{" "}
              {invoice.inputDate}
            </SheetDescription>
          </SheetHeader>
          <p className="text-muted-foreground p-4 text-xs">
            PMS folio search requires the AR backend interface. No folios can be
            imported from sample data.
          </p>
        </SheetContent>
      </Sheet>
      <Sheet open={depositOpen} onOpenChange={setDepositOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Apply Deposit</SheetTitle>
            <SheetDescription>
              Customer and currency must match this invoice.
            </SheetDescription>
          </SheetHeader>
          <p className="text-muted-foreground p-4 text-xs">
            Deposit balance and atomic settlement require the AR backend
            contract.
          </p>
        </SheetContent>
      </Sheet>
    </div>
  );
}
