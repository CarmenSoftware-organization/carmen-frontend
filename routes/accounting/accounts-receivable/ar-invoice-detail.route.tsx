import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Ban, Check, Send, Undo2, X } from "lucide-react";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusChip } from "@/components/ui/status-chip";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useListReturn } from "@/hooks/use-list-return";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { ApSendBackFields } from "../accounts-payable/shared/ap-send-back-fields";
import { arInvoiceActions, type ArUiAction } from "./ar-invoice-actions";
import { ArInvoiceTaxLines } from "./ar-invoice-tax-lines";
import { ArInvoiceLines } from "./ar-invoice-lines";
import {
  InvoiceTaxEntityFields,
  InvoiceMockDeposits,
} from "./ar-invoice-supplement";
import {
  invoiceTaxEntity,
  readInvoiceSupplement,
} from "./ar-invoice-supplement-model";
import { AR_RECEIPT_PATH } from "./ar-receipt-model";
import { InvoiceJournal } from "./ar-invoice-journal";
import { draftLineFromRecord } from "./ar-invoice-draft-model";
import { ArInvoiceDraftForm } from "./ar-invoice-draft-form";
import {
  AR_REGISTER_PATH,
  useArRegisterDocument,
  useDeleteArInvoice,
  useArInvoiceAction,
  useArInvoicePreviousStages,
  type ArRegisterDocument,
} from "./use-ar-register";

export function Component() {
  const { id } = useParams();
  const bu = useBuCode();
  if (id === "new") return <NewInvoice key={bu} />;
  return <RegisterDetail key={`${bu}:${id}`} id={id} />;
}

function NewInvoice() {
  const { buCode } = useProfile();
  const { canWrite } = useCan();
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(AR_REGISTER_PATH);
  return (
    <ArInvoiceDraftForm
      canWrite={canWrite && !!buCode}
      cancel={() => toList()}
      saved={(id) =>
        navigate(`${AR_REGISTER_PATH}/${id}`, { replace: true, ...returnState })
      }
    />
  );
}

function RegisterDetail({ id }: { readonly id?: string }) {
  const t = useTranslations("accounting.arRegister");
  const { canWrite } = useCan();
  const { toList } = useListReturn(AR_REGISTER_PATH);
  const [editDocument, setEditDocument] = useState<ArRegisterDocument | null>(
    null,
  );
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmation, setConfirmation] = useState<
    "submit" | "void" | "approve" | "sendback" | "reject" | null
  >(null);
  const [reason, setReason] = useState("");
  const [stage, setStage] = useState("");
  const action = useArInvoiceAction();
  const tc = useTranslations("common");
  const doc = useArRegisterDocument(id);
  const remove = useDeleteArInvoice();
  const sendingBack = confirmation === "sendback";
  const stagesQuery = useArInvoicePreviousStages(doc.data?.id, sendingBack);
  const stages = stagesQuery.data ?? [];
  const closeConfirmation = () => {
    setConfirmation(null);
    setReason("");
    setStage("");
  };

  if (editDocument) {
    return (
      <ArInvoiceDraftForm
        document={editDocument}
        canWrite={canWrite}
        cancel={() => setEditDocument(null)}
        saved={async () => {
          await doc.refetch();
          setEditDocument(null);
        }}
      />
    );
  }
  if (doc.isPending) return <Skeleton className="h-40 w-full" />;
  if (doc.error || !doc.data)
    return (
      <ErrorState
        error={doc.error}
        message={t("loadError")}
        onRetry={() => doc.refetch()}
      />
    );
  const row = doc.data;
  const draft = row.doc_status === "draft";
  const actions: ArUiAction[] = canWrite ? arInvoiceActions(row) : [];
  const needsReason = confirmation === "void" || confirmation === "reject";
  const editable =
    draft &&
    row.doc_version != null &&
    row.doc_type !== "deposit" &&
    !row.is_pms_folio &&
    !row.tb_ar_invoice_detail?.some((line) => line.is_pms_folio);
  return (
    <>
      <InvoiceView
        row={row}
        back={remove.isPending ? undefined : () => toList()}
        edit={editable ? () => setEditDocument(row) : undefined}
        remove={
          actions.includes("delete") ? () => setDeleteOpen(true) : undefined
        }
        deleting={remove.isPending || action.isPending}
        submit={
          actions.includes("submit") && row.doc_version != null
            ? () => setConfirmation("submit")
            : undefined
        }
        voidDocument={
          actions.includes("void") ? () => setConfirmation("void") : undefined
        }
        approve={
          actions.includes("approve")
            ? () => setConfirmation("approve")
            : undefined
        }
        sendBack={
          actions.includes("sendback")
            ? () => setConfirmation("sendback")
            : undefined
        }
        reject={
          actions.includes("reject")
            ? () => setConfirmation("reject")
            : undefined
        }
      />
      <Dialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open && !action.isPending) closeConfirmation();
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmation ? t(`${confirmation}Title`) : ""}
            </DialogTitle>
            <DialogDescription>
              {confirmation && confirmation !== "sendback"
                ? t(`${confirmation}Confirm`, { number: row.doc_no })
                : ""}
            </DialogDescription>
          </DialogHeader>
          {sendingBack && (
            <ApSendBackFields
              labels={{
                stage: t("sendBackStage"),
                stagePlaceholder: t("sendBackStagePlaceholder"),
                stagesError: t("sendBackStagesError"),
                noStages: t("sendBackNoStages"),
              }}
              stage={stage}
              onStageChange={setStage}
              stages={stages}
              isLoading={stagesQuery.isLoading}
              isError={stagesQuery.isError}
            />
          )}
          {(needsReason || sendingBack) && (
            <Field>
              <FieldLabel htmlFor="ar-action-reason" required={needsReason}>
                {sendingBack ? t("sendBackNote") : t("reason")}
              </FieldLabel>
              <Textarea
                id="ar-action-reason"
                value={reason}
                maxLength={255}
                onChange={(event) => setReason(event.target.value)}
              />
              {confirmation === "reject" && !reason.trim() && (
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
              onClick={closeConfirmation}
            >
              {tc("cancel")}
            </Button>
            <Button
              type="button"
              variant={
                confirmation === "void" || confirmation === "reject"
                  ? "destructive"
                  : "default"
              }
              disabled={
                action.isPending ||
                (needsReason && !reason.trim()) ||
                (sendingBack && !stage)
              }
              onClick={() => {
                if (!confirmation || !canWrite) return;
                action.mutate(
                  {
                    id: row.id,
                    action: sendingBack ? "review" : confirmation,
                    doc_version: row.doc_version ?? undefined,
                    ...(needsReason && { reason: reason.trim() }),
                    ...(sendingBack && {
                      stage,
                      ...(reason.trim() && { reason: reason.trim() }),
                    }),
                  },
                  {
                    onSuccess: () => {
                      closeConfirmation();
                      void doc.refetch();
                    },
                  },
                );
              }}
            >
              {t(
                confirmation === "sendback"
                  ? "sendBack"
                  : (confirmation ?? "submit"),
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <DeleteDialog
        open={deleteOpen}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { number: row.doc_no })}
        isPending={remove.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (!canWrite || !actions.includes("delete") || remove.isPending)
            return;
          remove.mutate(row.id, {
            onSuccess: () => {
              toast.success(t("deleted"));
              void toList({ replace: true });
            },
          });
        }}
      />
    </>
  );
}

function InvoiceView({
  row,
  back,
  edit,
  remove,
  deleting,
  submit,
  voidDocument,
  approve,
  sendBack,
  reject,
}: {
  readonly row: ArRegisterDocument;
  readonly back?: () => void;
  readonly edit?: () => void;
  readonly remove?: () => void;
  readonly deleting: boolean;
  readonly submit?: () => void;
  readonly voidDocument?: () => void;
  readonly approve?: () => void;
  readonly sendBack?: () => void;
  readonly reject?: () => void;
}) {
  const t = useTranslations("accounting.arRegister");
  const { dateFormat, defaultCurrencyCode } = useProfile();
  const bu = useBuCode();
  const money = useAmountFormatter();
  const navigate = useNavigate();
  const supplement = bu ? readInvoiceSupplement(bu, row.id) : undefined;
  const fields = [
    [t("type"), t(`types.${row.doc_type}`)],
    [t("date"), formatDate(row.doc_date, dateFormat)],
    [
      t("customer"),
      [row.customer_code, row.customer_name].filter(Boolean).join(" · "),
    ],
    [t("currency"), row.currency_code],
    [t("exchangeRate"), String(row.exchange_rate ?? 1)],
    [t("source"), row.doc_source ?? t("manual")],
    [t("sourceDoc"), row.source_doc_ref],
    [t("creditDays"), String(row.credit_term_days ?? 0)],
    [t("due"), formatDate(row.due_date, dateFormat)],
    [
      t("taxInvoiceEnabled"),
      row.is_tax_invoice
        ? row.tax_invoice?.tax_invoice_no || t("taxNumberOnSubmit")
        : "—",
    ],
    [t("whtAmount"), money(Number(row.wht_amount ?? 0))],
    [t("stage"), row.workflow_current_stage],
    [t("memo"), row.description],
  ];
  return (
    <div className="@container flex min-h-0 min-w-0 flex-1 flex-col gap-3">
      <FormToolbar
        title={row.doc_no}
        mode="view"
        formId="ar-invoice-view"
        isPending={deleting}
        onBack={back}
        onCancel={() => back?.()}
        onEdit={edit}
        onDelete={remove}
        deleteIsPending={deleting}
        flush={false}
        badges={
          <>
            <StatusChip
              status={row.doc_status}
              label={t(`statuses.${row.doc_status}`)}
            />
            {row.doc_status === "in_review" && row.workflow_current_stage && (
              <span className="text-muted-foreground text-xs">
                {t("stageLabel", { stage: row.workflow_current_stage })}
              </span>
            )}
          </>
        }
      >
        {approve && (
          <Button
            type="button"
            size="sm"
            title={t("approve")}
            disabled={deleting}
            onClick={approve}
          >
            <Check />
            <ToolbarLabel>{t("approve")}</ToolbarLabel>
          </Button>
        )}
        {sendBack && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t("sendBack")}
            disabled={deleting}
            onClick={sendBack}
          >
            <Undo2 />
            <ToolbarLabel>{t("sendBack")}</ToolbarLabel>
          </Button>
        )}
        {reject && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t("reject")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleting}
            onClick={reject}
          >
            <X />
            <ToolbarLabel>{t("reject")}</ToolbarLabel>
          </Button>
        )}
        {voidDocument && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            title={t("void")}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={deleting}
            onClick={voidDocument}
          >
            <Ban />
            <ToolbarLabel>{t("void")}</ToolbarLabel>
          </Button>
        )}
      </FormToolbar>
      <div className="grid min-w-0 gap-x-4 gap-y-3 border-b pb-3 @md:grid-cols-2 @3xl:grid-cols-4 @5xl:grid-cols-6">
        {fields.map(([label, value]) => (
          <Field
            key={label}
            className={label === t("memo") ? "@md:col-span-2" : ""}
          >
            <FieldLabel>{label}</FieldLabel>
            <FieldPlainText className="wrap-anywhere">
              {value || "—"}
            </FieldPlainText>
          </Field>
        ))}
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
                disabled={tab === "references" && row.doc_type !== "invoice"}
              >
                {t(tab)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="items">
          <ArInvoiceLines
            lines={(row.tb_ar_invoice_detail ?? []).map(draftLineFromRecord)}
          />
        </TabsContent>
        <TabsContent value="tax">
          <InvoiceTaxEntityFields
            value={supplement?.taxEntity ?? invoiceTaxEntity(row)}
          />
          {supplement && (
            <p className="text-muted-foreground mt-2 text-xs">
              {t("taxEntityMock")}
            </p>
          )}
          <div className="mt-3">
            <ArInvoiceTaxLines
              lines={(row.tb_ar_invoice_detail ?? []).map(draftLineFromRecord)}
              exchangeRate={Number(row.exchange_rate ?? 1)}
              baseCurrency={row.base_currency_code ?? defaultCurrencyCode}
            />
          </div>
        </TabsContent>
        <TabsContent value="references">
          <ApDetailGrid
            rows={row.tb_ar_invoice_reference ?? []}
            empty={t("noRecords")}
            columns={[
              {
                accessorKey: "ref_ar_invoice_id",
                header: t("number"),
                cell: ({ row: item }) => (
                  <Button asChild variant="link" size="sm">
                    <Link
                      to={`${AR_REGISTER_PATH}/${item.original.ref_ar_invoice_id}`}
                    >
                      {item.original.ref_ar_invoice_no ||
                        item.original.ref_ar_invoice_id}
                    </Link>
                  </Button>
                ),
              },
              {
                id: "net",
                header: t("net"),
                cell: ({ row: item }) => (
                  <span className="text-destructive">
                    −{money(Number(item.original.applied_net_amount ?? 0))}
                  </span>
                ),
              },
              {
                id: "vat",
                header: t("vat"),
                cell: ({ row: item }) => (
                  <span className="text-destructive">
                    −{money(Number(item.original.applied_vat_amount ?? 0))}
                  </span>
                ),
              },
              {
                id: "applied",
                header: t("applied"),
                cell: ({ row: item }) => (
                  <span className="text-destructive">
                    −{money(Number(item.original.applied_amount))}
                  </span>
                ),
              },
            ]}
          />
          <InvoiceMockDeposits
            rows={supplement?.deposits ?? []}
            rate={Number(row.exchange_rate ?? 1)}
            currency={row.currency_code}
            maxAmount={Number(row.outstanding_amount)}
          />
        </TabsContent>
        <TabsContent value="receipt">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">{t("receiptHistory")}</h2>
            {Number(row.outstanding_amount) > 0 &&
              row.doc_status === "posted" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    navigate(`${AR_RECEIPT_PATH}/new`, {
                      state: { receiptInvoice: row },
                    })
                  }
                >
                  {t("getReceipt")}
                </Button>
              )}
          </div>
        </TabsContent>
        <TabsContent value="journal">
          <InvoiceJournal document={row} />
        </TabsContent>
      </Tabs>
      <SummaryFooterBar
        hasRecord
        items={[
          {
            key: "subtotal",
            label: t("subtotal"),
            value: money(Number(row.sub_total_amount ?? 0)),
          },
          {
            key: "discount",
            label: t("discount"),
            value: money(Number(row.discount_amount ?? 0)),
            valueClassName: "text-destructive",
          },
          { key: "net", label: t("net"), value: money(Number(row.net_amount)) },
          {
            key: "vat",
            label: t("tax1Amount"),
            value: money(Number(row.vat_amount)),
          },
          {
            key: "tax2",
            label: t("tax2Amount"),
            value: money(Number(row.tax2_amount ?? 0)),
          },
          {
            key: "total",
            label: t("total"),
            value: money(Number(row.total_amount)),
            suffix: row.currency_code,
          },
          {
            key: "outstanding",
            label: t("outstanding"),
            value: money(Number(row.outstanding_amount)),
            suffix: row.currency_code,
            emphasis: true,
          },
          {
            key: "base",
            label: t("baseTotal"),
            value: money(
              Number(
                row.base_total_amount ??
                  Number(row.total_amount) * Number(row.exchange_rate ?? 1),
              ),
            ),
            suffix: row.base_currency_code ?? defaultCurrencyCode,
          },
        ]}
      >
        {submit && (
          <Button type="button" size="sm" disabled={deleting} onClick={submit}>
            <Send />
            {t("submit")}
          </Button>
        )}
      </SummaryFooterBar>
    </div>
  );
}
