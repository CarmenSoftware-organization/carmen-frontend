import { useCallback, useMemo, useState } from "react";
import { Check, Pencil, Plus, Save, Send, Trash2, Undo2, X } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router";
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
import { useProfile } from "@/hooks/use-profile";
import { ApiError } from "@/lib/api-error";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import type { ApInvoice, ApUiAction } from "@/types/accounts-payable";
import { apActions, apCanEdit, apIsAutoFromGrn } from "../shared/ap-status";
import {
  useApInvoice,
  useApInvoiceAction,
  useDeleteApInvoice,
  useSaveApInvoice,
} from "../shared/use-accounts-payable";
import {
  emptyLine,
  initialInvoiceForm,
  invoiceTotals,
  toInvoiceInput,
  validateInvoiceForm,
  type InvoiceErrorKey,
  type InvoiceForm,
  type InvoiceFormLine,
} from "./ap-invoice-form";
import { InvoiceHeader } from "./ap-invoice-header";
import { InvoiceLines } from "./ap-invoice-lines";

const LIST_PATH = "/accounting/accounts-payable/invoice";
const NO_ERRORS: ReadonlySet<InvoiceErrorKey> = new Set();

export default function ApInvoiceDetail() {
  const t = useTranslations("accounting.accountsPayable.invoice.detail");
  const { id = "new" } = useParams<{ id: string }>();
  const query = useApInvoice(id);
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
    <ApInvoiceEditor
      // เปลี่ยน version = โหลดใหม่ → ฟอร์มเริ่มจากข้อมูลล่าสุดเสมอ
      key={`${id}:${query.data?.doc_version ?? 0}`}
      loaded={id === "new" ? null : query.data}
      refetch={() => void query.refetch()}
    />
  );
}

type ReasonAction = Extract<ApUiAction, "void" | "reject" | "return">;

function ApInvoiceEditor({
  loaded,
  refetch,
}: {
  readonly loaded: ApInvoice | null | undefined;
  readonly refetch: () => void;
}) {
  const t = useTranslations("accounting.accountsPayable.invoice");
  const td = useTranslations("accounting.accountsPayable.invoice.detail");
  const navigate = useNavigate();
  const { defaultCurrencyId, defaultCurrencyCode, userId } = useProfile();
  const format = useAmountFormatter();
  const saveMutation = useSaveApInvoice();
  const actionMutation = useApInvoiceAction();
  const deleteMutation = useDeleteApInvoice();

  const isNew = !loaded;
  const [editing, setEditing] = useState(isNew);
  const [showErrors, setShowErrors] = useState(false);
  const [form, setForm] = useState<InvoiceForm>(() =>
    initialInvoiceForm(loaded, {
      currencyId: defaultCurrencyId,
      currencyCode: defaultCurrencyCode,
    }),
  );
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reasonAction, setReasonAction] = useState<ReasonAction | null>(null);
  const [reason, setReason] = useState("");

  const locked = loaded ? apIsAutoFromGrn(loaded) : false;
  const editable = editing && (isNew || (!!loaded && apCanEdit(loaded)));
  const actions = loaded ? apActions(loaded, userId) : [];
  const errors = showErrors
    ? validateInvoiceForm(form, isNew ? "create" : "update")
    : NO_ERRORS;
  const busy =
    saveMutation.isPending ||
    actionMutation.isPending ||
    deleteMutation.isPending;

  const patchForm = useCallback(
    (patch: Partial<InvoiceForm>) =>
      setForm((current) => ({ ...current, ...patch })),
    [],
  );
  const patchLine = useCallback(
    (key: string, patch: Partial<InvoiceFormLine>) =>
      setForm((current) => ({
        ...current,
        lines: current.lines.map((line) =>
          line.key === key ? { ...line, ...patch } : line,
        ),
      })),
    [],
  );
  const moveLine = useCallback((key: string, direction: -1 | 1) => {
    setForm((current) => {
      const index = current.lines.findIndex((line) => line.key === key);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.lines.length)
        return current;
      const lines = [...current.lines];
      [lines[index], lines[target]] = [lines[target], lines[index]];
      return { ...current, lines };
    });
  }, []);
  const removeLine = useCallback(
    (key: string) =>
      setForm((current) =>
        current.lines.length <= 1
          ? current
          : {
              ...current,
              lines: current.lines.filter((line) => line.key !== key),
            },
      ),
    [],
  );

  /** 409 ไม่มีรหัส catalog = doc_version ชน: toast กลางบอกว่ามีคนแก้ ที่นี่โหลดข้อมูลล่าสุดแทนการทับ แล้วบอกว่าโหลดใหม่แล้ว */
  const onFailure = (error: unknown) => {
    if (error instanceof ApiError && error.statusCode === 409) {
      refetch();
      if (!error.appCode) toast.info(td("reloaded"));
    }
  };

  const save = async () => {
    const found = validateInvoiceForm(form, isNew ? "create" : "update");
    if (found.size > 0) {
      setShowErrors(true);
      toast.error(td("fixErrors"));
      return;
    }
    const input = toInvoiceInput(form);
    try {
      if (loaded) {
        if (loaded.doc_version == null) {
          toast.error(td("reloaded"));
          return refetch();
        }
        await saveMutation.mutateAsync({
          id: loaded.id,
          docVersion: loaded.doc_version,
          input,
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

  const totals = useMemo(() => invoiceTotals(form.lines), [form.lines]);
  const view = !editable && loaded;
  const summary = view
    ? {
        subtotal: loaded.sub_total_amount,
        discount: loaded.discount_amount,
        vat: loaded.vat_amount,
        wht: loaded.wht_estimate_amount,
        total: loaded.total_amount,
      }
    : totals;
  const money = (value: string) => format(Number(value || 0));

  const grnLine = loaded?.lines?.find((l) => l.sources[0]);
  const grnId = grnLine?.sources[0]?.good_received_note_id;
  const primaryIsSubmit = !!loaded && !editing && actions.includes("submit");
  const needsReason = reasonAction === "void";

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {locked && (
        <div className="bg-info/10 text-info-ink flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm">
          <span>{td("fromGrnBanner")}</span>
          {grnId && (
            <Link
              className="font-medium underline"
              to={`/procurement/goods-receive-note/${grnId}`}
            >
              {grnLine?.sources[0]?.grn_no ?? td("openGrn")}
            </Link>
          )}
        </div>
      )}
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
                      setForm(
                        initialInvoiceForm(loaded, {
                          currencyId: defaultCurrencyId,
                          currencyCode: defaultCurrencyCode,
                        }),
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
            {loaded &&
              !editing &&
              loaded.doc_status === "posted" &&
              Number(loaded.outstanding_amount) > 0 &&
              !primaryIsSubmit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    navigate(
                      `/accounting/accounts-payable/payment/new?vendor_id=${encodeURIComponent(loaded.vendor_id)}&invoice_ids=${encodeURIComponent(loaded.id)}`,
                    )
                  }
                >
                  {td("pay")}
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

      <InvoiceHeader
        form={form}
        onChange={patchForm}
        isNew={isNew}
        editable={editable}
        errors={errors}
        dueDate={loaded?.due_date}
      />

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>{td("linesTitle")}</CardTitle>
          {editable && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  lines: [...current.lines, emptyLine()],
                }))
              }
            >
              <Plus className="size-4" />
              {td("addLine")}
            </Button>
          )}
        </CardHeader>
        <CardContent>
          {errors.has("lines") && (
            <p className="text-destructive mb-2 text-xs">
              {td("errors.lines")}
            </p>
          )}
          {(["account", "quantity", "unitPrice"] as const).map(
            (key) =>
              errors.has(key) && (
                <p key={key} className="text-destructive mb-2 text-xs">
                  {td(`errors.${key}`)}
                </p>
              ),
          )}
          <InvoiceLines
            lines={form.lines}
            editable={editable}
            showErrors={showErrors}
            onChange={patchLine}
            onMove={moveLine}
            onRemove={removeLine}
          />
        </CardContent>
      </Card>

      <SummaryFooterBar
        hasRecord
        items={[
          { key: "subtotal", label: td("summary.subtotal"), value: money(summary.subtotal) },
          { key: "discount", label: td("summary.discount"), value: money(summary.discount) },
          { key: "vat", label: td("summary.vat"), value: money(summary.vat) },
          { key: "wht", label: td("summary.wht"), value: money(summary.wht) },
          {
            key: "total",
            label: td("summary.total"),
            value: money(summary.total),
            emphasis: true,
            suffix: form.currency_code,
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
              {needsReason ? td("reasonDialog.required") : td("reasonDialog.optional")}
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
