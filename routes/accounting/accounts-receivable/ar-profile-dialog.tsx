import { useState, type ComponentProps, type FormEvent } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { LookupCreditTerm } from "@/components/lookup/lookup-credit-term";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import {
  useArCustomer,
  useCreateArCustomer,
  useUpdateArCustomer,
  type ArCustomer,
  type ArCustomerInput,
} from "./use-ar-customer";

type ProfileMode = "add" | "view" | "edit";

function billingAddress(customer?: ArCustomer) {
  return customer?.customer_address?.find(
    (address) => address.address_type === "billing_address",
  );
}

export function ArProfileDialog({
  mode,
  id,
  canWrite,
  close,
  edit,
}: {
  readonly mode: ProfileMode;
  readonly id?: string;
  readonly canWrite: boolean;
  readonly close: () => void;
  readonly edit?: (id: string) => void;
}) {
  const t = useTranslations("accounting.arProfile");
  const tc = useTranslations("common");
  const detail = useArCustomer(id, { staleTime: 0 });
  const create = useCreateArCustomer();
  const update = useUpdateArCustomer();
  const pending = create.isPending || update.isPending;
  const title =
    mode === "add" ? t("add") : mode === "edit" ? t("edit") : t("view");

  function save(input: ArCustomerInput) {
    if (!canWrite || pending) return;
    const onSuccess = () => {
      toast.success(t("saved"));
      close();
    };
    if (id) update.mutate({ id, ...input }, { onSuccess });
    else create.mutate(input, { onSuccess });
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !pending) close();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            {detail.data
              ? `${detail.data.code} · ${detail.data.name}`
              : t("desc")}
          </DialogDescription>
        </DialogHeader>
        {detail.error ? (
          <ErrorState
            error={detail.error}
            message={t("loadError")}
            onRetry={() => detail.refetch()}
          />
        ) : id && !detail.data ? (
          <Skeleton className="h-40 w-full" />
        ) : detail.data && (mode === "view" || !canWrite) ? (
          <>
            <ProfileDetails customer={detail.data} />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={close}>
                {tc("close")}
              </Button>
              {canWrite && id && edit && (
                <Button type="button" onClick={() => edit(id)}>
                  {tc("edit")}
                </Button>
              )}
            </DialogFooter>
          </>
        ) : (
          <ProfileForm
            customer={detail.data}
            pending={pending}
            cancel={close}
            save={save}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function ProfileDetails({ customer }: { readonly customer: ArCustomer }) {
  const t = useTranslations("accounting.arProfile");
  const tc = useTranslations("common");
  const amount = useAmountFormatter();
  const { data: account } = useChartOfAccountById(
    customer.ar_chart_of_accounts_id || undefined,
  );
  const fields = [
    [t("code"), customer.code],
    [t("name"), customer.name],
    [t("registeredName"), customer.registered_name],
    [t("taxId"), customer.tax_no],
    [t("branch"), customer.branch_no],
    [t("creditTerm"), customer.credit_term_name],
    [t("creditLimit"), amount(Number(customer.credit_limit ?? 0))],
    [t("arAccount"), account && `${account.code} · ${account.description_1}`],
    [t("billingAddress"), billingAddress(customer)?.address_line1],
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {fields.map(([label, value]) => (
        <Field key={label}>
          <FieldLabel>{label}</FieldLabel>
          <FieldPlainText className="wrap-anywhere">
            {value || "—"}
          </FieldPlainText>
        </Field>
      ))}
      <Field>
        <FieldLabel>{tc("status")}</FieldLabel>
        <div>
          <StatusBadge active={customer.is_active !== false} />
        </div>
      </Field>
    </div>
  );
}

function ProfileForm({
  customer,
  pending,
  cancel,
  save,
}: {
  readonly customer?: ArCustomer;
  readonly pending: boolean;
  readonly cancel: () => void;
  readonly save: (input: ArCustomerInput) => void;
}) {
  const t = useTranslations("accounting.arProfile");
  const tc = useTranslations("common");
  const address = billingAddress(customer);
  const [creditTerm, setCreditTerm] = useState(customer?.credit_term_id ?? "");
  const [account, setAccount] = useState(
    customer?.ar_chart_of_accounts_id ?? null,
  );
  const [active, setActive] = useState(customer?.is_active !== false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const field = (key: string) => String(form.get(key) ?? "").trim();
    const rawCode = field("code");
    const code = rawCode === customer?.code ? rawCode : rawCode.toUpperCase();
    const name = field("name");
    if (
      !name ||
      !code ||
      (code !== customer?.code && !/^[A-Z0-9-]+$/.test(code))
    ) {
      toast.error(t("invalidIdentity"));
      return;
    }
    const limit = field("creditLimit") || "0";
    if (!/^\d+(\.\d+)?$/.test(limit)) {
      toast.error(t("invalidCreditLimit"));
      return;
    }
    const line = field("billingAddress");
    const customerAddress = address
      ? line !== (address.address_line1 ?? "")
        ? {
            update: [
              { customer_address_id: address.id, address_line1: line || null },
            ],
          }
        : undefined
      : line
        ? {
            add: [
              { address_type: "billing_address" as const, address_line1: line },
            ],
          }
        : undefined;
    save({
      code,
      name,
      is_active: active,
      registered_name: field("registeredName") || null,
      tax_no: field("taxId") || null,
      branch_no: field("branch") || null,
      credit_term_id:
        creditTerm !== (customer?.credit_term_id ?? "")
          ? creditTerm || null
          : undefined,
      credit_limit: limit,
      ar_chart_of_accounts_id:
        account !== (customer?.ar_chart_of_accounts_id ?? null)
          ? account
          : undefined,
      customer_address: customerAddress,
    });
  }

  function input(
    name: string,
    value?: string | number | null,
    props?: ComponentProps<typeof FieldInput>,
  ) {
    return (
      <Field>
        <FieldLabel htmlFor={`ar-profile-${name}`}>{t(name)}</FieldLabel>
        <FieldInput
          name={name}
          id={`ar-profile-${name}`}
          defaultValue={value ?? ""}
          disabled={pending}
          {...props}
        />
      </Field>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {input("code", customer?.code, {
          required: true,
          title: t("codeHint"),
        })}
        {input("name", customer?.name, { required: true })}
        {input("registeredName", customer?.registered_name)}
        {input("taxId", customer?.tax_no, {
          inputMode: "numeric",
          pattern: "[0-9]{13}",
          maxLength: 13,
        })}
        {input("branch", customer?.branch_no, {
          inputMode: "numeric",
          pattern: "[0-9]{5}",
          maxLength: 5,
        })}
        {input("creditLimit", customer?.credit_limit, {
          type: "number",
          min: 0,
          step: "any",
        })}
        <Field>
          <FieldLabel>{t("creditTerm")}</FieldLabel>
          <div className="flex min-w-0 items-center gap-1">
            <LookupCreditTerm
              value={creditTerm}
              onValueChange={setCreditTerm}
              disabled={pending}
              placeholder={t("creditTerm")}
            />
            {creditTerm && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={pending}
                aria-label={t("clearCreditTerm")}
                onClick={() => setCreditTerm("")}
              >
                <X />
              </Button>
            )}
          </div>
        </Field>
        <Field>
          <FieldLabel>{t("arAccount")}</FieldLabel>
          <LookupChartOfAccountById
            value={account}
            onValueChange={setAccount}
            disabled={pending}
            placeholder={t("arAccount")}
          />
        </Field>
        {input("billingAddress", address?.address_line1)}
        <Field className="flex-row items-center gap-2 self-end pb-1">
          <FieldLabel htmlFor="ar-profile-active">{t("active")}</FieldLabel>
          <Switch
            id="ar-profile-active"
            checked={active}
            onCheckedChange={setActive}
            disabled={pending}
          />
        </Field>
      </div>
      <DialogFooter>
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={cancel}
        >
          {tc("cancel")}
        </Button>
        <Button type="submit" disabled={pending}>
          {tc("save")}
        </Button>
      </DialogFooter>
    </form>
  );
}
