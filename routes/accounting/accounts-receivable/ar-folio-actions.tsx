import { useState, type FormEvent } from "react";
import { ArrowLeftRight, Ban, Eye } from "lucide-react";
import { useTranslations } from "use-intl";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import { Button } from "@/components/ui/button";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCan } from "@/hooks/use-can";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { ArCustomerLookup } from "./ar-customer-lookup";
import type { ArCustomer } from "./use-ar-customer";
import { canChangeFolio, type ArFolio } from "./ar-folio-model";

export type FolioAction = "invoices" | "switch" | "void";
const reasons = [
  "PMS_POSTING_ERROR",
  "SETTLEMENT_OFFSET",
  "DISPUTED_CHARGE",
  "WRONG_COMPANY",
  "OTHER",
] as const;

export function FolioActions({
  folio,
  open,
}: {
  readonly folio: ArFolio;
  readonly open: (action: FolioAction) => void;
}) {
  const t = useTranslations("accounting.arFolio");
  const { canWrite } = useCan();
  const disabled = !canWrite || !canChangeFolio(folio);
  return (
    <DataGridRowActions
      activity={{
        id: folio.id,
        disabled: true,
        disabledTitle: t("activityPending"),
      }}
    >
      <DropdownMenuItem onClick={() => open("invoices")}>
        <Eye />
        {t("linkedInvoices")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={disabled}
        title={disabled ? t("changeBlocked") : undefined}
        onClick={() => open("switch")}
      >
        <ArrowLeftRight />
        {t("switch")}
      </DropdownMenuItem>
      <DropdownMenuItem
        variant="destructive"
        disabled={disabled}
        title={disabled ? t("changeBlocked") : undefined}
        onClick={() => open("void")}
      >
        <Ban />
        {t("void")}
      </DropdownMenuItem>
    </DataGridRowActions>
  );
}

export function FolioDialog({
  folio,
  action,
  close,
  save,
}: {
  readonly folio: ArFolio;
  readonly action: FolioAction;
  readonly close: () => void;
  readonly save: (folio: ArFolio) => void;
}) {
  const t = useTranslations("accounting.arFolio");
  const tc = useTranslations("common");
  const { canWrite } = useCan();
  const money = useAmountFormatter();
  const { dateFormat } = useProfile();
  const [customer, setCustomer] = useState<ArCustomer>();
  const [reason, setReason] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canWrite || !canChangeFolio(folio))
      return setError(t("changeBlocked"));
    if (action === "void") {
      if (
        !reasons.some((value) => value === reason) ||
        remark.trim().length < 5
      )
        return setError(t("voidRequired"));
      save({
        ...folio,
        status: "void",
        unbilled: 0,
        syncRemark: `${t(`reasons.${reason}`)}: ${remark.trim()}`,
      });
    } else if (action === "switch") {
      if (
        !customer ||
        customer.is_active === false ||
        customer.id === folio.customerId
      )
        return setError(t("selectDifferentCustomer"));
      save({
        ...folio,
        customerId: customer.id,
        customerCode: customer.code,
        customerName: customer.name,
        contact: "",
      });
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t(action === "invoices" ? "linkedInvoices" : action)} ·{" "}
            {folio.folioNo}
          </DialogTitle>
          <DialogDescription>{t("sampleActions")}</DialogDescription>
        </DialogHeader>
        {action === "invoices" ? (
          <>
            <ApDetailGrid
              rows={folio.invoices}
              columns={[
                { accessorKey: "number", header: t("invoiceNo") },
                {
                  accessorKey: "date",
                  header: t("date"),
                  cell: ({ row }) => formatDate(row.original.date, dateFormat),
                },
                {
                  accessorKey: "amount",
                  header: t("billedAmount"),
                  cell: ({ row }) => (
                    <span className="tabular-nums">
                      {money(row.original.amount)}
                    </span>
                  ),
                },
                {
                  accessorKey: "status",
                  header: tc("status"),
                  cell: ({ row }) =>
                    t(`invoiceStatuses.${row.original.status}`),
                },
              ]}
              empty={t("noInvoices")}
            />
            <DialogFooter>
              <Button variant="outline" onClick={close}>
                {tc("close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <Field>
              <FieldLabel>{t("customer")}</FieldLabel>
              <FieldPlainText>
                {folio.customerCode} · {folio.customerName}
              </FieldPlainText>
            </Field>
            <Field>
              <FieldLabel>{t("total")}</FieldLabel>
              <FieldPlainText>{money(folio.total)}</FieldPlainText>
            </Field>
            {action === "void" ? (
              <>
                <Field>
                  <FieldLabel htmlFor="folio-reason">{t("reason")}</FieldLabel>
                  <Select value={reason} onValueChange={setReason}>
                    <SelectTrigger id="folio-reason" className="w-full">
                      <SelectValue placeholder={t("selectReason")} />
                    </SelectTrigger>
                    <SelectContent>
                      {reasons.map((value) => (
                        <SelectItem key={value} value={value}>
                          {t(`reasons.${value}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="folio-remark">{t("remark")}</FieldLabel>
                  <Textarea
                    id="folio-remark"
                    value={remark}
                    onChange={(event) => setRemark(event.target.value)}
                    required
                    minLength={5}
                    maxLength={500}
                  />
                </Field>
              </>
            ) : (
              <>
                <Field>
                  <FieldLabel>{t("newCustomer")}</FieldLabel>
                  <ArCustomerLookup customer={customer} change={setCustomer} />
                </Field>
                {customer && (
                  <Field>
                    <FieldLabel>{t("creditLimit")}</FieldLabel>
                    <FieldPlainText>
                      {money(Number(customer.credit_limit ?? 0))}
                    </FieldPlainText>
                  </Field>
                )}
                <p className="text-muted-foreground text-xs">
                  {t("creditPending")}
                </p>
              </>
            )}
            {error && (
              <p role="alert" className="text-destructive text-sm">
                {error}
              </p>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {tc("cancel")}
              </Button>
              <Button
                type="submit"
                variant={action === "void" ? "destructive" : "default"}
                disabled={!canWrite || !canChangeFolio(folio)}
              >
                {t(action)}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
