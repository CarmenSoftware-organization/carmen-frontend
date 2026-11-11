import { useState, type FormEvent } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { FormToolbar } from "@/components/share/form-toolbar";
import { Button } from "@/components/ui/button";
import { CellAction } from "@/components/ui/cell-action";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Textarea } from "@/components/ui/textarea";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { round2 } from "@/lib/currency-utils";
import { isoToDateInput } from "@/lib/date-utils";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import {
  draftLineFromRecord,
  draftLineToInput,
  newArDraftLine,
  type ArDraftLine,
} from "./ar-invoice-draft-model";
import { ArInvoiceLineDialog } from "./ar-invoice-line-dialog";
import type { ArCustomer } from "./use-ar-customer";
import { ArCustomerLookup } from "./ar-customer-lookup";
import {
  useCreateArInvoice,
  useUpdateArInvoice,
  type ArRegisterDocument,
} from "./use-ar-register";

const FORM_ID = "ar-invoice-draft";

export function ArInvoiceDraftForm({
  document,
  canWrite,
  cancel,
  saved,
}: {
  readonly document?: ArRegisterDocument;
  readonly canWrite: boolean;
  readonly cancel: () => void;
  readonly saved: (id: string) => void | Promise<void>;
}) {
  const t = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const money = useAmountFormatter();
  const { defaultCurrencyCode } = useProfile();
  const [customer, setCustomer] = useState<ArCustomer>();
  const [initialDate] = useState(() =>
    isoToDateInput(document?.doc_date ?? new Date().toISOString()),
  );
  const [date, setDate] = useState(initialDate);
  const [description, setDescription] = useState(document?.description ?? "");
  const [initialLines] = useState(
    () => document?.tb_ar_invoice_detail?.map(draftLineFromRecord) ?? [],
  );
  const [lines, setLines] = useState(initialLines);
  const [editor, setEditor] = useState<ArDraftLine | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const create = useCreateArInvoice();
  const update = useUpdateArInvoice();
  const dirty =
    Boolean(customer) ||
    date !== initialDate ||
    description !== (document?.description ?? "") ||
    lines !== initialLines;
  useUnsavedChanges(dirty && !saving);
  const currency =
    document?.currency_code ??
    customer?.default_currency_code ??
    defaultCurrencyCode;
  const subtotal = (line: ArDraftLine) =>
    round2(Number(line.quantity) * Number(line.unit_price));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    if (!document && !customer) {
      setError(t("customerRequired"));
      return;
    }
    if (!lines.length) {
      setError(t("lineRequired"));
      return;
    }
    setError("");
    setSaving(true);
    const memo = description.trim() || null;
    try {
      if (document) {
        if (document.doc_version == null) return;
        await update.mutateAsync({
          id: document.id,
          doc_version: document.doc_version,
          ...(date !== initialDate && { doc_date: date }),
          ...(memo !== (document.description ?? null) && { description: memo }),
          ...(lines !== initialLines && {
            details: { add: lines.map(draftLineToInput) },
          }),
        });
        toast.success(t("saved"));
        await saved(document.id);
      } else if (customer) {
        const result = await create.mutateAsync({
          doc_type: "invoice",
          customer_id: customer.id,
          doc_date: date,
          description: memo,
          details: { add: lines.map(draftLineToInput) },
        });
        if (!result.data?.id) {
          setError(t("missingCreatedId"));
          return;
        }
        toast.success(t("created"));
        await saved(result.data.id);
      }
    } catch {
      // The shared API handler reports the server error. Keep the draft for correction.
    } finally {
      setSaving(false);
    }
  }

  function addLine() {
    const sequence =
      lines.reduce((max, line) => Math.max(max, line.sequence_no), 0) + 1;
    setEditor(newArDraftLine(sequence));
  }

  function saveLine(line: ArDraftLine) {
    setLines((previous) =>
      previous.some((item) => item.id === line.id)
        ? previous.map((item) => (item.id === line.id ? line : item))
        : [...previous, line],
    );
    setError("");
    setEditor(null);
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <FormToolbar
        title={document?.doc_no ?? t("newInvoice")}
        mode={document ? "edit" : "add"}
        formId={FORM_ID}
        isPending={saving}
        onBack={saving ? undefined : cancel}
        onCancel={cancel}
        submitLabel={tc(document ? "save" : "saveDraft")}
        writeDisabledReason={canWrite ? undefined : t("writeUnavailable")}
        flush={false}
        badges={<StatusIconLabel status="draft" label={t("statuses.draft")} />}
      />
      <form
        id={FORM_ID}
        onSubmit={submit}
        className="flex min-h-0 min-w-0 flex-1 flex-col gap-4"
      >
        <div className="grid gap-4 border-b pb-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field className="min-w-0">
            <FieldLabel required={!document}>{t("customer")}</FieldLabel>
            {document ? (
              <FieldPlainText>
                {document.customer_code} · {document.customer_name}
              </FieldPlainText>
            ) : (
              <ArCustomerLookup
                customer={customer}
                change={setCustomer}
                disabled={saving || !canWrite}
              />
            )}
          </Field>
          <Field>
            <FieldLabel htmlFor="ar-invoice-date" required>
              {t("date")}
            </FieldLabel>
            <FieldInput
              id="ar-invoice-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
              disabled={saving || !canWrite}
            />
          </Field>
          <Field className="sm:col-span-2">
            <FieldLabel htmlFor="ar-invoice-memo">{t("memo")}</FieldLabel>
            <Textarea
              id="ar-invoice-memo"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              disabled={saving || !canWrite}
            />
          </Field>
        </div>
        <section
          aria-labelledby="ar-invoice-items"
          className="min-w-0 flex-1 space-y-2"
        >
          <div className="flex items-center justify-between gap-2">
            <h2 id="ar-invoice-items" className="text-sm font-semibold">
              {t("items")}
            </h2>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addLine}
              disabled={saving || !canWrite}
            >
              <Plus /> {t("addLine")}
            </Button>
          </div>
          <ApDetailGrid
            rows={lines}
            empty={t("lineRequired")}
            columns={[
              { accessorKey: "sequence_no", header: "#" },
              {
                accessorKey: "description",
                header: t("memo"),
                cell: ({ row: { original } }) => (
                  <CellAction
                    disabled={saving || !canWrite}
                    onClick={() => setEditor(original)}
                  >
                    {original.description ||
                      t("lineNumber", { number: original.sequence_no })}
                  </CellAction>
                ),
              },
              { accessorKey: "quantity", header: t("quantity") },
              {
                accessorKey: "unit_price",
                header: t("unitPrice"),
                cell: ({ row }) => money(Number(row.original.unit_price)),
              },
              { accessorKey: "cr_account_code", header: t("revenueAccount") },
              { accessorKey: "dr_account_code", header: t("arAccount") },
              {
                id: "subtotal",
                header: t("subtotal"),
                cell: ({ row }) => money(subtotal(row.original)),
              },
              {
                id: "actions",
                cell: ({ row: { original } }) => (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={saving || !canWrite}
                    aria-label={t("removeLine", {
                      number: original.sequence_no,
                    })}
                    onClick={() =>
                      setLines((previous) =>
                        previous.filter((line) => line.id !== original.id),
                      )
                    }
                  >
                    <Trash2 />
                  </Button>
                ),
              },
            ]}
          />
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
        </section>
        <SummaryFooterBar
          hasRecord
          items={[
            {
              key: "subtotal",
              label: t("subtotalBeforeTax"),
              value: money(
                lines.reduce((total, line) => total + subtotal(line), 0),
              ),
              suffix: currency,
              emphasis: true,
            },
          ]}
        />
      </form>
      {editor && (
        <ArInvoiceLineDialog
          key={editor.id}
          line={editor}
          isNew={!lines.some((line) => line.id === editor.id)}
          close={() => setEditor(null)}
          save={saveLine}
        />
      )}
    </div>
  );
}
