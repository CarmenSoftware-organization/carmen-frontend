import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from "react";
import { Download, Eye, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { LookupCurrencyIso } from "@/components/lookup/lookup-currency-iso";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { MockBadge } from "@/components/ui/mock-badge";
import { SummaryFooterBar } from "@/components/ui/summary-bar";
import { Switch } from "@/components/ui/switch";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { round2 } from "@/lib/currency-utils";
import { ArCustomerLookup } from "./ar-customer-lookup";
import {
  contractLineError,
  nextContractNo,
  type ArContract,
  type ArContractDocument,
  type readContractSamples,
} from "./ar-contract-model";
import { ContractLines } from "./ar-contract-lines";
import {
  arLineAmounts,
  newArDraftLine,
  type ArDraftLine,
} from "./ar-invoice-draft-model";
import { ArInvoiceLineDialog } from "./ar-invoice-line-dialog";
import type { ArCustomer } from "./use-ar-customer";

const documentTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];
const FORM_ID = "ar-contract-form";

export function ContractDialog({
  mode,
  record,
  data,
  canWrite,
  lockedCustomer,
  close,
  edit,
  save,
}: {
  readonly mode: "add" | "view" | "edit";
  readonly record?: ArContract;
  readonly data: ReturnType<typeof readContractSamples>;
  readonly canWrite: boolean;
  readonly lockedCustomer?: ArCustomer;
  readonly close: () => void;
  readonly edit: () => void;
  readonly save: (record: ArContract) => void;
}) {
  const t = useTranslations("accounting.arContract");
  const register = useTranslations("accounting.arRegister");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const money = useAmountFormatter();
  const readOnly = mode === "view" || !canWrite;
  const today = new Date().toLocaleDateString("en-CA");
  const [startDate, setStartDate] = useState(record?.startDate ?? today);
  const [endDate, setEndDate] = useState(record?.endDate ?? today);
  const [customer, setCustomer] = useState<ArCustomer | undefined>(
    lockedCustomer ??
      (record
        ? {
            id: record.customerId,
            code: record.customerCode,
            name: record.customerName,
          }
        : undefined),
  );
  const [currency, setCurrency] = useState(record?.currency ?? "THB");
  const [rate, setRate] = useState(record?.rate ?? 1);
  const [active, setActive] = useState(record?.active ?? true);
  const [lines, setLines] = useState(record?.lines ?? []);
  const [lineEditor, setLineEditor] = useState<ArDraftLine>();
  const [documents, setDocuments] = useState<ArContractDocument[]>(
    record?.documents ?? (record?.document ? [record.document] : []),
  );
  const [viewDocument, setViewDocument] = useState<ArContractDocument>();
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const total = lines.reduce((sum, line) => sum + arLineAmounts(line).total, 0);
  const displayTotal =
    lines.length || !readOnly ? total : (record?.amount ?? 0);
  const subtotal = lines.reduce(
    (sum, line) => sum + arLineAmounts(line).net,
    0,
  );
  const vat = lines.reduce((sum, line) => sum + arLineAmounts(line).vat, 0);
  const tax2 = lines.reduce((sum, line) => sum + arLineAmounts(line).tax2, 0);
  const contractNo = record?.contractNo ?? nextContractNo(data, startDate);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || reading) return;
    const fields = new FormData(event.currentTarget);
    const description = String(fields.get("descriptionColumn") ?? "").trim();
    const chargeEvery = Number(fields.get("chargeEvery"));
    if (!customer || customer.is_active === false || !description)
      return setError(t("requiredFields"));
    if (!startDate || !endDate || endDate < startDate)
      return setError(t("dateOrder"));
    if (
      !currency ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isInteger(chargeEvery) ||
      chargeEvery < 1
    )
      return setError(t("invalidAmounts"));
    const lineError = contractLineError(lines);
    if (lineError) return setError(t(lineError));
    save({
      id: record?.id ?? crypto.randomUUID(),
      contractNo: record?.contractNo ?? "",
      customerId: customer.id,
      customerCode: customer.code,
      customerName: customer.name,
      description,
      startDate,
      endDate,
      chargeEvery,
      active,
      currency,
      rate,
      amount: round2(total),
      lines,
      documents,
      document: documents[0],
    });
  }

  async function attach(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (
      selected.some(
        (file) =>
          !documentTypes.includes(file.type) || file.size > 25 * 1024 * 1024,
      )
    )
      return setError(t("fileLimit"));
    setReading(true);
    try {
      const added = await Promise.all(
        selected.map(async (file) => ({
          name: file.name,
          mime: file.type,
          size: file.size,
          data: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(file);
          }),
        })),
      );
      setDocuments((previous) => [...previous, ...added]);
      setError("");
    } catch {
      setError(t("fileReadError"));
    } finally {
      setReading(false);
    }
  }

  function field(
    name: string,
    value: string | number,
    props?: ComponentProps<typeof FieldInput>,
  ) {
    return (
      <Field>
        <FieldLabel
          htmlFor={readOnly ? undefined : `contract-${name}`}
          required={props?.required}
        >
          {t(name)}
        </FieldLabel>
        {readOnly ? (
          <FieldPlainText>{value || "—"}</FieldPlainText>
        ) : (
          <FieldInput
            id={`contract-${name}`}
            name={name}
            defaultValue={value}
            disabled={reading}
            {...props}
          />
        )}
      </Field>
    );
  }

  function addLine() {
    setLineEditor({
      ...newArDraftLine(
        lines.reduce((max, line) => Math.max(max, line.sequence_no), 0) + 1,
      ),
      group_no: 1,
      date_from: startDate,
      date_to: endDate,
      dr_chart_of_accounts_id: customer?.ar_chart_of_accounts_id,
    });
  }
  function saveLine(line: ArDraftLine) {
    const lineError = contractLineError([line]);
    if (lineError) {
      toast.error(t(lineError));
      return;
    }
    setLines((previous) =>
      previous.some((item) => item.id === line.id)
        ? previous.map((item) => (item.id === line.id ? line : item))
        : [...previous, line],
    );
    setLineEditor(undefined);
    setError("");
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !reading) close();
      }}
    >
      <DialogContent
        className="flex h-[90dvh] flex-col overflow-hidden p-4 sm:max-w-6xl"
        showCloseButton={false}
        aria-describedby={undefined}
      >
        <DialogTitle className="sr-only">
          {t("title")} · {contractNo}
        </DialogTitle>
        <FormToolbar
          title={contractNo}
          subtitle={t("sampleForm")}
          mode={readOnly ? "view" : mode}
          formId={FORM_ID}
          isPending={reading}
          onCancel={close}
          onEdit={canWrite ? edit : undefined}
          submitLabel={tc("save")}
          flush={false}
          badges={
            <>
              <MockBadge />
              <StatusBadge active={active} />
            </>
          }
        >
          {readOnly && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={tc("close")}
              onClick={close}
              disabled={reading}
            >
              <X />
              <ToolbarLabel>{tc("close")}</ToolbarLabel>
            </Button>
          )}
        </FormToolbar>
        <form
          id={FORM_ID}
          onSubmit={submit}
          className="flex min-h-0 min-w-0 flex-1 flex-col"
          aria-describedby={undefined}
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <CompactSection title={t("header")} first frameless>
              <FieldGrid>
                <Field>
                  <FieldLabel>{t("customer")}</FieldLabel>
                  {readOnly || lockedCustomer ? (
                    <FieldPlainText>
                      {customer?.code} · {customer?.name}
                    </FieldPlainText>
                  ) : (
                    <ArCustomerLookup
                      customer={customer}
                      change={setCustomer}
                      disabled={reading}
                    />
                  )}
                </Field>
                {field("descriptionColumn", record?.description ?? "", {
                  required: true,
                  maxLength: 255,
                })}
                {field("startDate", startDate, {
                  required: true,
                  type: "date",
                  value: startDate,
                  defaultValue: undefined,
                  onChange: (event) => setStartDate(event.target.value),
                })}
                {field("endDate", endDate, {
                  required: true,
                  type: "date",
                  min: startDate,
                  value: endDate,
                  defaultValue: undefined,
                  onChange: (event) => setEndDate(event.target.value),
                })}
                {field("chargeEvery", record?.chargeEvery ?? 1, {
                  required: true,
                  type: "number",
                  min: 1,
                  step: 1,
                })}
                <Field>
                  <FieldLabel>{t("currency")}</FieldLabel>
                  {readOnly ? (
                    <FieldPlainText>{currency}</FieldPlainText>
                  ) : (
                    <LookupCurrencyIso
                      value={currency}
                      onValueChange={(value) => {
                        setCurrency(value);
                        if (value === "THB") setRate(1);
                      }}
                      className="w-full"
                      disabled={reading}
                    />
                  )}
                </Field>
                {field("rate", rate, {
                  required: true,
                  type: "number",
                  min: 0.00000001,
                  step: "any",
                  value: rate,
                  defaultValue: undefined,
                  onChange: (event) => setRate(Number(event.target.value)),
                  readOnly: currency === "THB",
                })}
                <Field>
                  <FieldLabel>{tc("status")}</FieldLabel>
                  {readOnly ? (
                    <div>
                      <StatusBadge active={active} />
                    </div>
                  ) : (
                    <div className="flex h-8 items-center gap-2">
                      <Switch
                        id="contract-active"
                        checked={active}
                        onCheckedChange={setActive}
                        disabled={reading}
                      />
                      <label htmlFor="contract-active" className="text-xs">
                        {ts("active")}
                      </label>
                    </div>
                  )}
                </Field>
              </FieldGrid>
            </CompactSection>
            <CompactSection
              title={t("attachment")}
              count={documents.length}
              frameless
              first
            >
              <div className="space-y-2">
                {!readOnly && (
                  <>
                    <FieldInput
                      id="contract-file"
                      aria-label={t("attachment")}
                      type="file"
                      multiple
                      accept={documentTypes.join(",")}
                      disabled={reading}
                      onChange={(event) => {
                        void attach(event.target.files);
                        event.target.value = "";
                      }}
                    />
                    <p className="text-muted-foreground text-xs">
                      {t("fileLimit")}
                    </p>
                  </>
                )}
                {documents.length ? (
                  documents.map((document, index) => (
                    <div
                      key={`${index}-${document.name}`}
                      className="flex min-w-0 items-center gap-2 text-xs"
                    >
                      <span
                        className="min-w-0 flex-1 truncate"
                        title={document.name}
                      >
                        {document.name}
                        {document.size != null && (
                          <span className="text-muted-foreground ml-2">
                            {(document.size / 1024).toFixed(0)} KB
                          </span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        title={t("viewDocument")}
                        onClick={() => setViewDocument(document)}
                      >
                        <Eye />
                      </Button>
                      <Button asChild variant="ghost" size="icon-sm">
                        <a
                          href={document.data}
                          download={document.name}
                          title={tc("download")}
                        >
                          <Download />
                        </a>
                      </Button>
                      {!readOnly && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          title={tc("delete")}
                          onClick={() =>
                            setDocuments((previous) =>
                              previous.filter((_, i) => i !== index),
                            )
                          }
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground text-xs">
                    {t("noDocument")}
                  </p>
                )}
              </div>
            </CompactSection>
            <ContractLines
              lines={lines}
              readOnly={readOnly || reading}
              add={addLine}
              edit={setLineEditor}
              remove={(id) =>
                setLines((previous) =>
                  previous.filter((line) => line.id !== id),
                )
              }
            />
            {error && (
              <p role="alert" className="text-destructive text-xs">
                {error}
              </p>
            )}
          </div>
          <SummaryFooterBar
            hasRecord={Boolean(lines.length || record)}
            items={[
              { key: "net", label: register("net"), value: money(subtotal) },
              { key: "vat", label: register("tax1Amount"), value: money(vat) },
              {
                key: "tax2",
                label: register("tax2Amount"),
                value: money(tax2),
              },
              {
                key: "total",
                label: register("total"),
                value: money(displayTotal),
                suffix: currency,
                emphasis: true,
              },
              {
                key: "thb",
                label: t("amountThb"),
                value: money(round2(displayTotal * rate)),
              },
            ]}
          />
        </form>
        {lineEditor && (
          <ArInvoiceLineDialog
            key={lineEditor.id}
            line={lineEditor}
            isNew={!lines.some((line) => line.id === lineEditor.id)}
            close={() => setLineEditor(undefined)}
            save={saveLine}
          />
        )}
        {viewDocument && (
          <ContractDocumentDialog
            document={viewDocument}
            close={() => setViewDocument(undefined)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ContractDocumentDialog({
  document,
  close,
}: {
  readonly document: ArContractDocument;
  readonly close: () => void;
}) {
  const t = useTranslations("accounting.arContract");
  const tc = useTranslations("common");
  const viewer = useRef<HTMLIFrameElement | HTMLImageElement | null>(null);
  const blob = useMemo(() => {
    if (
      !documentTypes.includes(document.mime) ||
      !document.data.startsWith(`data:${document.mime};base64,`)
    )
      return null;
    try {
      return new Blob(
        [
          Uint8Array.from(atob(document.data.split(",")[1]), (char) =>
            char.charCodeAt(0),
          ),
        ],
        { type: document.mime },
      );
    } catch {
      return null;
    }
  }, [document]);
  useEffect(() => {
    if (!blob) return;
    const objectUrl = URL.createObjectURL(blob);
    if (viewer.current) viewer.current.src = objectUrl;
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>{document.name}</DialogTitle>
          <DialogDescription>{t("viewDocument")}</DialogDescription>
        </DialogHeader>
        {blob ? (
          document.mime === "application/pdf" ? (
            <iframe
              ref={(node) => {
                viewer.current = node;
              }}
              title={document.name}
              className="h-[60dvh] w-full"
            />
          ) : (
            <img
              ref={(node) => {
                viewer.current = node;
              }}
              alt={document.name}
              className="max-h-[60dvh] w-full object-contain"
            />
          )
        ) : (
          <p role="alert">{t("fileReadError")}</p>
        )}
        <DialogFooter>
          {blob && (
            <Button asChild variant="outline">
              <a href={document.data} download={document.name}>
                <Download />
                {tc("download")}
              </a>
            </Button>
          )}
          <Button variant="outline" onClick={close}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
