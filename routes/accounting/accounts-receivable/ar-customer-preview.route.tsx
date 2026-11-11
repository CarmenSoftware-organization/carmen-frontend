import { useState, type ComponentProps, type FormEvent } from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Link, Navigate, useParams } from "react-router";
import { toast } from "sonner";
import { useFormatter, useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import SearchInput from "@/components/search-input";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Button } from "@/components/ui/button";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldInput, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApDetailGrid } from "../accounts-payable/shared/ap-detail-grid";
import {
  AR_PREVIEW_PATH,
  readPreviewCustomers,
  removePreviewCustomer,
  writePreviewCustomers,
  type CustomerDirectory,
  type PreviewContract,
  type PreviewCustomers,
  type PreviewProfile,
} from "./ar-customer-preview-store";

type RecordItem = PreviewProfile | PreviewContract;
type Editor = { mode: "add" } | { mode: "view" | "edit"; item: RecordItem };
const directories = ["profiles", "contracts"] as const;

export function Component() {
  const { directory } = useParams();
  if (directory !== "profiles" && directory !== "contracts") {
    return <Navigate to={AR_PREVIEW_PATH} replace />;
  }
  return <Directory key={directory} directory={directory} />;
}

function Directory({ directory }: { directory: CustomerDirectory }) {
  "use no memo";
  const t = useTranslations("accounting.arPreview");
  const tc = useTranslations("common");
  const format = useFormatter();
  const [data, setData] = useState(readPreviewCustomers);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [deleting, setDeleting] = useState<RecordItem | null>(null);
  const isProfiles = directory === "profiles";
  const profileLabel = (id: string) => {
    const profile = data.profiles.find((item) => item.id === id);
    return profile ? `${profile.code} · ${profile.name}` : "—";
  };
  const rows: RecordItem[] = data[directory].filter((item) => {
    if ("active" in item && status !== "all" && item.active !== (status === "active")) return false;
    const related = "profileId" in item ? profileLabel(item.profileId) : item.taxId;
    return `${item.code} ${item.name} ${related}`.toLowerCase().includes(search.trim().toLowerCase());
  });

  function persist(next: PreviewCustomers) {
    try {
      writePreviewCustomers(next);
      setData(next);
      return true;
    } catch {
      toast.error(t("storageError"));
      return false;
    }
  }

  const columns: ColumnDef<RecordItem>[] = [
    {
      accessorKey: "code",
      header: t("code"),
      cell: ({ row: { original } }) => (
        <Button size="sm" variant="link" className="h-auto p-0" onClick={() => setEditor({ mode: "view", item: original })}>
          {original.code}
        </Button>
      ),
    },
    { accessorKey: "name", header: t("name") },
    isProfiles
      ? { accessorKey: "taxId", header: t("taxId"), cell: ({ getValue }) => getValue<string>() || "—" }
      : { id: "customer", header: t("customer"), cell: ({ row }) => "profileId" in row.original && profileLabel(row.original.profileId) },
    isProfiles
      ? { id: "terms", header: t("creditTerms"), cell: ({ row }) => "creditDays" in row.original && t("creditDays", { count: row.original.creditDays }) }
      : { id: "amount", header: t("amount"), cell: ({ row }) => "amount" in row.original && format.number(row.original.amount, { style: "currency", currency: "THB" }) },
    ...(isProfiles ? [{
      id: "status",
      header: tc("status"),
      cell: ({ row }: { row: { original: RecordItem } }) => "active" in row.original && t(row.original.active ? "active" : "inactive"),
    }] : []),
    {
      id: "actions",
      header: tc("rowActions"),
      cell: ({ row: { original } }) => (
        <DataGridRowActions
          onEdit={() => setEditor({ mode: "edit", item: original })}
          onDelete={() => setDeleting(original)}
          deleteDisabledTitle={isProfiles && data.contracts.some((item) => item.profileId === original.id) ? t("profileInUse") : undefined}
        />
      ),
    },
  ];

  return (
    <ListPageShell
      title={t(directory)}
      description={t("customerDirectoryDescription")}
      count={rows.length}
      mock
      actions={
        <Button onClick={() => setEditor({ mode: "add" })}>
          <Plus /> {t(isProfiles ? "addProfile" : "addContract")}
        </Button>
      }
      toolbar={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label={t("customerDirectoryNavigation")} className="flex flex-wrap gap-1">
            <Button asChild size="sm" variant="ghost">
              <Link to={AR_PREVIEW_PATH}><ArrowLeft /> {t("title")}</Link>
            </Button>
            {directories.map((name) => (
              <Button key={name} asChild size="sm" variant={directory === name ? "secondary" : "ghost"}>
                <Link to={`${AR_PREVIEW_PATH}/${name}`} aria-current={directory === name ? "page" : undefined}>{t(name)}</Link>
              </Button>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput defaultValue={search} onSearch={setSearch} onInputChange={setSearch} />
            {isProfiles && (
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger size="sm" aria-label={tc("status")}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tc("allStatus")}</SelectItem>
                  <SelectItem value="active">{t("active")}</SelectItem>
                  <SelectItem value="inactive">{t("inactive")}</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
      }
    >
      <ApDetailGrid rows={rows} columns={columns} empty={tc("noData")} />
      {editor && (
        <CustomerEditor
          key={editor.mode}
          editor={editor}
          directory={directory}
          data={data}
          close={() => setEditor(null)}
          edit={(item) => setEditor({ mode: "edit", item })}
          save={(next) => { if (persist(next)) setEditor(null); }}
        />
      )}
      <DeleteDialog
        open={deleting !== null}
        title={deleting?.code ?? ""}
        onOpenChange={(open) => { if (!open) setDeleting(null); }}
        onConfirm={() => {
          if (!deleting) return;
          const next = removePreviewCustomer(data, directory, deleting.id);
          if (!next) toast.error(t("profileInUse"));
          else if (persist(next)) setDeleting(null);
        }}
      />
    </ListPageShell>
  );
}

function CustomerEditor({ editor, directory, data, close, edit, save }: {
  editor: Editor;
  directory: CustomerDirectory;
  data: PreviewCustomers;
  close: () => void;
  edit: (item: RecordItem) => void;
  save: (data: PreviewCustomers) => void;
}) {
  const t = useTranslations("accounting.arPreview");
  const tc = useTranslations("common");
  const item = editor.mode === "add" ? undefined : editor.item;
  const isProfiles = directory === "profiles";
  const readOnly = editor.mode === "view";
  const profile = item && "active" in item ? item : undefined;
  const contract = item && "profileId" in item ? item : undefined;
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (readOnly) return;
    const fields = new FormData(event.currentTarget);
    const value = (key: string) => String(fields.get(key) ?? "").trim();
    const base = { id: item?.id ?? crypto.randomUUID(), code: value("code").toUpperCase(), name: value("name") };
    if (!base.code || !base.name) return setError(t("requiredFields"));
    if (data[directory].some((record) => record.id !== base.id && record.code.toUpperCase() === base.code)) {
      return setError(t("duplicateCode"));
    }

    if (isProfiles) {
      const next: PreviewProfile = {
        ...base,
        taxId: value("taxId"),
        creditDays: Number(value("creditTerms")),
        billingAddress: value("taxAddress"),
        active: value("status") === "active",
      };
      const profiles = item
        ? data.profiles.map((record) => record.id === base.id ? next : record)
        : [...data.profiles, next];
      save({ ...data, profiles });
      return;
    }

    const profileId = value("customer");
    const startDate = value("startDate");
    const endDate = value("endDate");
    if (!data.profiles.some((record) => record.id === profileId)) return setError(t("selectProfile"));
    if (!startDate || !endDate || endDate < startDate) return setError(t("dateOrder"));
    const next: PreviewContract = { ...base, profileId, startDate, endDate, amount: Number(value("amount")) };
    const contracts = item
      ? data.contracts.map((record) => record.id === base.id ? next : record)
      : [...data.contracts, next];
    save({ ...data, contracts });
  }

  function field(name: string, defaultValue?: string | number, props?: ComponentProps<typeof FieldInput>) {
    return (
      <Field>
        <FieldLabel htmlFor={readOnly ? undefined : `ar-preview-${name}`}>{name === "status" ? tc("status") : t(name)}</FieldLabel>
        {readOnly ? <FieldPlainText>{defaultValue ?? "—"}</FieldPlainText> : (
          <FieldInput id={`ar-preview-${name}`} name={name} defaultValue={defaultValue} {...props} />
        )}
      </Field>
    );
  }

  const linkedProfile = data.profiles.find((record) => record.id === contract?.profileId);
  return (
    <Dialog open onOpenChange={(open) => { if (!open) close(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tc(editor.mode)} · {t(isProfiles ? "profileTab" : "contractTab")}</DialogTitle>
          <DialogDescription>{t("customerDirectoryDescription")}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {field("code", item?.code, { required: true, pattern: "[A-Za-z0-9\\-]+", title: t("codeHint") })}
            {field("name", item?.name, { required: true })}
            {isProfiles ? (
              <>
                {field("taxId", profile?.taxId, { inputMode: "numeric", pattern: "[0-9]{13}", title: t("taxIdHint") })}
                {field("creditTerms", profile?.creditDays ?? 0, { required: true, type: "number", min: 0, step: 1 })}
                {field("taxAddress", profile?.billingAddress)}
                {readOnly ? field("status", t(profile?.active ? "active" : "inactive")) : (
                  <Field>
                    <FieldLabel htmlFor="ar-preview-status">{tc("status")}</FieldLabel>
                    <Select name="status" defaultValue={profile?.active === false ? "inactive" : "active"}>
                      <SelectTrigger id="ar-preview-status" className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">{t("active")}</SelectItem>
                        <SelectItem value="inactive">{t("inactive")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
              </>
            ) : (
              <>
                {readOnly ? field("customer", linkedProfile && `${linkedProfile.code} · ${linkedProfile.name}`) : (
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="ar-preview-customer">{t("customer")}</FieldLabel>
                    <Select name="customer" defaultValue={contract?.profileId}>
                      <SelectTrigger id="ar-preview-customer" className="w-full"><SelectValue placeholder={t("selectProfile")} /></SelectTrigger>
                      <SelectContent>
                        {data.profiles.map((record) => <SelectItem key={record.id} value={record.id}>{record.code} · {record.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                {field("startDate", contract?.startDate, { required: true, type: "date" })}
                {field("endDate", contract?.endDate, { required: true, type: "date" })}
                {field("amount", contract?.amount, { required: true, type: "number", min: 0.01, step: 0.01 })}
              </>
            )}
          </div>
          {error && <p role="alert" className="text-destructive text-sm">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>{tc(readOnly ? "close" : "cancel")}</Button>
            {readOnly && item ? <Button type="button" onClick={() => edit(item)}>{tc("edit")}</Button> : <Button type="submit">{tc("save")}</Button>}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
