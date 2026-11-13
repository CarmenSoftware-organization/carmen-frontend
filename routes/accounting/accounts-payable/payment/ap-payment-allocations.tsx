import { useMemo, useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type {
  ApOutstandingDocument,
  ApPaymentAllocation,
  DecimalString,
} from "@/types/accounts-payable";
import {
  addDecimal,
  compareDecimal,
  subtractDecimal,
} from "../shared/ap-decimal";
import { useApInvoice } from "../shared/use-accounts-payable";
import { allocationSign, invoiceAllocated, lineCap } from "./ap-payment-form";

// เงินบาทไม่เกิน 2 ตำแหน่ง — backend ปัดเศษเงียบ ๆ ถ้าให้พิมพ์เกิน ยอดบนจอจะไม่ตรงที่บันทึก
const DECIMAL_RE = /^\d*(\.\d{0,2})?$/;
const INVOICE_PATH = "/accounting/accounts-payable/invoice";
const TH = "px-2 py-1.5 text-xs font-medium whitespace-nowrap";
const TD = "px-2 py-1.5 text-xs align-middle";

function Money({ value }: { readonly value: DecimalString }) {
  const format = useAmountFormatter();
  return (
    <span className="block text-right tabular-nums">
      {format(Number(value || 0))}
    </span>
  );
}

export function PaymentAllocationsEditor(
  props: React.ComponentProps<typeof PaymentAllocationOptions> & {
    readonly inputDate?: string;
  },
) {
  const t = useTranslations("accounting.accountsPayable.ui");
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState(false);
  const [draft, setDraft] = useState<Record<string, DecimalString>>({});
  const selected = props.docs.filter((doc) =>
    doc.lines.some(
      (line) =>
        compareDecimal(
          props.allocations[line.ap_invoice_detail_id] || "0",
          "0",
        ) > 0,
    ),
  );
  const draftCurrency =
    props.lockedCurrency ??
    props.docs.find((doc) =>
      doc.lines.some(
        (line) =>
          compareDecimal(draft[line.ap_invoice_detail_id] || "0", "0") > 0,
      ),
    )?.currency_code ??
    null;
  const selectedIds = new Set(selected.map((doc) => doc.ap_invoice_id));
  const eligible = props.docs.filter(
    (doc) =>
      !props.inputDate ||
      doc.doc_date.slice(0, 10) <= props.inputDate ||
      selectedIds.has(doc.ap_invoice_id),
  );
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-muted-foreground text-xs">
          {t("selectedDocuments", { count: selected.length })}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            setDraft({ ...props.allocations });
            setOpen(true);
          }}
        >
          {t("selectDocument")}
        </Button>
      </div>
      {selected.length ? (
        <PaymentAllocationOptions {...props} docs={selected} />
      ) : (
        <p className="text-muted-foreground text-xs">
          {t("noSelectedDocuments")}
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85dvh] flex-col sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t("selectDocument")}</DialogTitle>
          </DialogHeader>
          <Tabs
            value={detail ? "detail" : "summary"}
            onValueChange={(value) => setDetail(value === "detail")}
          >
            <TabsList>
              <TabsTrigger value="summary">{t("summaryView")}</TabsTrigger>
              <TabsTrigger value="detail">{t("detailView")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="min-h-0 flex-1 overflow-auto">
            <PaymentAllocationOptions
              {...props}
              docs={eligible}
              allocations={draft}
              lockedCurrency={draftCurrency}
              showDetails={detail}
              onChangeLine={(id, value) =>
                setDraft((current) => ({ ...current, [id]: value }))
              }
              onPayFull={(doc) =>
                setDraft((current) => ({
                  ...current,
                  ...Object.fromEntries(
                    doc.lines.map((line) => [
                      line.ap_invoice_detail_id,
                      lineCap(line, props.ownReserved),
                    ]),
                  ),
                }))
              }
              onClear={(doc) =>
                setDraft((current) => {
                  const next = { ...current };
                  for (const line of doc.lines)
                    delete next[line.ap_invoice_detail_id];
                  return next;
                })
              }
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
            >
              {t("close")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                for (const id of new Set([
                  ...Object.keys(props.allocations),
                  ...Object.keys(draft),
                ]))
                  props.onChangeLine(id, draft[id] ?? "");
                setOpen(false);
              }}
            >
              {t("select")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** เลือกจ่ายบรรทัดของ invoice ที่ยังค้าง — ยอดต่อบรรทัด ไม่เกินเพดานของบรรทัดนั้น */
function PaymentAllocationOptions({
  docs,
  allocations,
  ownReserved,
  lockedCurrency,
  onChangeLine,
  onPayFull,
  onClear,
  showDetails = true,
}: {
  readonly docs: readonly ApOutstandingDocument[];
  readonly allocations: Readonly<Record<string, DecimalString>>;
  /** ยอดที่ใบนี้จองไว้เองตอนโหลด (ต่อบรรทัด) — บวกคืนเข้าเพดาน */
  readonly ownReserved: Readonly<Record<string, DecimalString>>;
  /** สกุลเงินของบรรทัดที่เลือกแล้ว — เอกสารสกุลอื่นเลือกไม่ได้ */
  readonly lockedCurrency: string | null;
  readonly onChangeLine: (lineId: string, value: DecimalString) => void;
  readonly onPayFull: (doc: ApOutstandingDocument) => void;
  readonly onClear: (doc: ApOutstandingDocument) => void;
  readonly showDetails?: boolean;
}) {
  const t = useTranslations(
    "accounting.accountsPayable.payment.detail.allocations",
  );
  const ti = useTranslations("accounting.accountsPayable.invoice");
  const { dateFormat } = useProfile();

  if (docs.length === 0)
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;

  return (
    <div className="flex flex-col gap-4">
      {docs.map((doc) => {
        const otherCurrency =
          !!lockedCurrency && doc.currency_code !== lockedCurrency;
        const negative = allocationSign(doc.doc_type) < 0;
        return (
          <section
            key={doc.ap_invoice_id}
            className="border-b pb-3"
            aria-label={doc.doc_no}
          >
            <header className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-xs">
              <Link
                className="font-medium underline"
                to={`${INVOICE_PATH}/${doc.ap_invoice_id}`}
              >
                {doc.doc_no}
              </Link>
              <span className="text-muted-foreground">
                {ti(`docTypes.${doc.doc_type}`)}
              </span>
              <span className="text-muted-foreground">
                {t("dueDate")}:{" "}
                {doc.due_date ? formatDate(doc.due_date, dateFormat) : "—"}
              </span>
              <span className="text-muted-foreground">{doc.currency_code}</span>
              {otherCurrency && (
                <span className="text-warning-ink">{t("otherCurrency")}</span>
              )}
              <span className="ml-auto flex items-center gap-2">
                <span className="text-muted-foreground">
                  {t("invoiceAllocated")}:
                </span>
                <span className="font-medium tabular-nums">
                  <InvoiceTotal doc={doc} allocations={allocations} />
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={otherCurrency}
                  onClick={() => onPayFull(doc)}
                >
                  {t("payFull")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onClear(doc)}
                >
                  {t("clear")}
                </Button>
              </span>
            </header>
            {showDetails && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[32rem] text-left">
                  <thead>
                    <tr className="border-b">
                      <th className={TH}>{t("line")}</th>
                      <th className={TH}>{t("description")}</th>
                      <th className={`${TH} text-right`}>{t("unpaid")}</th>
                      <th className={`${TH} text-right`}>{t("available")}</th>
                      <th className={`${TH} text-right`}>{t("payAmount")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {doc.lines.map((line) => {
                      const cap = lineCap(line, ownReserved);
                      const value =
                        allocations[line.ap_invoice_detail_id] ?? "";
                      const over =
                        !!value.trim() && compareDecimal(value, cap) > 0;
                      return (
                        <tr
                          key={line.ap_invoice_detail_id}
                          className="border-b last:border-b-0"
                        >
                          <td className={`${TD} tabular-nums`}>
                            {line.sequence_no}
                          </td>
                          <td className={TD}>{line.description || "—"}</td>
                          <td className={TD}>
                            <Money
                              value={
                                negative
                                  ? subtractDecimal("0", line.unpaid_amount)
                                  : line.unpaid_amount
                              }
                            />
                          </td>
                          <td className={TD}>
                            <Money
                              value={negative ? subtractDecimal("0", cap) : cap}
                            />
                          </td>
                          <td className={TD}>
                            <span className="flex items-center justify-end gap-1">
                              {negative && <span aria-hidden>-</span>}
                              <Input
                                aria-label={`${doc.doc_no} ${t("line")} ${line.sequence_no}`}
                                aria-invalid={over || undefined}
                                inputMode="decimal"
                                className="w-32 text-right tabular-nums"
                                disabled={otherCurrency}
                                value={value}
                                onChange={(event) => {
                                  if (DECIMAL_RE.test(event.target.value))
                                    onChangeLine(
                                      line.ap_invoice_detail_id,
                                      event.target.value,
                                    );
                                }}
                              />
                            </span>
                            {over && (
                              <span className="text-destructive block text-right text-xs">
                                {t("overAvailable")}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}

function InvoiceTotal({
  doc,
  allocations,
}: {
  readonly doc: ApOutstandingDocument;
  readonly allocations: Readonly<Record<string, DecimalString>>;
}) {
  const format = useAmountFormatter();
  return <>{format(Number(invoiceAllocated(doc, allocations)))}</>;
}

/** โหมดอ่านอย่างเดียว: จัดกลุ่มบรรทัดที่จ่ายตาม invoice (ชื่อเอกสาร/คำอธิบายบรรทัดมาจากใบ invoice) */
export function PaymentAllocationsReadOnly({
  allocations,
}: {
  readonly allocations: readonly ApPaymentAllocation[];
}) {
  const t = useTranslations(
    "accounting.accountsPayable.payment.detail.allocations",
  );
  const groups = useMemo(() => {
    const map = new Map<string, ApPaymentAllocation[]>();
    for (const a of allocations)
      map.set(a.ap_invoice_id, [...(map.get(a.ap_invoice_id) ?? []), a]);
    return [...map.entries()];
  }, [allocations]);
  if (groups.length === 0)
    return <p className="text-muted-foreground text-sm">{t("emptyRead")}</p>;
  return (
    <div className="flex flex-col gap-4">
      {groups.map(([invoiceId, rows]) => (
        <ReadOnlyGroup key={invoiceId} invoiceId={invoiceId} rows={rows} />
      ))}
    </div>
  );
}

function ReadOnlyGroup({
  invoiceId,
  rows,
}: {
  readonly invoiceId: string;
  readonly rows: readonly ApPaymentAllocation[];
}) {
  const t = useTranslations(
    "accounting.accountsPayable.payment.detail.allocations",
  );
  const ti = useTranslations("accounting.accountsPayable.invoice");
  const invoice = useApInvoice(invoiceId).data;
  const lineOf = (detailId: string) =>
    invoice?.lines?.find((l) => l.id === detailId);
  return (
    <section className="rounded-lg border">
      <header className="bg-muted/40 flex flex-wrap items-center gap-x-4 gap-y-1 border-b px-3 py-2 text-xs">
        <Link
          className="font-medium underline"
          to={`${INVOICE_PATH}/${invoiceId}`}
        >
          {invoice?.doc_no ?? t("openInvoice")}
        </Link>
        <span className="text-muted-foreground">
          {ti(`docTypes.${rows[0].doc_type}`)}
        </span>
        <span className="ml-auto font-medium tabular-nums">
          <Total values={rows.map((r) => r.applied_amount)} />
        </span>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[28rem] text-left">
          <thead>
            <tr className="border-b">
              <th className={TH}>{t("line")}</th>
              <th className={TH}>{t("description")}</th>
              <th className={`${TH} text-right`}>{t("payAmount")}</th>
              <th className={`${TH} text-right`}>{t("realizedFx")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const line = lineOf(row.ap_invoice_detail_id);
              return (
                <tr key={row.id} className="border-b last:border-b-0">
                  <td className={`${TD} tabular-nums`}>
                    {line?.sequence_no ?? "—"}
                  </td>
                  <td className={TD}>{line?.description || "—"}</td>
                  <td className={TD}>
                    <Money value={row.applied_amount} />
                  </td>
                  <td className={TD}>
                    <Money value={row.realized_fx_amount} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Total({ values }: { readonly values: readonly DecimalString[] }) {
  const format = useAmountFormatter();
  return <>{format(Number(addDecimal([...values])))}</>;
}
