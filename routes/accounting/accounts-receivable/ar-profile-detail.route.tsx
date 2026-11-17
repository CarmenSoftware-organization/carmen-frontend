import {
  useState,
  type ComponentProps,
  type FormEvent,
  type ReactNode,
} from "react";
import { useNavigate, useParams, useSearchParams } from "react-router";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Paperclip, Power } from "lucide-react";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar, ToolbarLabel } from "@/components/share/form-toolbar";
import { CompactSection, FieldGrid } from "@/components/share/compact-section";
import {
  Field,
  FieldInput,
  FieldLabel,
  FieldPlainText,
} from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { LookupCreditTerm } from "@/components/lookup/lookup-credit-term";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { LookupChartOfAccountById } from "@/components/lookup/lookup-chart-of-account-by-id";
import { useBuCode } from "@/hooks/use-bu-code";
import { useCan } from "@/hooks/use-can";
import { useCreditTerm } from "@/hooks/use-credit-term";
import { useTaxProfileById } from "@/hooks/use-tax-profile";
import { useChartOfAccountById } from "@/hooks/use-chart-of-account";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import { isoToDateInput } from "@/lib/date-utils";
import { ArCustomerLookup } from "./ar-customer-lookup";
import { ContractList } from "./ar-contract.route";
import { ProfileAttachments } from "./ar-profile-attachments";
import {
  profileDraft,
  profileInput,
  profileValidation,
  readProfileExtension,
  saveProfileExtension,
  taxAddress,
  PROFILE_TYPES,
  type ProfileDraft,
} from "./ar-profile-model";
import {
  useArCustomer,
  useCreateArCustomer,
  useUpdateArCustomer,
  useDeleteArCustomer,
  type ArCustomer,
} from "./use-ar-customer";

const BASE = "/accounting/accounts-receivable/profile";
export function Component() {
  const { id } = useParams();
  const bu = useBuCode() ?? "";
  const [params] = useSearchParams();
  const detail = useArCustomer(id === "new" ? undefined : id, { staleTime: 0 });
  const terms = useCreditTerm({ perpage: 100 }, { enabled: id === "new" });
  if (id === "new" && terms.isLoading) return <Skeleton className="m-4 h-72" />;
  if (id !== "new" && detail.isLoading)
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-10" />
        <Skeleton className="h-72" />
      </div>
    );
  if (id !== "new" && (detail.error || !detail.data))
    return (
      <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />
    );
  return (
    <ProfileDetail
      key={`${bu}.${id}.${params.get("mode")}.${params.get("mode") === "edit" ? "" : detail.dataUpdatedAt}`}
      bu={bu}
      customer={detail.data}
      defaultCreditTerm={
        terms.data?.data.find((term) => term.value === 30 && term.is_active)?.id
      }
      editing={id === "new" || params.get("mode") === "edit"}
    />
  );
}

function ProfileDetail({
  bu,
  customer,
  editing,
  defaultCreditTerm,
}: {
  readonly bu: string;
  readonly customer?: ArCustomer;
  readonly editing: boolean;
  readonly defaultCreditTerm?: string;
}) {
  const t = useTranslations("accounting.arProfile");
  const navigate = useNavigate();
  const { canWrite } = useCan();
  const initial = profileDraft(
    customer,
    customer ? readProfileExtension(bu, customer.id) : {},
  );
  if (!customer && defaultCreditTerm) initial.creditTermId = defaultCreditTerm;
  const [draft, setDraft] = useState(initial);
  const [tab, setTab] = useState("information");
  const [deleting, setDeleting] = useState(false);
  const [attachments, setAttachments] = useState(false);
  const [partialId, setPartialId] = useState<string>();
  const taxProfile = useTaxProfileById(
    !editing ? (customer?.tax_profile_id ?? undefined) : undefined,
  );
  const account = useChartOfAccountById(
    !editing ? (customer?.ar_chart_of_accounts_id ?? undefined) : undefined,
  );
  const create = useCreateArCustomer();
  const update = useUpdateArCustomer();
  const remove = useDeleteArCustomer();
  const pending = create.isPending || update.isPending || remove.isPending;
  const dirty = editing && JSON.stringify(draft) !== JSON.stringify(initial);
  useUnsavedChanges(dirty);
  const go = (path: string) => {
    if (!dirty || window.confirm(t("discardChanges"))) navigate(path);
  };
  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) =>
    setDraft((old) => ({ ...old, [key]: value }));
  const disabled = !editing || pending || !canWrite || !!partialId;
  const field = (
    key: keyof ProfileDraft,
    required = false,
    props: ComponentProps<typeof FieldInput> = {},
    className?: string,
  ) => (
    <Field className={className} key={key}>
      <FieldLabel htmlFor={`arp-${key}`} required={editing && required}>
        {t(key === "name" ? "companyName" : key)}
      </FieldLabel>
      {!editing ? (
        <FieldPlainText>{String(draft[key] || "—")}</FieldPlainText>
      ) : (
        <FieldInput
          id={`arp-${key}`}
          value={String(draft[key])}
          onChange={(e) => set(key, e.target.value as never)}
          required={required}
          disabled={disabled}
          {...props}
        />
      )}
    </Field>
  );
  const select = (
    key: keyof ProfileDraft,
    values: readonly string[],
    label: (value: string) => string = (value) => value,
  ): ReactNode => (
    <Field>
      <FieldLabel
        htmlFor={`arp-${key}`}
        required={
          editing && (key !== "title" || draft.entityType === "individual")
        }
      >
        {t(key === "title" ? "contactTitle" : key)}
      </FieldLabel>
      {!editing ? (
        <FieldPlainText>
          {draft[key] ? label(String(draft[key])) : "—"}
        </FieldPlainText>
      ) : (
        <Select
          value={String(draft[key]) || "_"}
          onValueChange={(v) => set(key, (v === "_" ? "" : v) as never)}
          disabled={disabled}
        >
          <SelectTrigger id={`arp-${key}`} className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {values.map((v) => (
              <SelectItem key={v || "_"} value={v || "_"}>
                {v ? label(v) : "—"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </Field>
  );
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!canWrite || pending) return;
    const error = profileValidation(draft);
    if (error) {
      setTab("information");
      toast.error(t(error));
      return;
    }
    try {
      let id = partialId;
      if (!id) {
        const input = profileInput(draft, customer);
        const result = customer
          ? await update.mutateAsync({ id: customer.id, ...input })
          : await create.mutateAsync(input);
        const body = result as { data?: { id?: string }; id?: string };
        id = customer?.id ?? body.data?.id ?? body.id;
      }
      if (!id) {
        toast.error(t("savedWithoutId"));
        navigate(BASE);
        return;
      }
      try {
        saveProfileExtension(bu, id, draft);
      } catch {
        setPartialId(id);
        toast.error(t("localSaveFailed"));
        return;
      }
      toast.success(t("saved"));
      navigate(`${BASE}/${id}`, { replace: true });
    } catch {
      /* API errors are displayed by the shared mutation handler. */
    }
  }
  async function toggleStatus() {
    if (!customer || !canWrite || pending) return;
    try {
      await update.mutateAsync({
        id: customer.id,
        code: customer.code,
        name: customer.name,
        registered_name: customer.registered_name ?? null,
        tax_no: customer.tax_no ?? null,
        branch_no: customer.branch_no ?? null,
        credit_limit: String(customer.credit_limit ?? 0),
        is_active: !draft.active,
      });
    } catch {
      /* Shared mutation handler keeps the current profile intact. */
    }
  }
  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          entity={t("entity")}
          mode={customer ? (editing ? "edit" : "view") : "add"}
          title={customer ? `${customer.code} · ${customer.name}` : t("add")}
          formId="ar-profile-form"
          isPending={pending}
          onBack={() => go(BASE)}
          onCancel={() => go(customer ? `${BASE}/${customer.id}` : BASE)}
          onEdit={() => navigate(`${BASE}/${customer?.id}?mode=edit`)}
          onDelete={customer && !editing ? () => setDeleting(true) : undefined}
          badges={customer && <StatusBadge active={draft.active} />}
          activity={
            customer ? { id: customer.id, label: customer.code } : undefined
          }
        >
          {customer && !editing && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!canWrite || pending}
              title={t(draft.active ? "deactivate" : "activate")}
              onClick={() => void toggleStatus()}
            >
              <Power />
              <ToolbarLabel>
                {t(draft.active ? "deactivate" : "activate")}
              </ToolbarLabel>
            </Button>
          )}
          {customer && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              title={t("attachments")}
              onClick={() => setAttachments(true)}
            >
              <Paperclip />
              <ToolbarLabel>{t("attachments")}</ToolbarLabel>
            </Button>
          )}
        </FormToolbar>
      }
    >
      <div className="@container/ar-profile space-y-3">
        <p className="text-muted-foreground text-xs">{t("mockFieldsNotice")}</p>
        {partialId && (
          <p role="alert" className="text-destructive text-xs">
            {t("partialSave")}
          </p>
        )}
        {customer && !editing && (
          <div className="max-w-sm">
            <Field>
              <FieldLabel>{t("quickSwitch")}</FieldLabel>
              <ArCustomerLookup
                customer={customer}
                change={(c) => c && navigate(`${BASE}/${c.id}`)}
              />
            </Field>
          </div>
        )}
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList variant="line">
            <TabsTrigger value="information">{t("information")}</TabsTrigger>
            <TabsTrigger value="contract" disabled={!customer || editing}>
              {t("contract")}
            </TabsTrigger>
          </TabsList>
          <TabsContent
            value="information"
            forceMount
            hidden={tab !== "information"}
          >
            <form id="ar-profile-form" onSubmit={save} className="space-y-4">
              <CompactSection title={t("general")} first frameless>
                <div className="grid gap-x-4 gap-y-3 @md/ar-profile:grid-cols-2 @3xl/ar-profile:grid-cols-3 @5xl/ar-profile:grid-cols-6">
                  {field("code", true, {
                    maxLength: 15,
                    pattern: "[A-Z0-9_-]+",
                    readOnly: !!customer,
                    onChange: (e) => set("code", e.target.value.toUpperCase()),
                    className: "font-mono",
                    placeholder: draft.name
                      .match(/[A-Za-z]/)?.[0]
                      .toUpperCase(),
                    title: t("codeHint"),
                  })}
                  {select("type", PROFILE_TYPES, (v) => t(`type${v}`))}
                  {select("title", ["", "Mr.", "Mrs.", "Ms.", "Dr."])}
                  {field("firstName", draft.entityType === "individual", {
                    maxLength: 100,
                  })}
                  {field("lastName", draft.entityType === "individual", {
                    maxLength: 100,
                  })}
                  {field("position", false, { maxLength: 100 })}
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-3 @md/ar-profile:grid-cols-2 @3xl/ar-profile:grid-cols-3 @5xl/ar-profile:grid-cols-6">
                  {draft.entityType === "corporate" &&
                    field(
                      "name",
                      draft.entityType === "corporate",
                      { maxLength: 255 },
                      "@5xl/ar-profile:col-span-2",
                    )}
                  {field("telephone", false, { maxLength: 50, type: "tel" })}
                  {field("fax", false, { maxLength: 50 })}
                  {field(
                    "email",
                    false,
                    { maxLength: 100, type: "email" },
                    "@5xl/ar-profile:col-span-2",
                  )}
                </div>
                <div className="mt-3 grid gap-x-4 gap-y-3 @md/ar-profile:grid-cols-3 @5xl/ar-profile:grid-cols-6">
                  <Field>
                    <FieldLabel required={editing}>
                      {t("registerDate")}
                    </FieldLabel>
                    <DatePicker
                      value={draft.registerDate}
                      onValueChange={(v) =>
                        set("registerDate", isoToDateInput(v))
                      }
                      readOnly={!editing}
                      disabled={disabled}
                      hideClear
                    />
                  </Field>
                  {field(
                    "note",
                    false,
                    { maxLength: 500 },
                    "@md/ar-profile:col-span-2 @5xl/ar-profile:col-span-5",
                  )}
                </div>
              </CompactSection>
              <CompactSection title={t("financial")} first frameless>
                <FieldGrid>
                  {select("paymentType", ["BANK", "CHQ", "CASH", "CC"], (v) =>
                    t(`payment${v}`),
                  )}
                  <Field>
                    <FieldLabel required={editing}>
                      {t("taxProfileId")}
                    </FieldLabel>
                    {!editing ? (
                      <FieldPlainText>
                        {taxProfile.data?.name ||
                          (taxProfile.isError ? t("lookupLoadError") : "—")}
                      </FieldPlainText>
                    ) : (
                      <LookupTaxProfile
                        value={draft.taxProfileId}
                        onValueChange={(v) => set("taxProfileId", v)}
                        disabled={disabled}
                      />
                    )}
                  </Field>
                  {select(
                    "whtService",
                    ["NONE", "01", "02", "03", "04", "05"],
                    (v) => t(`wht${v}`),
                  )}
                  <Field>
                    <FieldLabel required={editing}>
                      {t("creditTerm")}
                    </FieldLabel>
                    {!editing ? (
                      <FieldPlainText>
                        {customer?.credit_term_name || "—"}
                      </FieldPlainText>
                    ) : (
                      <LookupCreditTerm
                        value={draft.creditTermId}
                        onValueChange={(v) => set("creditTermId", v)}
                        disabled={disabled}
                      />
                    )}
                  </Field>
                  {field("creditLimit", true, {
                    type: "number",
                    min: 0,
                    step: "0.01",
                    className: "text-right tabular-nums",
                  })}
                  <Field>
                    <FieldLabel>{t("arAccount")}</FieldLabel>
                    {!editing ? (
                      <FieldPlainText>
                        {account.data
                          ? `${account.data.code} · ${account.data.description_1}`
                          : account.isError
                            ? t("lookupLoadError")
                            : "—"}
                      </FieldPlainText>
                    ) : (
                      <LookupChartOfAccountById
                        value={draft.accountId}
                        onValueChange={(v) => set("accountId", v ?? "")}
                        disabled={disabled}
                      />
                    )}
                  </Field>
                </FieldGrid>
              </CompactSection>
              <CompactSection title={t("taxEntity")} first frameless>
                <FieldGrid>
                  {select("entityType", ["corporate", "individual"], (v) =>
                    t(v),
                  )}
                  {draft.entityType === "corporate" ? (
                    field("registeredName", true, { maxLength: 255 })
                  ) : (
                    <Field>
                      <FieldLabel>{t("registeredName")}</FieldLabel>
                      <FieldPlainText>
                        {[draft.title, draft.firstName, draft.lastName]
                          .filter(Boolean)
                          .join(" ") || "—"}
                      </FieldPlainText>
                    </Field>
                  )}
                  <Field>
                    <FieldLabel htmlFor="arp-taxId" required={editing}>
                      {t(
                        draft.entityType === "individual"
                          ? "citizenId"
                          : "taxId",
                      )}
                    </FieldLabel>
                    {editing ? (
                      <FieldInput
                        id="arp-taxId"
                        value={draft.taxId}
                        onChange={(e) => set("taxId", e.target.value)}
                        required
                        pattern="[0-9]{13}"
                        maxLength={13}
                        inputMode="numeric"
                        disabled={disabled}
                      />
                    ) : (
                      <FieldPlainText>{draft.taxId || "—"}</FieldPlainText>
                    )}
                  </Field>
                  {field("branch", true, {
                    pattern: "[0-9]{5}",
                    maxLength: 5,
                    inputMode: "numeric",
                  })}
                </FieldGrid>
                <div className="mt-3">
                  <FieldGrid>
                    {field("addressLine1", true, { maxLength: 255 })}
                    {field("subDistrict", true, { maxLength: 100 })}
                    {field("district", true, { maxLength: 100 })}
                    {field("province", true, { maxLength: 100 })}
                    {field("postalCode", true, {
                      maxLength: 5,
                      pattern: "[0-9]{5}",
                      inputMode: "numeric",
                    })}
                  </FieldGrid>
                </div>
              </CompactSection>
              <div className="grid gap-4 @3xl/ar-profile:grid-cols-2">
                {(["billing", "mailing"] as const).map((kind) => (
                  <CompactSection
                    key={kind}
                    title={t(`${kind}Address`)}
                    first
                    frameless
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Checkbox
                        id={`arp-${kind}-same`}
                        checked={draft[`${kind}Same`]}
                        onCheckedChange={(v) => set(`${kind}Same`, v === true)}
                        disabled={disabled}
                      />
                      <FieldLabel htmlFor={`arp-${kind}-same`}>
                        {t("sameAsTax")}
                      </FieldLabel>
                    </div>
                    <div className="grid gap-3 @md:grid-cols-2">
                      {field(`${kind}Contact`, false, { maxLength: 150 })}
                      {field(`${kind}Email`, kind === "billing", {
                        type: "email",
                        maxLength: 100,
                      })}
                    </div>
                    <Field className="mt-3">
                      <FieldLabel
                        htmlFor={`arp-${kind}Address`}
                        required={editing}
                      >
                        {t("addressDetail")}
                      </FieldLabel>
                      {editing ? (
                        <Textarea
                          id={`arp-${kind}Address`}
                          rows={2}
                          value={
                            draft[`${kind}Same`]
                              ? taxAddress(draft)
                              : draft[`${kind}Address`]
                          }
                          onChange={(e) =>
                            set(`${kind}Address`, e.target.value)
                          }
                          required
                          readOnly={draft[`${kind}Same`]}
                          disabled={disabled}
                        />
                      ) : (
                        <FieldPlainText>
                          {draft[`${kind}Same`]
                            ? taxAddress(draft)
                            : draft[`${kind}Address`] || "—"}
                        </FieldPlainText>
                      )}
                    </Field>
                  </CompactSection>
                ))}
              </div>
            </form>
          </TabsContent>
          <TabsContent value="contract">
            {customer && <ContractList customer={customer} embedded />}
          </TabsContent>
        </Tabs>
      </div>
      <DeleteDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: customer?.name ?? "" })}
        isPending={remove.isPending}
        onConfirm={() =>
          customer &&
          remove.mutate(customer.id, { onSuccess: () => navigate(BASE) })
        }
      />
      {customer && attachments && (
        <ProfileAttachments
          bu={bu}
          id={customer.id}
          close={() => setAttachments(false)}
          canWrite={canWrite}
        />
      )}
    </FormPageShell>
  );
}
