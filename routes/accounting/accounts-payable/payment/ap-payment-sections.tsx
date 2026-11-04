import type { ReactNode } from "react";
import { useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { Link } from "react-router";
import {
  Plus,
  Trash2,
  ChevronDown,
  Pencil,
  ListChecks,
  Landmark,
  Tags,
  ReceiptText,
  BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type {
  ApInvoice,
  ApPaymentApplication,
  ApPaymentInput,
  ApPaymentMethodLine,
} from "@/types/accounts-payable-mock";
import {
  addDecimal,
  compareDecimal,
  multiplyDecimal,
  percentOf,
  subtractDecimal,
} from "../shared/ap-decimal";
import { ApDetailGrid } from "../shared/ap-detail-grid";
import { ApStatusBadge, Money } from "../shared/ap-ui";
import { paymentSummary } from "./ap-payment-totals";
import { PaymentTaxAllocation } from "./ap-payment-tax-allocation";
import {
  useBankAccounts,
  usePaymentTypes,
  useWhtForms,
  useWhtServiceTypes,
} from "@/hooks/use-accounting-master";

function Section({
  title,
  description,
  id,
  action,
  children,
}: {
  title: string;
  description?: string;
  id?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="scroll-mt-20 gap-4 py-4">
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4">
        <div className="min-w-0">
          <CardTitle className="text-sm">{title}</CardTitle>
          {description ? (
            <p className="text-muted-foreground mt-1 text-xs">{description}</p>
          ) : null}
        </div>
        {action}
      </CardHeader>
      <CardContent className="space-y-4 px-4">{children}</CardContent>
    </Card>
  );
}

export function PaymentSections({
  activeTab,
  onTabChange,
  form,
  onChange,
  editable,
  invoices,
  onAddInvoice,
}: {
  activeTab: string;
  onTabChange: (tab: string) => void;
  form: ApPaymentInput;
  onChange: (next: ApPaymentInput) => void;
  editable: boolean;
  invoices: ApInvoice[];
  onAddInvoice: (id: string) => void;
}) {
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [_methodEditor, setMethodEditor] = useState<string | null>(
    editable ? "primary" : null,
  );
  const [invoiceDialog, setInvoiceDialog] = useState(false);
  const [methodDialog, setMethodDialog] = useState(false);
  const [expenseDialog, setExpenseDialog] = useState(false);
  const [depositDialog, setDepositDialog] = useState(false);
  const [selectedDepositId, setSelectedDepositId] = useState<string>("");
  const [offsetAmountInput, setOffsetAmountInput] = useState<string>("");
  const [selectedBankId, setSelectedBankId] = useState<string>("");
  const [selectedPaymentTypeCode, setSelectedPaymentTypeCode] =
    useState<string>("TRANSFER");

  const availableDeposits = [
    {
      id: "dp-1",
      deposit_no: "APDP-2608-0001",
      deposit_date: "2026-08-10",
      original_deposit_amount: "15000.00",
      remaining_deposit_amount: "10000.00",
      note: "Advance payment for seasonal supply contract",
    },
    {
      id: "dp-2",
      deposit_no: "APDP-2608-0002",
      deposit_date: "2026-08-15",
      original_deposit_amount: "5000.00",
      remaining_deposit_amount: "5000.00",
      note: "Security deposit for kitchen equipment rental",
    },
  ];

  const { data: bankAccounts = [] } = useBankAccounts();
  const { data: paymentTypes = [] } = usePaymentTypes();
  const { data: whtForms = [] } = useWhtForms();
  const { data: whtServiceTypes = [] } = useWhtServiceTypes();

  const summary = paymentSummary(form);
  const fxTone =
    compareDecimal(summary.fx, "0") < 0
      ? "text-rose-600 dark:text-rose-400"
      : "text-emerald-600 dark:text-emerald-400";
  const currency = form.currency_code;
  const methods = form.payment_methods ?? [
    {
      id: "primary",
      method: form.payment_method,
      bank_account: form.bank_account_masked,
      payee: form.vendor_name,
      reference: form.payment_reference,
      account: "1011001",
      cost_center: "800",
      dimensions: "",
      amount: summary.net_cash,
    },
  ];
  const expenses = form.other_expenses ?? [];
  const taxes = form.tax_invoices ?? [];
  const whtServices = form.wht_services ?? form.applications;
  const money = (value: string, tone = "", base = false) => (
    <Money value={value} currency={base ? "THB" : currency} className={tone} />
  );
  const input = (
    label: string,
    value: string,
    change: (value: string) => void,
    numeric = false,
  ) =>
    editable ? (
      <Input
        aria-label={label}
        value={value}
        inputMode={numeric ? "decimal" : undefined}
        className={numeric ? "min-w-24 text-right tabular-nums" : "min-w-32"}
        onChange={(event) => {
          if (!numeric || /^\d*(\.\d*)?$/.test(event.target.value))
            change(event.target.value);
        }}
      />
    ) : (
      <span className={numeric ? "tabular-nums" : ""}>{value || "—"}</span>
    );
  const remove = (label: string, action: () => void) =>
    editable ? (
      <Button
        aria-label={label}
        variant="ghost"
        size="icon-sm"
        onClick={action}
      >
        <Trash2 className="size-4" />
      </Button>
    ) : null;
  const patchApplication = (id: string, patch: Partial<ApPaymentApplication>) =>
    onChange({
      ...form,
      applications: form.applications.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  const patchWht = (id: string, patch: Partial<ApPaymentApplication>) =>
    onChange({
      ...form,
      wht_services: whtServices.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  const addWhtService = () => {
    const template = form.applications[0];
    const next: ApPaymentApplication = template
      ? {
          ...template,
          id: crypto.randomUUID(),
          wht_rate: "0",
          wht_base: "0",
          wht_amount: "0",
          wht_override_reason: "",
        }
      : {
          id: crypto.randomUUID(),
          invoice_id: "wht-service",
          invoice_no: `WHT-SERVICE-${form.applications.length + 1}`,
          vendor_invoice_no: "",
          po_no: null,
          grn_no: null,
          original_amount: "0",
          open_amount: "0",
          apply_amount: "0",
          wht_base: "0",
          wht_rate: "0",
          wht_amount: "0",
          net_cash: "0",
          match_status: "not_required",
        };
    onChange({ ...form, wht_services: [...whtServices, next] });
  };
  const patchMethod = (id: string, patch: Partial<ApPaymentMethodLine>) =>
    onChange({
      ...form,
      payment_methods: methods.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  const invoiceEvidence = (item: ApPaymentApplication) => {
    const invoice = invoices.find((entry) => entry.id === item.invoice_id);
    return (
      <div className="bg-muted/20 border-b p-2 text-xs sm:p-3">
        <div className="grid gap-2 sm:grid-cols-4">
          <span>
            <b>Invoice evidence</b>
            <br />
            {item.invoice_no}
          </span>
          <span>
            Vendor invoice no.
            <br />
            <b>{item.vendor_invoice_no ?? "—"}</b>
          </span>
          <span>
            PO / GRN
            <br />
            <b>
              {item.po_no ?? "—"} / {item.grn_no ?? "—"}
            </b>
          </span>
          <span>
            Match
            <br />
            <ApStatusBadge value={item.match_status} />
          </span>
        </div>
        {invoice?.lines?.length ? (
          <div className="mt-3 grid gap-1 border-t pt-2">
            {invoice.lines.map((line) => (
              <div
                key={line.id}
                className="flex flex-wrap justify-between gap-2"
              >
                <span>{line.description}</span>
                <span className="tabular-nums">
                  {money(line.net_amount)} + VAT {money(line.vat_amount ?? "0")}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  const invoiceColumns: ColumnDef<ApPaymentApplication>[] = [
    {
      id: "detail",
      header: "",
      cell: ({ row }) => (
        <Button
          aria-label={`${row.getIsExpanded() ? "Hide" : "Show"} invoice evidence ${row.original.invoice_no}`}
          variant="ghost"
          size="icon-sm"
          onClick={() => row.toggleExpanded()}
        >
          <ChevronDown
            className={`size-4 transition-transform ${row.getIsExpanded() ? "rotate-180" : ""}`}
          />
        </Button>
      ),
      meta: { expandedContent: invoiceEvidence },
    },
    {
      id: "document",
      header: "Doc no. / Tax status",
      cell: ({ row: { original: item } }) => (
        <div className="space-y-1">
          <Link
            className="text-primary font-medium hover:underline"
            to={`/accounting/accounts-payable/invoice/${item.invoice_id}`}
          >
            {item.invoice_no}
          </Link>
          <div>
            <span
              className={`text-micro-legal inline-flex rounded-md px-1.5 py-0.5 font-medium ${compareDecimal(item.vat_amount ?? "0", "0") < 0 ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}
            >
              {compareDecimal(item.vat_amount ?? "0", "0") < 0
                ? "Tax Credit"
                : "Undue VAT"}
              : {item.vat_amount ?? "0"}
            </span>
          </div>
        </div>
      ),
    },
    {
      id: "date",
      header: "Date",
      cell: ({ row }) => (
        <div className="grid gap-1">
          <span>{row.original.invoice_date ?? "—"}</span>
          <span className="text-muted-foreground text-xs">
            Due: {row.original.due_date ?? "—"}
          </span>
        </div>
      ),
    },
    {
      id: "description",
      header: "Description",
      cell: ({ row }) => (
        <div className="min-w-40">
          <p>{row.original.description ?? row.original.vendor_invoice_no}</p>
          <p className="text-muted-foreground text-xs">
            {row.original.po_no ?? "—"} / {row.original.grn_no ?? "—"}
          </p>
        </div>
      ),
    },
    {
      id: "rate",
      header: "Orig. FX",
      cell: ({ row }) => row.original.original_rate ?? form.exchange_rate,
    },
    {
      id: "net",
      header: "Net amount",
      cell: ({ row }) =>
        money(row.original.net_amount ?? row.original.wht_base),
      meta: { cellClassName: "text-right" },
    },
    {
      id: "vat",
      header: "VAT",
      cell: ({ row }) =>
        money(
          row.original.vat_amount ?? "0",
          "text-emerald-600 dark:text-emerald-400",
        ),
      meta: { cellClassName: "text-right" },
    },
    {
      id: "total",
      header: "Total / Open",
      cell: ({ row }) => (
        <div className="grid gap-1">
          {money(row.original.original_amount)}
          {money(
            row.original.open_amount,
            "text-amber-600 dark:text-amber-400",
          )}
        </div>
      ),
      meta: { cellClassName: "text-right" },
    },
    {
      id: "pay",
      header: "Pay amt.",
      cell: ({ row: { original: item } }) =>
        editable
          ? input(
              `Pay amount ${item.invoice_no}`,
              item.apply_amount,
              (value) =>
                patchApplication(item.id, {
                  apply_amount: value,
                  net_cash: subtractDecimal(value, item.wht_amount),
                }),
              true,
            )
          : money(item.apply_amount, "text-primary font-semibold"),
      meta: { cellClassName: "text-right" },
    },
    {
      id: "base",
      header: "Base amt. (THB)",
      cell: ({ row }) =>
        money(
          multiplyDecimal(
            row.original.apply_amount,
            row.original.original_rate ?? form.exchange_rate,
          ),
          "text-primary font-semibold",
          true,
        ),
      meta: { cellClassName: "text-right bg-muted/30" },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        remove(`Remove ${row.original.invoice_no}`, () =>
          onChange({
            ...form,
            applications: form.applications.filter(
              (item) => item.id !== row.original.id,
            ),
          }),
        ),
    },
  ];
  return (
    <>
      <Tabs
        value={activeTab}
        onValueChange={onTabChange}
        className="flex-1 gap-4"
      >
        <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
          <TabsList variant="line">
            <TabsTrigger value="invoices">
              <ListChecks className="size-4" />
              1. Settlement &amp; Payment{" "}
              <Badge variant="secondary">
                ({form.applications.length} Docs)
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="tax">
              <ReceiptText className="size-4" />
              2. Tax Invoice &amp; Allocation{" "}
              <Badge variant="secondary">({taxes.length} Tax Inv)</Badge>
            </TabsTrigger>
            <TabsTrigger value="journal">
              <BookOpen className="size-4" />
              3. Journal GL
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs">
            <span className="text-muted-foreground font-medium tracking-wide whitespace-nowrap uppercase">
              Jump To:
            </span>
            {[
              ["sec-settled-invoices", "Settled Invoice", ListChecks],
              ["sec-deposit-offsets", "Deposit Offset", Tags],
              ["sec-payment-methods", "Payment Method", Landmark],
              ["sec-withholding-tax", "WHT", Tags],
              ["sec-other-expense", "Other Expense", ReceiptText],
            ].map(([id, label, Icon]) => (
              <Button
                key={id as string}
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs whitespace-nowrap"
                onClick={() =>
                  document
                    .getElementById(id as string)
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
              >
                <Icon className="size-3.5" />
                {label as string}
              </Button>
            ))}
          </div>
        </div>
        <TabsContent value="invoices" className="space-y-4">
          <Section
            id="sec-settled-invoices"
            title="Settled invoices & credit notes"
            description={`${form.applications.length} Documents in batch`}
            action={
              editable && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onTabChange("tax")}
                  >
                    Go to Tax Allocation
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setInvoiceDialog(true)}
                  >
                    Select Documents
                  </Button>
                </div>
              )
            }
          >
            <ApDetailGrid
              rows={form.applications}
              columns={invoiceColumns}
              empty="Select outstanding invoices to build this payment."
              expanded={expandedRows}
              onExpandedChange={(updater) =>
                setExpandedRows((prev) =>
                  typeof updater === "function"
                    ? (updater(prev) as Record<string, boolean>)
                    : (updater as Record<string, boolean>),
                )
              }
            />
            <div className="bg-muted/20 grid min-w-[1080px] grid-cols-[40px_190px_110px_minmax(220px,1fr)_100px_125px_95px_135px_120px_140px_40px] items-center border-t px-2 py-1.5 text-right text-xs">
              <span className="col-span-5 text-right font-semibold">
                DOCUMENT SUBTOTALS:
              </span>
              <span>
                {money(
                  addDecimal(
                    form.applications.map((x) => x.net_amount ?? x.wht_base),
                  ),
                )}
              </span>
              <span>
                {money(
                  addDecimal(form.applications.map((x) => x.vat_amount ?? "0")),
                )}
              </span>
              <span>{money(summary.applied)}</span>
              <span className="text-primary font-semibold">
                {money(summary.applied)}
              </span>
              <span className="text-primary font-semibold">
                {money(summary.base, "", true)}
              </span>
              <span />
            </div>
            <div className="bg-muted/10 grid min-w-[1080px] grid-cols-[40px_190px_110px_minmax(220px,1fr)_100px_125px_95px_135px_120px_140px_40px] items-center border-t px-2 py-1.5 text-right text-xs">
              <span className="col-span-8 text-right font-medium">
                Exchange Gain (Loss) [Total Base Amt. - (Total Pay Amt. × Header
                Rate)]:
              </span>
              <span className="text-muted-foreground">formula</span>
              <span className={fxTone}>
                {money(summary.fx, "font-semibold", true)}
              </span>
              <span />
            </div>
            <div className="bg-muted/20 grid min-w-[1080px] grid-cols-[40px_190px_110px_minmax(220px,1fr)_100px_125px_95px_135px_120px_140px_40px] items-center border-t px-2 py-1.5 text-right text-xs">
              <span className="col-span-8 text-right font-semibold">
                TOTAL SETTLED AP LIABILITY (BOOK VALUE INCL. FX REALIZATION):
              </span>
              <span className="text-primary font-semibold">
                {money(summary.applied)}
              </span>
              <span className="text-primary font-semibold">
                {money(summary.payment_base, "", true)}
              </span>
              <span />
            </div>
          </Section>
          <Section
            id="sec-deposit-offsets"
            title="Advance Deposit Offset (เงินมัดจำจ่ายล่วงหน้า)"
            description="Offset pre-paid advance deposits (APDP) against current payment outflow"
            action={
              editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setSelectedDepositId(availableDeposits[0].id);
                    setOffsetAmountInput(
                      availableDeposits[0].remaining_deposit_amount,
                    );
                    setDepositDialog(true);
                  }}
                >
                  <Plus className="size-4" />
                  Apply Deposit Offset
                </Button>
              )
            }
          >
            {form.deposit_offsets && form.deposit_offsets.length > 0 ? (
              <ApDetailGrid
                rows={form.deposit_offsets}
                columns={[
                  {
                    id: "no",
                    header: "#",
                    cell: ({ row }) => row.index + 1,
                  },
                  {
                    id: "deposit_no",
                    header: "Deposit Ref No.",
                    cell: ({ row }) => (
                      <span className="text-primary font-semibold">
                        {row.original.deposit_no}
                      </span>
                    ),
                  },
                  {
                    id: "date",
                    header: "Deposit Date",
                    cell: ({ row }) => row.original.deposit_date,
                  },
                  {
                    id: "original",
                    header: "Original Deposit",
                    cell: ({ row }) =>
                      money(row.original.original_deposit_amount),
                    meta: { cellClassName: "text-right" },
                  },
                  {
                    id: "remaining",
                    header: "Remaining",
                    cell: ({ row }) =>
                      money(row.original.remaining_deposit_amount),
                    meta: { cellClassName: "text-right" },
                  },
                  {
                    id: "offset",
                    header: "Offset Amount",
                    cell: ({ row }) => (
                      <span className="text-destructive font-semibold">
                        −{money(row.original.offset_amount)}
                      </span>
                    ),
                    meta: { cellClassName: "text-right" },
                  },
                  {
                    id: "note",
                    header: "Note",
                    cell: ({ row }) => row.original.note ?? "—",
                  },
                  {
                    id: "action",
                    header: "",
                    cell: ({ row }) =>
                      remove(
                        `Remove deposit offset ${row.original.deposit_no}`,
                        () => {
                          onChange({
                            ...form,
                            deposit_offsets: form.deposit_offsets?.filter(
                              (_, i) => i !== row.index,
                            ),
                          });
                        },
                      ),
                  },
                ]}
              />
            ) : (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No advance deposits applied to this payment. Click &quot;Apply
                Deposit Offset&quot; to deduct pre-paid balances.
              </p>
            )}
            {compareDecimal(summary.deposit_offset_total, "0") > 0 && (
              <div className="bg-muted/20 flex items-center justify-between border-t px-4 py-2 text-xs">
                <span className="font-semibold">
                  TOTAL DEPOSIT OFFSET DEDUCTION:
                </span>
                <span className="text-destructive font-semibold">
                  −{money(summary.deposit_offset_total)} {currency} (
                  {money(summary.deposit_offset_base, "", true)} THB)
                </span>
              </div>
            )}
          </Section>
          <Section
            id="sec-payment-methods"
            title="Payment Methods & Multi-Bank Allocation"
            description="Allocate disbursement across bank accounts with Pay to payee, Payment Type & Ref. No."
            action={
              editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setMethodDialog(true)}
                  /* draft is committed from the dialog below */
                  onDoubleClick={() =>
                    onChange({
                      ...form,
                      payment_methods: [
                        ...methods,
                        {
                          ...methods[0],
                          id: crypto.randomUUID(),
                          method: "bank_transfer",
                          bank_account: "",
                          payee: form.vendor_name,
                          reference: "",
                          account: "1011001",
                          cost_center: "800",
                          dimensions: "",
                          amount: "0",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Add Payment
                </Button>
              )
            }
          >
            <ApDetailGrid
              rows={methods}
              columns={[
                {
                  id: "method",
                  header: "Payment method / Bank",
                  cell: ({ row: { original: item } }) => (
                    <div className="grid min-w-[200px] gap-1">
                      {editable ? (
                        <Select
                          value={item.method}
                          onValueChange={(
                            value: ApPaymentMethodLine["method"],
                          ) => {
                            const matchedType = paymentTypes.find(
                              (p) =>
                                p.payment_method === value || p.code === value,
                            );
                            patchMethod(item.id, {
                              method:
                                (matchedType?.payment_method as ApPaymentMethodLine["method"]) ??
                                value,
                            });
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {paymentTypes.map((pt) => (
                              <SelectItem key={pt.id} value={pt.payment_method}>
                                {pt.code} : {pt.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <span className="text-xs font-medium">
                          {paymentTypes.find(
                            (p) => p.payment_method === item.method,
                          )?.description ?? item.method.replaceAll("_", " ")}
                        </span>
                      )}
                      {editable && bankAccounts.length > 0 ? (
                        <Select
                          value={
                            bankAccounts.find(
                              (b) => b.account_number === item.bank_account,
                            )?.id ?? ""
                          }
                          onValueChange={(bankId) => {
                            const selectedBank = bankAccounts.find(
                              (b) => b.id === bankId,
                            );
                            if (selectedBank) {
                              patchMethod(item.id, {
                                bank_account: `${selectedBank.bank_name.split(" ")[0]} ${selectedBank.account_number}`,
                                account:
                                  selectedBank.gl_account_id ?? item.account,
                              });
                            }
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue placeholder="Select bank account..." />
                          </SelectTrigger>
                          <SelectContent>
                            {bankAccounts.map((bank) => (
                              <SelectItem key={bank.id} value={bank.id}>
                                {bank.bank_name} ({bank.account_number})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                      {input(
                        "Masked bank account",
                        item.bank_account,
                        (bank_account) =>
                          patchMethod(item.id, { bank_account }),
                      )}
                    </div>
                  ),
                },
                ...(
                  [
                    ["payee", "Pay to (Payee)"],
                    ["reference", "Ref. / Cheque no."],
                    ["account", "Account code"],
                    ["cost_center", "Cost center"],
                    ["dimensions", "Dimensions"],
                  ] as const
                ).map(([key, header]) => ({
                  id: key,
                  header,
                  cell: ({ row }: { row: { original: ApPaymentMethodLine } }) =>
                    input(header, row.original[key], (value) =>
                      patchMethod(row.original.id, { [key]: value }),
                    ),
                })),
                {
                  id: "amount",
                  header: "Pay amt.",
                  cell: ({ row }) =>
                    editable
                      ? input(
                          "Method pay amount",
                          row.original.amount,
                          (amount) => patchMethod(row.original.id, { amount }),
                          true,
                        )
                      : money(row.original.amount, "text-primary"),
                  meta: { cellClassName: "text-right" },
                },
                {
                  id: "base",
                  header: "Base amt. (THB)",
                  cell: ({ row }) =>
                    money(
                      multiplyDecimal(row.original.amount, form.exchange_rate),
                      "text-primary",
                      true,
                    ),
                  meta: { cellClassName: "text-right" },
                },
                {
                  id: "actions",
                  header: "",
                  cell: ({ row }) => (
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        aria-label="Edit payment method"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => setMethodEditor(row.original.id)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {remove("Remove payment method", () =>
                        onChange({
                          ...form,
                          payment_methods: methods.filter(
                            (item) => item.id !== row.original.id,
                          ),
                        }),
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <div className="bg-muted/20 grid min-w-[1337px] grid-cols-[212px_238px_159px_134px_116px_119px_128px_150px_78px] items-center border-t px-2 py-1.5 text-right text-xs font-semibold">
              <span className="col-span-6 text-right">
                TOTAL BANK DISBURSEMENT:
              </span>
              <span className="text-primary">
                {money(addDecimal(methods.map((item) => item.amount)))}
              </span>
              <span className="text-primary">
                {money(
                  addDecimal(
                    methods.map((item) =>
                      multiplyDecimal(item.amount, form.exchange_rate),
                    ),
                  ),
                  "",
                  true,
                )}
              </span>
              <span />
            </div>
          </Section>
          <Section
            id="sec-withholding-tax"
            title="Withholding Tax (WHT)"
            description="PND2, PND3, PND53 Certificates (Up to 3 Services)"
            action={
              editable && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={addWhtService}>
                    <Plus className="size-4" />
                    Add WHT Service
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.print()}
                  >
                    Print WHT
                  </Button>
                </div>
              )
            }
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">WHT No.</span>
                {input("WHT No.", form.wht_no ?? "", (value) =>
                  onChange({ ...form, wht_no: value }),
                )}
              </label>
              <label className="grid gap-1 text-xs">
                <span className="text-muted-foreground">Tax form</span>
                {editable ? (
                  <Select
                    value={form.wht_form ?? "PND53"}
                    onValueChange={(code) => {
                      const selected = whtForms.find((f) => f.code === code);
                      onChange({
                        ...form,
                        wht_form: code,
                        wht_account: selected?.gl_account_id
                          ? `${selected.gl_account_id} : Accrued WHT ${code.replace("PND", "")}`
                          : form.wht_account,
                      });
                    }}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Select WHT form..." />
                    </SelectTrigger>
                    <SelectContent>
                      {whtForms.map((wf) => (
                        <SelectItem key={wf.id} value={wf.code}>
                          {wf.code} : {wf.description}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="flex h-9 items-center font-medium">
                    {form.wht_form ?? "PND53"}
                  </span>
                )}
              </label>
              {(
                [
                  ["wht_account", "Account code"],
                  ["wht_cost_center", "Cost center"],
                  ["wht_dimensions", "Dimensions"],
                  ["wht_payee_name", "Name (Payee / Tax Entity)"],
                  ["wht_tax_id", "Payee tax ID"],
                  ["wht_branch", "Branch"],
                  ["wht_address", "Payee address"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="grid gap-1 text-xs">
                  <span className="text-muted-foreground">{label}</span>
                  {input(
                    label,
                    form[key] ??
                      (
                        {
                          wht_account: "2012006 : Accrued WHT 53",
                          wht_cost_center: "800 : Non-Operating",
                          wht_dimensions: "BRD-GRAND-SEAFOC",
                          wht_payee_name: form.vendor_name,
                        } as Record<string, string>
                      )[key] ??
                      "",
                    (value) => onChange({ ...form, [key]: value }),
                  )}
                </label>
              ))}
            </div>
            <ApDetailGrid
              rows={whtServices}
              columns={[
                {
                  id: "service",
                  header: "WHT service / Invoice",
                  cell: ({ row: { original: item } }) =>
                    editable ? (
                      <Select
                        value={item.invoice_no}
                        onValueChange={(value) => {
                          const match = form.applications.find(
                            (entry) => entry.invoice_no === value,
                          );
                          if (match)
                            patchWht(item.id, {
                              invoice_id: match.invoice_id,
                              invoice_no: match.invoice_no,
                              wht_base: match.wht_base,
                            });
                        }}
                      >
                        <SelectTrigger className="min-w-56">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {form.applications.map((entry) => (
                            <SelectItem key={entry.id} value={entry.invoice_no}>
                              {entry.invoice_no} ·{" "}
                              {entry.description ?? "Service"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      item.invoice_no
                    ),
                },
                {
                  id: "service_type",
                  header: "WHT Category / Rate",
                  cell: ({ row: { original: item } }) =>
                    editable && whtServiceTypes.length > 0 ? (
                      <Select
                        value={
                          whtServiceTypes.find(
                            (s) => s.default_rate === item.wht_rate,
                          )?.id ?? ""
                        }
                        onValueChange={(typeId) => {
                          const matched = whtServiceTypes.find(
                            (s) => s.id === typeId,
                          );
                          if (matched) {
                            patchWht(item.id, {
                              wht_rate: matched.default_rate,
                              wht_amount: percentOf(
                                item.wht_base,
                                matched.default_rate,
                              ),
                            });
                          }
                        }}
                      >
                        <SelectTrigger className="h-8 min-w-44 text-xs">
                          <SelectValue placeholder="Select service rate..." />
                        </SelectTrigger>
                        <SelectContent>
                          {whtServiceTypes.map((st) => (
                            <SelectItem key={st.id} value={st.id}>
                              {st.code} ({st.default_rate}%) ·{" "}
                              {st.description.split("(")[0]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <span className="text-xs">
                        {whtServiceTypes.find(
                          (s) => s.default_rate === item.wht_rate,
                        )?.description ?? `${item.wht_rate}%`}
                      </span>
                    ),
                },
                {
                  id: "rate",
                  header: "Rate %",
                  cell: ({ row: { original: item } }) =>
                    input(
                      `WHT rate ${item.invoice_no}`,
                      item.wht_rate,
                      (value) =>
                        patchWht(item.id, {
                          wht_rate: value,
                          wht_amount: percentOf(item.wht_base, value),
                        }),
                      true,
                    ),
                },
                {
                  id: "base",
                  header: "Tax base",
                  cell: ({ row: { original: item } }) =>
                    input(
                      `WHT base ${item.invoice_no}`,
                      item.wht_base,
                      (value) =>
                        patchWht(item.id, {
                          wht_base: value,
                          wht_amount: percentOf(value, item.wht_rate),
                        }),
                      true,
                    ),
                },
                {
                  id: "amount",
                  header: "WHT amount",
                  cell: ({ row: { original: item } }) =>
                    editable
                      ? input(
                          `WHT override ${item.invoice_no}`,
                          item.wht_amount,
                          (value) => patchWht(item.id, { wht_amount: value }),
                          true,
                        )
                      : money(
                          item.wht_amount,
                          "text-rose-600 dark:text-rose-400",
                        ),
                },
                {
                  id: "functional",
                  header: "Base amt. (THB)",
                  cell: ({ row }) =>
                    money(
                      multiplyDecimal(
                        row.original.wht_amount,
                        form.exchange_rate,
                      ),
                      "text-rose-600 dark:text-rose-400",
                      true,
                    ),
                },
                {
                  id: "reason",
                  header: "Override reason",
                  cell: ({ row: { original: item } }) =>
                    input(
                      "WHT override reason",
                      item.wht_override_reason ?? "",
                      (value) =>
                        patchWht(item.id, {
                          wht_override_reason: value,
                        }),
                    ),
                },
              ]}
              empty="No invoice withholding tax."
            />
            <div className="bg-muted/20 grid min-w-[1337px] grid-cols-[311px_175px_154px_213px_242px_242px] items-center border-t px-2 py-1.5 text-right text-xs font-semibold">
              <span className="col-span-4 text-right">Total WHT Deducted:</span>
              <span className="text-rose-600 dark:text-rose-400">
                {money(summary.wht_base, "", true)}
              </span>
              <span />
            </div>
          </Section>
          <Section
            id="sec-other-expense"
            title="Other Expense & Miscellaneous Surcharges"
            description="Capture bank fees, surcharges and miscellaneous disbursement costs."
            action={
              editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setExpenseDialog(true)}
                  onDoubleClick={() =>
                    onChange({
                      ...form,
                      other_expenses: [
                        ...expenses,
                        {
                          id: crypto.randomUUID(),
                          description: "",
                          account: "",
                          cost_center: "800",
                          dimensions: "",
                          base_amount: "0",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Add Expense
                </Button>
              )
            }
          >
            <ApDetailGrid
              rows={expenses}
              columns={[
                ...(
                  [
                    ["description", "Description / Memo"],
                    ["account", "Account code"],
                    ["cost_center", "Cost center"],
                    ["dimensions", "Dimensions"],
                    ["base_amount", "Base amt. (THB)"],
                  ] as const
                ).map(([key, header]) => ({
                  id: key,
                  header,
                  cell: ({
                    row,
                  }: {
                    row: { original: (typeof expenses)[number] };
                  }) =>
                    input(
                      header,
                      row.original[key],
                      (value) =>
                        onChange({
                          ...form,
                          other_expenses: expenses.map((item) =>
                            item.id === row.original.id
                              ? { ...item, [key]: value }
                              : item,
                          ),
                        }),
                      key === "base_amount",
                    ),
                })),
                {
                  id: "actions",
                  header: "",
                  cell: ({ row }) =>
                    remove("Remove expense", () =>
                      onChange({
                        ...form,
                        other_expenses: expenses.filter(
                          (item) => item.id !== row.original.id,
                        ),
                      }),
                    ),
                },
              ]}
              empty="No additional expenses."
            />
            <div className="bg-muted/20 flex justify-end gap-1.5 border-t px-2 py-1.5 text-xs font-semibold">
              Total Other Expenses:{" "}
              {money(
                summary.expenses,
                "text-amber-600 dark:text-amber-400",
                true,
              )}
            </div>
          </Section>
          <div className="flex flex-wrap justify-end gap-3 rounded-lg border px-3 py-2 text-sm">
            <span>Base {money(summary.base, "", true)}</span>
            <span>FX {money(summary.fx, fxTone, true)}</span>
            <span>
              WHT{" "}
              {money(
                summary.wht_base,
                "text-rose-600 dark:text-rose-400",
                true,
              )}
            </span>
            <span>
              Expenses{" "}
              {money(
                summary.expenses,
                "text-amber-600 dark:text-amber-400",
                true,
              )}
            </span>
            <span>
              Net outflow{" "}
              {money(summary.net_base, "text-primary font-semibold", true)}
            </span>
          </div>
        </TabsContent>
        <TabsContent value="tax" className="space-y-4">
          <Section
            title="Received tax invoice register"
            action={
              editable && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    onChange({
                      ...form,
                      tax_invoices: [
                        ...taxes,
                        {
                          id: crypto.randomUUID(),
                          document_no: "",
                          date: form.paid_date ?? form.payment_date,
                          tax_id: form.wht_tax_id ?? "",
                          branch: "00000",
                          profile: "VAT7",
                          filing_period: (
                            form.paid_date ?? form.payment_date
                          ).slice(0, 7),
                          status: "pending",
                          base_amount: "0",
                          vat_amount: "0",
                        },
                      ],
                    })
                  }
                >
                  <Plus className="size-4" />
                  Record tax invoice
                </Button>
              )
            }
          >
            <ApDetailGrid
              rows={taxes}
              columns={[
                ...(
                  [
                    ["document_no", "Tax invoice no."],
                    ["date", "Tax invoice date"],
                    ["tax_id", "Vendor tax ID"],
                    ["branch", "Branch"],
                    ["profile", "Tax profile"],
                    ["filing_period", "Filing period"],
                    ["base_amount", "Tax base (THB)"],
                    ["vat_amount", "VAT (THB)"],
                  ] as const
                ).map(([key, header]) => ({
                  id: key,
                  header,
                  cell: ({
                    row,
                  }: {
                    row: { original: (typeof taxes)[number] };
                  }) =>
                    input(
                      header,
                      row.original[key],
                      (value) =>
                        onChange({
                          ...form,
                          tax_invoices: taxes.map((item) =>
                            item.id === row.original.id
                              ? {
                                  ...item,
                                  [key]: value,
                                  ...(key === "base_amount"
                                    ? { vat_amount: percentOf(value, "7") }
                                    : {}),
                                }
                              : item,
                          ),
                        }),
                      key === "base_amount" || key === "vat_amount",
                    ),
                })),
                {
                  id: "status",
                  header: "Tax status",
                  cell: ({ row }) => (
                    <ApStatusBadge value={row.original.status} />
                  ),
                },
                {
                  id: "actions",
                  header: "",
                  cell: ({ row }) =>
                    remove("Remove tax invoice", () =>
                      onChange({
                        ...form,
                        tax_invoices: taxes.filter(
                          (item) => item.id !== row.original.id,
                        ),
                      }),
                    ),
                },
              ]}
              empty="No received tax invoices recorded."
            />
            <div className="bg-muted/20 flex justify-end gap-3 border-t px-2 py-1.5 text-xs font-semibold">
              Tax invoice totals: Base{" "}
              {money(
                addDecimal(taxes.map((item) => item.base_amount)),
                "",
                true,
              )}{" "}
              <span>
                VAT{" "}
                {money(
                  addDecimal(taxes.map((item) => item.vat_amount)),
                  "text-emerald-600 dark:text-emerald-400",
                  true,
                )}
              </span>
            </div>
          </Section>
          <PaymentTaxAllocation
            form={form}
            onChange={onChange}
            editable={editable}
          />
        </TabsContent>
        <TabsContent value="journal">
          <Section title="Journal GL preview">
            <p className="text-muted-foreground text-xs">
              Read-only posting preview · Paid date{" "}
              {form.paid_date ?? form.payment_date} · THB
            </p>
            <ApDetailGrid
              rows={summary.journal}
              columns={[
                { accessorKey: "account", header: "Account code" },
                { accessorKey: "description", header: "Comment" },
                {
                  id: "debit",
                  header: "Debit",
                  cell: ({ row }) =>
                    money(row.original.debit, "text-primary", true),
                  meta: { cellClassName: "text-right" },
                },
                {
                  id: "credit",
                  header: "Credit",
                  cell: ({ row }) =>
                    money(
                      row.original.credit,
                      "text-emerald-600 dark:text-emerald-400",
                      true,
                    ),
                  meta: { cellClassName: "text-right" },
                },
              ]}
            />
          </Section>
        </TabsContent>
      </Tabs>
      <Dialog open={invoiceDialog} onOpenChange={setInvoiceDialog}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>
              Select Outstanding Invoices &amp; Credit Notes
            </DialogTitle>
            <DialogDescription>
              Vendor: {form.vendor_name || "All eligible vendors"}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-2 text-left">Doc No.</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Due Date</th>
                  <th className="p-2 text-left">Description</th>
                  <th className="p-2 text-right">Orig. FX</th>
                  <th className="p-2 text-right">Inv. Total</th>
                  <th className="p-2 text-right">Pay Amt.</th>
                </tr>
              </thead>
              <tbody>
                {invoices
                  .filter(
                    (item) =>
                      !form.applications.some(
                        (app) => app.invoice_id === item.id,
                      ),
                  )
                  .map((item) => (
                    <tr key={item.id} className="hover:bg-muted/20">
                      <td className="p-2">
                        <Button
                          variant="link"
                          className="h-auto p-0 text-xs"
                          onClick={() => {
                            onAddInvoice(item.id);
                            setInvoiceDialog(false);
                          }}
                        >
                          {item.ap_no}
                        </Button>
                      </td>
                      <td className="p-2">{item.invoice_date}</td>
                      <td className="p-2 font-medium">
                        {item.due_date ?? "—"}
                      </td>
                      <td className="p-2">{item.description}</td>
                      <td className="p-2 text-right">
                        {item.currency_code} @ {item.exchange_rate}
                      </td>
                      <td className="p-2 text-right">
                        {money(item.total_amount)}
                      </td>
                      <td className="text-primary p-2 text-right">
                        {money(item.open_amount)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <span className="text-muted-foreground mr-auto text-xs">
              Select a document row to apply
            </span>
            <Button variant="outline" onClick={() => setInvoiceDialog(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={methodDialog} onOpenChange={setMethodDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Select payment type, bank account, specify Pay to payee and
              reference.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">
                Payment Type (Master Table)
              </span>
              <Select
                value={selectedPaymentTypeCode}
                onValueChange={setSelectedPaymentTypeCode}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {paymentTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.code}>
                      {pt.code} : {pt.description}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-muted-foreground text-xs">
                Disbursing Bank Account
              </span>
              <Select value={selectedBankId} onValueChange={setSelectedBankId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select bank account..." />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name} ({b.account_number}) ·{" "}
                      {b.branch_name ?? "Head Office"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            <Input
              aria-label="Payment payee"
              placeholder="Pay to (Payee Name)"
              defaultValue={form.vendor_name}
            />
            {(() => {
              const activeBank = bankAccounts.find(
                (b) => b.id === selectedBankId,
              );
              return (
                <div className="bg-muted/20 space-y-1 rounded-md border p-3 text-xs">
                  <p className="text-primary font-semibold">
                    🔒 PRE-MAPPED GL POSTING (MASTER SETTING)
                  </p>
                  <p>
                    Account Code:{" "}
                    <b>
                      {activeBank?.gl_account_id ??
                        "1011001 : Cash / Bank Account"}
                    </b>
                  </p>
                  <p>
                    Cost Center: <b>800 : Non-Operating / Finance</b>
                  </p>
                  <p>
                    Disbursement Bank:{" "}
                    <b>
                      {activeBank
                        ? `${activeBank.bank_name} (${activeBank.account_number})`
                        : "General Cash / Bank"}
                    </b>
                  </p>
                </div>
              );
            })()}
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Payment reference"
                placeholder="Ref. No. / Cheque No."
                defaultValue="CSH-VOUCHER"
              />
              <Input
                aria-label="Payment amount"
                inputMode="decimal"
                placeholder="Pay Amt."
                defaultValue={summary.net_cash}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMethodDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const activeBank = bankAccounts.find(
                  (b) => b.id === selectedBankId,
                );
                const activeType = paymentTypes.find(
                  (pt) => pt.code === selectedPaymentTypeCode,
                );
                onChange({
                  ...form,
                  payment_methods: [
                    ...methods,
                    {
                      id: crypto.randomUUID(),
                      method:
                        (activeType?.payment_method as ApPaymentMethodLine["method"]) ??
                        "bank_transfer",
                      bank_account: activeBank
                        ? `${activeBank.bank_name.split(" ")[0]} ${activeBank.account_number}`
                        : "",
                      payee: form.vendor_name,
                      reference: "",
                      account: activeBank?.gl_account_id ?? "1011001",
                      cost_center: "800",
                      dimensions: "",
                      amount: summary.net_cash,
                    },
                  ],
                });
                setMethodDialog(false);
              }}
            >
              Add to Method List
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={expenseDialog} onOpenChange={setExpenseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Other Expense</DialogTitle>
            <DialogDescription>
              Configure expense details, account code and dimensions.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Input
              aria-label="Expense description"
              placeholder="Description / Memo"
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                aria-label="Expense account code"
                placeholder="Account Code"
                defaultValue="5041005 : Freight & Handling"
              />
              <Input
                aria-label="Expense cost center"
                placeholder="Cost Center"
                defaultValue="801 : Administrative & General"
              />
            </div>
            <Input
              aria-label="Expense dimensions"
              placeholder="Dimensions"
              defaultValue="PRJ-2026-SEAFOOD · BRD-CORE"
            />
            <Input
              aria-label="Expense amount"
              inputMode="decimal"
              placeholder="Base Amt. (THB)"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExpenseDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                onChange({
                  ...form,
                  other_expenses: [
                    ...expenses,
                    {
                      id: crypto.randomUUID(),
                      description: "Miscellaneous surcharge",
                      account: "",
                      cost_center: "800",
                      dimensions: "",
                      base_amount: "0",
                    },
                  ],
                });
                setExpenseDialog(false);
              }}
            >
              Save Expense
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={depositDialog} onOpenChange={setDepositDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Apply Advance Deposit Offset</DialogTitle>
            <DialogDescription>
              Select pre-paid advance deposit (APDP) from {form.vendor_name} to
              deduct from this payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">
                Select Advance Deposit
              </span>
              <Select
                value={selectedDepositId}
                onValueChange={(id) => {
                  setSelectedDepositId(id);
                  const matched = availableDeposits.find((d) => d.id === id);
                  if (matched)
                    setOffsetAmountInput(matched.remaining_deposit_amount);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select deposit..." />
                </SelectTrigger>
                <SelectContent>
                  {availableDeposits.map((dep) => (
                    <SelectItem key={dep.id} value={dep.id}>
                      {dep.deposit_no} · Rem. {dep.remaining_deposit_amount} THB
                      ({dep.deposit_date})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
            {selectedDepositId && (
              <div className="bg-muted/30 space-y-1 rounded-md p-2.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Original Deposit Amount:
                  </span>
                  <span className="font-semibold">
                    {
                      availableDeposits.find((d) => d.id === selectedDepositId)
                        ?.original_deposit_amount
                    }{" "}
                    {currency}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">
                    Available Remaining:
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                    {
                      availableDeposits.find((d) => d.id === selectedDepositId)
                        ?.remaining_deposit_amount
                    }{" "}
                    {currency}
                  </span>
                </div>
                <p className="text-muted-foreground text-micro pt-1">
                  {
                    availableDeposits.find((d) => d.id === selectedDepositId)
                      ?.note
                  }
                </p>
              </div>
            )}
            <label className="grid gap-1 text-xs">
              <span className="text-muted-foreground">
                Offset Deduction Amount
              </span>
              <Input
                inputMode="decimal"
                value={offsetAmountInput}
                onChange={(e) => {
                  if (/^\d*(\.\d*)?$/.test(e.target.value)) {
                    setOffsetAmountInput(e.target.value);
                  }
                }}
              />
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDepositDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const matched = availableDeposits.find(
                  (d) => d.id === selectedDepositId,
                );
                if (matched && Number(offsetAmountInput) > 0) {
                  const existingOffsets = form.deposit_offsets ?? [];
                  onChange({
                    ...form,
                    deposit_offsets: [
                      ...existingOffsets,
                      {
                        id: crypto.randomUUID(),
                        deposit_no: matched.deposit_no,
                        deposit_date: matched.deposit_date,
                        original_deposit_amount:
                          matched.original_deposit_amount,
                        remaining_deposit_amount:
                          matched.remaining_deposit_amount,
                        offset_amount: offsetAmountInput,
                        note: matched.note,
                      },
                    ],
                  });
                }
                setDepositDialog(false);
              }}
            >
              Apply Offset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
