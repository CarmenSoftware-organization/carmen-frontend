import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, Pencil, Save, Send, Trash2, Undo2, X } from "lucide-react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { DocFormHeader } from "@/components/share/doc-form-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Textarea } from "@/components/ui/textarea";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useBankAccounts } from "@/hooks/use-accounting-master";
import { useProfile } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api-error";
import { formatDate } from "@/lib/date-utils";
import type {
  ApPayment,
  ApUiAction,
  DecimalString,
} from "@/types/accounts-payable";
import { compareDecimal } from "../shared/ap-decimal";
import { apActions, apCanEdit } from "../shared/ap-status";
import {
  useApOutstandingDocuments,
  useApPayment,
  useApPaymentAction,
  useApWhtPreview,
  useDeleteApPayment,
  useSaveApPayment,
} from "../shared/use-accounts-payable";
import {
  PaymentAllocationsEditor,
  PaymentAllocationsReadOnly,
} from "./ap-payment-allocations";
import { PaymentExpensesSection } from "./ap-payment-expenses";
import {
  allocatedLines,
  emptyExpense,
  formTotals,
  initialPaymentForm,
  lineCap,
  mergeWhtPreview,
  toAllocationInputs,
  toPaymentInput,
  validatePaymentForm,
  type PaymentErrorKey,
  type PaymentForm,
} from "./ap-payment-form";
import { PaymentHeader } from "./ap-payment-header";
import { PaymentWhtSection } from "./ap-payment-wht";

const LIST_PATH = "/accounting/accounts-payable/payment";
const NO_ERRORS: ReadonlySet<PaymentErrorKey> = new Set();

export default function ApPaymentDetail() {
  const t = useTranslations("accounting.accountsPayable.payment.detail");
  const { id = "new" } = useParams<{ id: string }>();
  const query = useApPayment(id);
  if (id !== "new" && query.isLoading)
    return <Skeleton className="h-[70vh] rounded-lg" />;
  if (query.isError)
    return (
      <ErrorState
        error={query.error}
        message={t("loadError")}
        onRetry={() => void query.refetch()}
      />
    );
  if (id !== "new" && !query.data)
    return <ErrorState message={t("notFound")} />;
  return (
    <ApPaymentEditor
      // เปลี่ยน version = โหลดใหม่ → ฟอร์มเริ่มจากข้อมูลล่าสุดเสมอ
      key={`${id}:${query.data?.doc_version ?? 0}`}
      loaded={id === "new" ? null : query.data}
      refetch={() => void query.refetch()}
    />
  );
}

type ReasonAction = Extract<ApUiAction, "void" | "reject" | "return">;

function sortedSignature(
  inputs: readonly { ap_invoice_detail_id: string; applied_amount: string }[],
): string {
  return JSON.stringify(
    [...inputs].sort((a, b) =>
      a.ap_invoice_detail_id.localeCompare(b.ap_invoice_detail_id),
    ),
  );
}

function ApPaymentEditor({
  loaded,
  refetch,
}: {
  readonly loaded: ApPayment | null | undefined;
  readonly refetch: () => void;
}) {
  const t = useTranslations("accounting.accountsPayable.payment");
  const td = useTranslations("accounting.accountsPayable.payment.detail");
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { userId, dateFormat, defaultCurrencyCode } = useProfile();
  const format = useAmountFormatter();
  const saveMutation = useSaveApPayment();
  const actionMutation = useApPaymentAction();
  const deleteMutation = useDeleteApPayment();
  const whtPreview = useApWhtPreview();

  const isNew = !loaded;
  const [editing, setEditing] = useState(isNew);
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState<PaymentForm>(() =>
    initialPaymentForm(loaded, {
      vendorId: searchParams.get("vendor_id") ?? undefined,
    }),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");
  const [calculating, setCalculating] = useState(false);

  const editable = editing && (isNew || (!!loaded && apCanEdit(loaded)));
  const actions = loaded ? apActions(loaded, userId) : [];
  const busy =
    saveMutation.isPending ||
    actionMutation.isPending ||
    deleteMutation.isPending;

  // รายการค้างจ่ายของ vendor — โหลดเฉพาะตอนแก้ไข
  const outstanding = useApOutstandingDocuments(
    editable && form.vendor_id ? form.vendor_id : undefined,
  );
  const docs = outstanding.data;

  // ยอดที่ใบนี้จองไว้เอง (ต่อบรรทัด): available ของ backend หักการจองของทุกใบ draft/in_review รวมใบนี้
  const ownReserved = useMemo(() => {
    const map: Record<string, DecimalString> = {};
    if (loaded?.doc_status === "draft")
      for (const a of loaded.allocations ?? [])
        map[a.ap_invoice_detail_id] = a.applied_amount.replace(/^-/, "");
    return map;
  }, [loaded]);

  const allocationInputs = useMemo(
    () => toAllocationInputs(docs ?? [], form.allocations, loaded),
    [docs, form.allocations, loaded],
  );
  const overCap = useMemo(
    () =>
      (docs ?? []).some((doc) =>
        doc.lines.some((line) => {
          const value = form.allocations[line.ap_invoice_detail_id];
          return (
            !!value?.trim() &&
            compareDecimal(value, lineCap(line, ownReserved)) > 0
          );
        }),
      ),
    [docs, form.allocations, ownReserved],
  );

  const lockedCurrency = docs
    ? (allocatedLines(docs, form.allocations)[0]?.doc.currency_code ?? null)
    : (loaded?.currency_code ?? null);

  // บัญชีธนาคารที่สกุลไม่ตรงกับเอกสารที่เลือกจ่าย (backend ปฏิเสธ) นับเป็นยังไม่ได้เลือก
  const banks = useBankAccounts().data;
  const bankMismatch =
    !!lockedCurrency &&
    !!banks?.find(
      (b) =>
        b.id === form.bank_account_id &&
        !!b.currency_code &&
        b.currency_code !== lockedCurrency,
    );
  const effectiveForm = bankMismatch ? { ...form, bank_account_id: "" } : form;

  const errors = showErrors
    ? validatePaymentForm(
        effectiveForm,
        isNew ? "create" : "update",
        allocationInputs,
        overCap,
      )
    : NO_ERRORS;

  const patchForm = useCallback(
    (patch: Partial<PaymentForm>) =>
      setForm((current) =>
        patch.vendor_id !== undefined && patch.vendor_id !== current.vendor_id
          ? // เปลี่ยน vendor = รายการจ่าย/WHT เดิมไม่เกี่ยวแล้ว
            { ...current, ...patch, allocations: {}, wht: [], bank_account_id: "" }
          : { ...current, ...patch },
      ),
    [],
  );

  const setLine = useCallback((lineId: string, value: DecimalString) => {
    setForm((current) => {
      const allocations = { ...current.allocations };
      if (value === "") delete allocations[lineId];
      else allocations[lineId] = value;
      return { ...current, allocations };
    });
  }, []);

  /** ใส่ยอดเต็ม (เพดาน) ให้ทุกบรรทัดของ invoice นั้น */
  const payFull = useCallback(
    (doc: NonNullable<typeof docs>[number]) =>
      setForm((current) => {
        const allocations = { ...current.allocations };
        for (const line of doc.lines) {
          const cap = lineCap(line, ownReserved);
          if (compareDecimal(cap, "0") > 0)
            allocations[line.ap_invoice_detail_id] = cap;
          else delete allocations[line.ap_invoice_detail_id];
        }
        return { ...current, allocations };
      }),
    [ownReserved],
  );
  const clearDoc = useCallback((doc: NonNullable<typeof docs>[number]) => {
    setForm((current) => {
      const allocations = { ...current.allocations };
      for (const line of doc.lines) delete allocations[line.ap_invoice_detail_id];
      return { ...current, allocations };
    });
  }, []);

  // จาก "จ่าย invoice" ในหน้า AP invoice: เติมเต็มทุกบรรทัดของ invoice ที่ระบุหนึ่งครั้งหลังรายการค้างจ่ายโหลด
  const prefilled = useRef(false);
  useEffect(() => {
    if (!isNew || prefilled.current || !docs) return;
    prefilled.current = true;
    const ids = (searchParams.get("invoice_ids") ?? "")
      .split(",")
      .filter(Boolean);
    if (ids.length === 0) return;
    const wanted = docs.filter((d) => ids.includes(d.ap_invoice_id));
    if (wanted.length === 0) return;
    setForm((current) => {
      const allocations = { ...current.allocations };
      const currency = wanted[0].currency_code;
      for (const doc of wanted) {
        if (doc.currency_code !== currency) continue;
        for (const line of doc.lines) {
          const cap = lineCap(line, ownReserved);
          if (compareDecimal(cap, "0") > 0)
            allocations[line.ap_invoice_detail_id] = cap;
        }
      }
      return { ...current, allocations };
    });
  }, [isNew, docs, searchParams, ownReserved]);

  // WHT: คำนวณใหม่จาก allocations (หน่วง 600ms) — แถวที่ผู้ใช้ override ไว้คงยอดเดิม
  const signature = sortedSignature(allocationInputs);
  const lastCalculated = useRef(signature);
  useEffect(() => {
    if (!editable || lastCalculated.current === signature) return;
    const inputs = JSON.parse(signature) as typeof allocationInputs;
    if (inputs.length === 0) {
      lastCalculated.current = signature;
      setForm((current) => ({ ...current, wht: [] }));
      return;
    }
    const handle = setTimeout(() => {
      lastCalculated.current = signature;
      setCalculating(true);
      whtPreview
        .mutateAsync({ allocations: inputs })
        .then((rows) =>
          setForm((current) => ({
            ...current,
            wht: mergeWhtPreview(current.wht, rows, true),
          })),
        )
        .catch(() => undefined)
        .finally(() => setCalculating(false));
    }, 600);
    return () => clearTimeout(handle);
    // whtPreview.mutateAsync เปลี่ยนตัวทุก render — พึ่ง signature อย่างเดียว
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, signature]);

  const recalculateWht = async () => {
    if (allocationInputs.length === 0) return;
    setCalculating(true);
    try {
      const rows = await whtPreview.mutateAsync({
        allocations: allocationInputs,
      });
      lastCalculated.current = signature;
      setForm((current) => ({
        ...current,
        wht: mergeWhtPreview(current.wht, rows, false),
      }));
    } catch {
      // toast กลางแสดงข้อผิดพลาดแล้ว
    } finally {
      setCalculating(false);
    }
  };

  /** 409 ไม่มีรหัส catalog = doc_version ชน: โหลดข้อมูลล่าสุดแทนการทับ แล้วบอกว่าโหลดใหม่แล้ว */
  const onFailure = (error: unknown) => {
    if (error instanceof ApiError && error.statusCode === 409) {
      refetch();
      if (!error.appCode) toast.info(td("reloaded"));
    }
  };

  const save = async () => {
    const found = validatePaymentForm(
      effectiveForm,
      isNew ? "create" : "update",
      allocationInputs,
      overCap,
    );
    if (found.size > 0) {
      setShowErrors(true);
      toast.error(td("fixErrors"));
      return;
    }
    const input = toPaymentInput(effectiveForm, allocationInputs);
    try {
      if (loaded) {
        if (loaded.doc_version == null) {
          toast.error(td("reloaded"));
          return refetch();
        }
        // vendor_id แก้หลังสร้างไม่ได้
        const update: Partial<typeof input> = { ...input };
        delete update.vendor_id;
        await saveMutation.mutateAsync({
          id: loaded.id,
          docVersion: loaded.doc_version,
          input: update,
        });
        toast.success(td("saved"));
        setEditing(false);
        setShowErrors(false);
      } else {
        const result = await saveMutation.mutateAsync({ input });
        toast.success(td("saved"));
        navigate(`${LIST_PATH}/${result.id}`, { replace: true });
      }
    } catch (error) {
      onFailure(error);
    }
  };

  const runAction = async (
    action: Exclude<ApUiAction, "delete">,
    actionReason?: string,
  ) => {
    if (!loaded) return;
    if (loaded.doc_version == null) {
      toast.error(td("reloaded"));
      return refetch();
    }
    try {
      await actionMutation.mutateAsync({
        id: loaded.id,
        action,
        docVersion: loaded.doc_version,
        reason: actionReason,
      });
      toast.success(td(`done.${action}`));
      setReasonAction(null);
      setReason("");
    } catch (error) {
      onFailure(error);
    }
  };

  const remove = async () => {
    if (!loaded) return;
    try {
      // ไปหน้า list ก่อน กัน detail ที่ถูกลบ refetch แล้วเจอ 404
      await deleteMutation.mutateAsync(loaded.id);
      toast.success(td("done.delete"));
      navigate(LIST_PATH, { replace: true });
    } catch (error) {
      setConfirmDelete(false);
      onFailure(error);
    }
  };

  const preview = useMemo(
    () => formTotals(allocationInputs, form),
    [allocationInputs, form],
  );
  const view = !editable && loaded;
  const summary = view
    ? {
        applied: loaded.total_applied_amount,
        wht: loaded.total_wht_amount,
        expenses: loaded.total_expense_amount,
        net: loaded.net_paid_amount,
      }
    : preview;
  const money = (value: string) => format(Number(value || 0));
  const currencyCode = view ? loaded.currency_code : lockedCurrency;
  const needsReason = reasonAction === "void";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <DocFormHeader
        title={loaded?.doc_no || td("newTitle")}
        subtitle={td("subtitle")}
        backLabel={td("back")}
        onBack={() => navigate(LIST_PATH)}
        badges={
          loaded ? (
            <StatusIconLabel
              status={loaded.doc_status}
              label={t(`statuses.${loaded.doc_status}`)}
            />
          ) : undefined
        }
        actions={
          <>
            {editing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    if (isNew) navigate(LIST_PATH);
                    else {
                      setEditing(false);
                      setShowErrors(false);
                      const restored = initialPaymentForm(loaded);
                      setForm(restored);
                      lastCalculated.current = sortedSignature(
                        toAllocationInputs([], restored.allocations, loaded),
                      );
                    }
                  }}
                >
                  {td("cancel")}
                </Button>
                <Button size="sm" disabled={busy} onClick={() => void save()}>
                  <Save className="size-4" />
                  {td("save")}
                </Button>
              </>
            )}
            {loaded && !editing && apCanEdit(loaded) && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setEditing(true)}
              >
                <Pencil className="size-4" />
                {td("edit")}
              </Button>
            )}
            {!editing && actions.includes("submit") && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void runAction("submit")}
              >
                <Send className="size-4" />
                {td("actions.submit")}
              </Button>
            )}
            {!editing && actions.includes("approve") && (
              <Button
                size="sm"
                disabled={busy}
                onClick={() => void runAction("approve")}
              >
                <Check className="size-4" />
                {td("actions.approve")}
              </Button>
            )}
            {!editing && actions.includes("return") && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setReasonAction("return")}
              >
                <Undo2 className="size-4" />
                {td("actions.return")}
              </Button>
            )}
            {!editing && actions.includes("reject") && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setReasonAction("reject")}
              >
                <X className="size-4" />
                {td("actions.reject")}
              </Button>
            )}
            {!editing && actions.includes("void") && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => setReasonAction("void")}
              >
                {td("actions.void")}
              </Button>
            )}
            {!editing && actions.includes("delete") && (
              <Button
                size="sm"
                variant="ghost"
                disabled={busy}
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 className="size-4" />
                {td("actions.delete")}
              </Button>
            )}
          </>
        }
      />

      {loaded?.doc_status === "posted" && loaded.gl_jv_id && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span className="text-muted-foreground">{td("journal")}</span>
          <Link
            className="font-medium underline"
            to={`/accounting/journal-voucher/${loaded.gl_jv_id}`}
          >
            {loaded.gl_jv_no ?? td("openJournal")}
          </Link>
        </div>
      )}
      {loaded?.doc_status === "void" && loaded.void_reason && (
        <div className="rounded-lg border px-3 py-2 text-sm">
          <span className="text-muted-foreground">{td("voidReason")}: </span>
          {loaded.void_reason}
        </div>
      )}

      <PaymentHeader
        form={effectiveForm}
        onChange={patchForm}
        isNew={isNew}
        editable={editable}
        errors={errors}
        currencyCode={currencyCode}
        baseCurrencyCode={loaded?.base_currency_code ?? defaultCurrencyCode}
        bankLabel={
          view
            ? [loaded.bank_account_code, loaded.bank_account_name]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{td("allocations.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {errors.has("allocations") && (
            <p className="text-destructive mb-2 text-xs">
              {td("errors.allocations")}
            </p>
          )}
          {errors.has("overAllocated") && (
            <p className="text-destructive mb-2 text-xs">
              {td("errors.overAllocated")}
            </p>
          )}
          {errors.has("netPositive") && (
            <p className="text-destructive mb-2 text-xs">
              {td("errors.netPositive")}
            </p>
          )}
          {!editable ? (
            <PaymentAllocationsReadOnly allocations={loaded?.allocations ?? []} />
          ) : !form.vendor_id ? (
            <p className="text-muted-foreground text-sm">
              {td("allocations.selectVendor")}
            </p>
          ) : outstanding.isLoading ? (
            <Skeleton className="h-32 rounded-lg" />
          ) : outstanding.isError ? (
            <ErrorState
              error={outstanding.error}
              message={td("allocations.loadError")}
              onRetry={() => void outstanding.refetch()}
            />
          ) : (
            <PaymentAllocationsEditor
              docs={docs ?? []}
              allocations={form.allocations}
              ownReserved={ownReserved}
              lockedCurrency={lockedCurrency}
              onChangeLine={setLine}
              onPayFull={payFull}
              onClear={clearDoc}
            />
          )}
        </CardContent>
      </Card>

      <PaymentWhtSection
        rows={form.wht}
        editable={editable}
        calculating={calculating}
        errors={errors}
        onChangeAmount={(key, amount) =>
          setForm((current) => ({
            ...current,
            wht: current.wht.map((row) =>
              row.key === key
                ? { ...row, wht_amount: amount, is_override: true }
                : row,
            ),
          }))
        }
        onRecalculate={() => void recalculateWht()}
      />

      <PaymentExpensesSection
        rows={form.expenses}
        editable={editable}
        errors={errors}
        onAdd={() =>
          setForm((current) => ({
            ...current,
            expenses: [...current.expenses, emptyExpense()],
          }))
        }
        onChange={(key, patch) =>
          setForm((current) => ({
            ...current,
            expenses: current.expenses.map((row) =>
              row.key === key ? { ...row, ...patch } : row,
            ),
          }))
        }
        onRemove={(key) =>
          setForm((current) => ({
            ...current,
            expenses: current.expenses.filter((row) => row.key !== key),
          }))
        }
      />

      {!editable && (loaded?.tax_invoices?.length ?? 0) > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{td("taxInvoices.title")}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full min-w-[32rem] text-left text-xs">
              <thead>
                <tr className="border-b">
                  <th className="px-2 py-1.5 font-medium">{td("taxInvoices.invoice")}</th>
                  <th className="px-2 py-1.5 font-medium">{td("taxInvoices.taxInvoiceNo")}</th>
                  <th className="px-2 py-1.5 font-medium">{td("taxInvoices.date")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{td("taxInvoices.base")}</th>
                  <th className="px-2 py-1.5 text-right font-medium">{td("taxInvoices.vat")}</th>
                </tr>
              </thead>
              <tbody>
                {loaded?.tax_invoices?.map((row) => (
                  <tr
                    key={`${row.ap_invoice_id}:${row.tax_invoice_no}`}
                    className="border-b last:border-b-0"
                  >
                    <td className="px-2 py-1.5">{row.doc_no}</td>
                    <td className="px-2 py-1.5">{row.tax_invoice_no}</td>
                    <td className="px-2 py-1.5">
                      {formatDate(row.tax_invoice_date, dateFormat)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {money(row.base_amount)}
                    </td>
                    <td className="px-2 py-1.5 text-right tabular-nums">
                      {money(row.vat_amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <SummaryFooterBar
        hasRecord
        items={[
          { key: "applied", label: td("summary.applied"), value: money(summary.applied) },
          { key: "wht", label: td("summary.wht"), value: money(summary.wht) },
          { key: "expenses", label: td("summary.expenses"), value: money(summary.expenses) },
          ...(view && Number(loaded.realized_fx_amount) !== 0
            ? [
                {
                  key: "fx",
                  label: td("summary.realizedFx"),
                  value: money(loaded.realized_fx_amount),
                },
              ]
            : []),
          {
            key: "net",
            label: td("summary.net"),
            value: money(summary.net),
            emphasis: true,
            suffix: currencyCode ?? undefined,
          },
        ]}
      />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={td("confirmDelete.title")}
        description={td("confirmDelete.description")}
        confirmText={td("actions.delete")}
        variant="destructive"
        isPending={deleteMutation.isPending}
        onConfirm={() => void remove()}
      />

      <Dialog
        open={reasonAction !== null}
        onOpenChange={(open) => {
          if (!open && !actionMutation.isPending) {
            setReasonAction(null);
            setReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {reasonAction ? td(`reasonDialog.${reasonAction}.title`) : ""}
            </DialogTitle>
            <DialogDescription>
              {needsReason
                ? td("reasonDialog.required")
                : td("reasonDialog.optional")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            rows={3}
            value={reason}
            aria-label={td("reasonDialog.label")}
            onChange={(event) => setReason(event.target.value)}
          />
          <DialogFooter>
            <Button
              variant="outline"
              disabled={actionMutation.isPending}
              onClick={() => {
                setReasonAction(null);
                setReason("");
              }}
            >
              {td("cancel")}
            </Button>
            <Button
              disabled={
                actionMutation.isPending || (needsReason && !reason.trim())
              }
              onClick={() =>
                reasonAction &&
                void runAction(reasonAction, reason.trim() || undefined)
              }
            >
              {reasonAction ? td(`actions.${reasonAction}`) : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
