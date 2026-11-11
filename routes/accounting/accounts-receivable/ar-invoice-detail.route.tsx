import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { FormToolbar } from "@/components/share/form-toolbar";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useListReturn } from "@/hooks/use-list-return";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { ArInvoiceDraftForm } from "./ar-invoice-draft-form";
import {
  AR_REGISTER_PATH,
  useArRegisterDocument,
  useDeleteArInvoice,
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
  const doc = useArRegisterDocument(id);
  const remove = useDeleteArInvoice();

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
        remove={draft ? () => setDeleteOpen(true) : undefined}
        deleting={remove.isPending}
      />
      <DeleteDialog
        open={deleteOpen}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { number: row.doc_no })}
        isPending={remove.isPending}
        onOpenChange={setDeleteOpen}
        onConfirm={() => {
          if (!canWrite || !draft || remove.isPending) return;
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
}: {
  readonly row: ArRegisterDocument;
  readonly back?: () => void;
  readonly edit?: () => void;
  readonly remove?: () => void;
  readonly deleting: boolean;
}) {
  const t = useTranslations("accounting.arRegister");
  const { dateFormat } = useProfile();
  const money = useAmountFormatter();
  const amount = (value: number | string) => money(Number(value));
  const noRecords = t("noRecords");
  const fields = [
    [t("type"), t(`types.${row.doc_type}`)],
    [
      t("customer"),
      [row.customer_code, row.customer_name].filter(Boolean).join(" · "),
    ],
    [t("date"), formatDate(row.doc_date, dateFormat)],
    [t("due"), formatDate(row.due_date, dateFormat)],
    [t("source"), row.source_doc_ref],
    [t("stage"), row.workflow_current_stage],
    [t("memo"), row.description],
  ];
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <FormToolbar
        title={row.doc_no}
        mode="view"
        formId="ar-invoice-view"
        isPending={false}
        onBack={back}
        onCancel={() => back?.()}
        onEdit={edit}
        onDelete={remove}
        deleteIsPending={deleting}
        flush={false}
        badges={
          <StatusIconLabel
            status={row.doc_status}
            label={t(`statuses.${row.doc_status}`)}
          />
        }
      />
      <div className="grid gap-4 border-b pb-4 sm:grid-cols-2 lg:grid-cols-4">
        {fields.map(([label, value]) => (
          <Field key={label}>
            <FieldLabel>{label}</FieldLabel>
            <FieldPlainText className="wrap-anywhere">
              {value || "—"}
            </FieldPlainText>
          </Field>
        ))}
      </div>
      <Tabs defaultValue="items" className="min-w-0 flex-1">
        <div className="overflow-x-auto">
          <TabsList variant="line">
            {(["items", "tax", "references", "journal"] as const).map((tab) => (
              <TabsTrigger key={tab} value={tab}>
                {t(tab)}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="items">
          <ApDetailGrid
            rows={row.tb_ar_invoice_detail ?? []}
            empty={noRecords}
            columns={[
              { accessorKey: "sequence_no", header: "#" },
              { accessorKey: "description", header: t("memo") },
              { accessorKey: "quantity", header: t("quantity") },
              {
                accessorKey: "unit_price",
                header: t("unitPrice"),
                cell: ({ row }) => amount(row.original.unit_price),
              },
              { accessorKey: "cr_account_code", header: t("revenueAccount") },
              { accessorKey: "dr_account_code", header: t("arAccount") },
              {
                accessorKey: "total_amount",
                header: t("total"),
                cell: ({ row }) => amount(row.original.total_amount),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="tax">
          {row.tax_invoice ? (
            <Field>
              <FieldLabel>{t("tax")}</FieldLabel>
              <FieldPlainText>
                {row.tax_invoice.tax_invoice_no} ·{" "}
                {formatDate(row.tax_invoice.tax_invoice_date, dateFormat)}
              </FieldPlainText>
            </Field>
          ) : (
            <p className="text-muted-foreground text-sm">{noRecords}</p>
          )}
        </TabsContent>
        <TabsContent value="references">
          <ApDetailGrid
            rows={row.tb_ar_invoice_reference ?? []}
            empty={noRecords}
            columns={[
              {
                accessorKey: "ref_ar_invoice_id",
                header: t("number"),
                cell: ({ row }) => (
                  <Button asChild variant="link" size="sm">
                    <Link
                      to={`${AR_REGISTER_PATH}/${row.original.ref_ar_invoice_id}`}
                    >
                      {row.original.ref_ar_invoice_id}
                    </Link>
                  </Button>
                ),
              },
              {
                accessorKey: "applied_amount",
                header: t("applied"),
                cell: ({ row }) => amount(row.original.applied_amount),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="journal">
          {row.gl_jv_id ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/accounting/journal-voucher/${row.gl_jv_id}`}>
                {row.gl_jv_no || t("journal")}
              </Link>
            </Button>
          ) : (
            <p className="text-muted-foreground text-sm">{noRecords}</p>
          )}
        </TabsContent>
      </Tabs>
      <SummaryFooterBar
        hasRecord
        items={[
          { key: "net", label: t("net"), value: amount(row.net_amount) },
          { key: "vat", label: t("vat"), value: amount(row.vat_amount) },
          { key: "total", label: t("total"), value: amount(row.total_amount) },
          {
            key: "outstanding",
            label: t("outstanding"),
            value: amount(row.outstanding_amount),
            suffix: row.currency_code,
            emphasis: true,
          },
        ]}
      />
    </div>
  );
}
