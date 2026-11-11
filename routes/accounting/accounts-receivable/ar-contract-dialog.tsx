import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
  type FormEvent,
} from "react";
import { Download, Eye, Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { LookupCurrencyIso } from "@/components/lookup/lookup-currency-iso";
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
import { Switch } from "@/components/ui/switch";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { round2 } from "@/lib/currency-utils";
import { ArCustomerLookup } from "./ar-customer-lookup";
import {
  nextContractNo,
  type ArContract,
  type readContractSamples,
} from "./ar-contract-model";
import type { ArCustomer } from "./use-ar-customer";

const documentTypes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
];

export function ContractDialog({
  mode,
  record,
  data,
  canWrite,
  close,
  edit,
  save,
}: {
  readonly mode: "add" | "view" | "edit";
  readonly record?: ArContract;
  readonly data: ReturnType<typeof readContractSamples>;
  readonly canWrite: boolean;
  readonly close: () => void;
  readonly edit: () => void;
  readonly save: (record: ArContract) => void;
}) {
  const t = useTranslations("accounting.arContract");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const money = useAmountFormatter();
  const readOnly = mode === "view" || !canWrite;
  const today = new Date().toLocaleDateString("en-CA");
  const [startDate, setStartDate] = useState(record?.startDate ?? today);
  const [customer, setCustomer] = useState<ArCustomer | undefined>(
    record
      ? {
          id: record.customerId,
          code: record.customerCode,
          name: record.customerName,
        }
      : undefined,
  );
  const [currency, setCurrency] = useState(record?.currency ?? "THB");
  const [rate, setRate] = useState(record?.rate ?? 1);
  const [amount, setAmount] = useState(record?.amount ?? 0);
  const [active, setActive] = useState(record?.active ?? true);
  const [document, setDocument] = useState(record?.document);
  const [viewDocument, setViewDocument] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly || reading) return;
    const fields = new FormData(event.currentTarget);
    const description = String(fields.get("descriptionColumn") ?? "").trim();
    const endDate = String(fields.get("endDate") ?? "");
    const chargeEvery = Number(fields.get("chargeEvery"));
    if (!customer || customer.is_active === false || !description)
      return setError(t("requiredFields"));
    if (!startDate || !endDate || endDate < startDate)
      return setError(t("dateOrder"));
    if (
      !currency ||
      !Number.isFinite(rate) ||
      rate <= 0 ||
      !Number.isFinite(amount) ||
      amount < 0 ||
      !Number.isInteger(chargeEvery) ||
      chargeEvery < 1
    )
      return setError(t("invalidAmounts"));
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
      amount,
      document,
    });
  }
  async function attach(file?: File) {
    if (!file) return;
    if (!documentTypes.includes(file.type) || file.size > 25 * 1024 * 1024)
      return setError(t("fileLimit"));
    setReading(true);
    try {
      const result = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      setDocument({ name: file.name, mime: file.type, data: result });
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
        <FieldLabel htmlFor={readOnly ? undefined : `contract-${name}`}>
          {t(name)}
        </FieldLabel>
        {readOnly ? (
          <FieldPlainText>{value}</FieldPlainText>
        ) : (
          <FieldInput
            id={`contract-${name}`}
            name={name}
            defaultValue={value}
            {...props}
          />
        )}
      </Field>
    );
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !reading) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {tc(mode)} · {t("title")}
          </DialogTitle>
          <DialogDescription>{t("sampleForm")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>{t("number")}</FieldLabel>
              <FieldPlainText>
                {record?.contractNo ?? nextContractNo(data, startDate)}
              </FieldPlainText>
            </Field>
            <Field orientation="horizontal">
              <FieldLabel htmlFor="contract-active">{ts("active")}</FieldLabel>
              <Switch
                id="contract-active"
                checked={active}
                onCheckedChange={setActive}
                disabled={readOnly}
              />
            </Field>
            <Field className="sm:col-span-2">
              <FieldLabel>{t("customer")}</FieldLabel>
              {readOnly ? (
                <FieldPlainText>
                  {customer?.code} · {customer?.name}
                </FieldPlainText>
              ) : (
                <ArCustomerLookup customer={customer} change={setCustomer} />
              )}
            </Field>
            <div className="sm:col-span-2">
              {field("descriptionColumn", record?.description ?? "", {
                required: true,
                maxLength: 255,
              })}
            </div>
            {field("startDate", startDate, {
              required: true,
              type: "date",
              value: startDate,
              defaultValue: undefined,
              onChange: (event) => setStartDate(event.target.value),
            })}
            {field("endDate", record?.endDate ?? today, {
              required: true,
              type: "date",
              min: startDate,
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
            {field("amount", amount, {
              required: true,
              type: "number",
              min: 0,
              step: "0.01",
              value: amount,
              defaultValue: undefined,
              onChange: (event) => setAmount(Number(event.target.value)),
            })}
            <Field>
              <FieldLabel>{t("amountThb")}</FieldLabel>
              <FieldPlainText>{money(round2(amount * rate))}</FieldPlainText>
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="contract-file">{t("attachment")}</FieldLabel>
            {!readOnly && (
              <FieldInput
                id="contract-file"
                type="file"
                accept={documentTypes.join(",")}
                disabled={reading}
                onChange={(event) => void attach(event.target.files?.[0])}
              />
            )}
            {document ? (
              <div className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-xs">
                  {document.name}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("viewDocument")}
                  onClick={() => setViewDocument(true)}
                >
                  <Eye />
                </Button>
                {!readOnly && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={tc("delete")}
                    onClick={() => setDocument(undefined)}
                  >
                    <Trash2 />
                  </Button>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">{t("noDocument")}</p>
            )}
            <p className="text-muted-foreground text-xs">{t("fileLimit")}</p>
          </Field>
          {error && (
            <p role="alert" className="text-destructive text-sm">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={close}
              disabled={reading}
            >
              {tc(readOnly ? "close" : "cancel")}
            </Button>
            {readOnly ? (
              canWrite && (
                <Button type="button" onClick={edit}>
                  {tc("edit")}
                </Button>
              )
            ) : (
              <Button type="submit" disabled={reading}>
                {tc("save")}
              </Button>
            )}
          </DialogFooter>
        </form>
        {viewDocument && document && (
          <ContractDocumentDialog
            document={document}
            close={() => setViewDocument(false)}
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
  readonly document: NonNullable<ArContract["document"]>;
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
      const bytes = Uint8Array.from(atob(document.data.split(",")[1]), (char) =>
        char.charCodeAt(0),
      );
      return new Blob([bytes], { type: document.mime });
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
