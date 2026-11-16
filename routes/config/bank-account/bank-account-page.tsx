import { ConfigMasterGrid } from "../shared/config-master-grid";
import { useMasterGridLayout } from "../shared/use-config-list-table";
import { useAccountingConfigEdit } from "../shared/use-accounting-config-edit";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Landmark, Plus } from "lucide-react";
import { toast } from "sonner";
import SearchInput from "@/components/search-input";
import { ListPageShell } from "@/components/share/list-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import { CellAction } from "@/components/ui/cell-action";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldInput, FieldLabel } from "@/components/ui/field";
import { StatusSwitch } from "@/components/ui/status-switch";
import { WarningDialog } from "@/components/ui/warning-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { useBankAccounts } from "@/hooks/use-accounting-master";
import { useBuCode } from "@/hooks/use-bu-code";
import { useChartOfAccount } from "@/hooks/use-chart-of-account";
import { useCurrency } from "@/hooks/use-currency";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type { BankAccountMaster } from "@/types/accounting-master";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";

export default function BankAccountPage() {
  "use no memo";
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const bankQuery = useBankAccounts();
  const { data: currencyData } = useCurrency({ perpage: 100 });
  const { data: accountData } = useChartOfAccount({ perpage: 100 });
  const [search, setSearch] = useState("");
  const canEdit = useAccountingConfigEdit("accounting.config.gl");
  const [editing, setEditing] = useState<
    BankAccountMaster | null | undefined
  >();
  const [deleting, setDeleting] = useState<BankAccountMaster | null>(null);
  const [warning, setWarning] = useState("");
  const [saving, setSaving] = useState(false);

  const saveBankAccount = async (
    value: Omit<BankAccountMaster, "id" | "doc_version">,
  ) => {
    if (!buCode) throw new Error("Select a business unit first");
    const code = value.code?.trim();
    const currencyId = currencyData?.data.find(
      (currency) => currency.code === value.currency_code,
    )?.id;
    const accountId = accountData?.data.find(
      (account) =>
        account.id === value.gl_account_id ||
        account.code === value.gl_account_id,
    )?.id;
    if (!code || !currencyId || !accountId) {
      throw new Error("Code, valid currency and GL account are required");
    }
    const payload = {
      name: value.account_name.trim(),
      bank_name: value.bank_name.trim(),
      bank_branch: value.branch_name || null,
      account_no: value.account_number.trim(),
      currency_id: currencyId,
      chart_of_accounts_id: accountId,
      is_active: value.is_active,
      ...(editing ? { doc_version: editing.doc_version } : { code }),
    };
    const endpoint = API_ENDPOINTS.GL_BANK_ACCOUNTS(buCode);
    const res = editing
      ? await httpClient.put(`${endpoint}/${editing.id}`, payload)
      : await httpClient.post(endpoint, payload);
    if (!res.ok) throw await ApiError.from(res, "Unable to save bank account");
    await queryClient.invalidateQueries({
      queryKey: ["accounting-master", "bank-accounts", buCode],
    });
  };

  const rows = useMemo(
    () =>
      (bankQuery.data ?? []).filter((item) =>
        `${item.bank_name} ${item.account_number} ${item.account_name} ${item.branch_name ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search, bankQuery.data],
  );

  const columns = useMemo<ColumnDef<BankAccountMaster>[]>(
    () => [
      {
        accessorKey: "bank_name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Bank Name" />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() => {
              setEditing(row.original);
            }}
          >
            <span className="font-semibold">{row.original.bank_name}</span>
          </CellAction>
        ),
      },
      {
        accessorKey: "account_number",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Account Number" />
        ),
        cell: ({ row }) => (
          <span className="font-mono">{row.original.account_number}</span>
        ),
      },
      {
        accessorKey: "account_name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Account Name" />
        ),
        cell: ({ row }) => row.original.account_name,
      },
      {
        accessorKey: "branch_name",
        header: "Branch",
        cell: ({ row }) => row.original.branch_name || "—",
      },
      {
        accessorKey: "gl_account_id",
        header: "GL Account",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.gl_account_id || "—"}
          </span>
        ),
      },
      {
        accessorKey: "currency_code",
        header: "Currency",
        cell: ({ row }) => (
          <Badge data-standard-chip="" variant="outline" size="sm">
            {row.original.currency_code}
          </Badge>
        ),
      },
      {
        accessorKey: "is_active",
        header: "Status",
        cell: ({ row }) => <StatusBadge active={row.original.is_active} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DataGridRowActions
            activity={{ id: row.original.id }}
            onDelete={() => setDeleting(row.original)}
          />
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const { gridRef, gridWidth, ...responsive } = useMasterGridLayout(columns, {
    grow: "account_name",
    widths: {
      bank_name: 150,
      account_number: 170,
      account_name: 180,
      branch_name: 150,
      gl_account_id: 150,
      currency_code: 100,
      is_active: 100,
      actions: 60,
    },
    secondary: ["branch_name", "gl_account_id", "currency_code"],
  });

  const table = useReactTable({
    data: rows,
    ...responsive,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ListPageShell
      title="Bank Accounts"
      description="Business unit bank accounts used for AP payments, AR receipts, and cash management"
      toolbar={
        <SearchInput
          defaultValue={search}
          onSearch={setSearch}
          onInputChange={setSearch}
        />
      }
      actions={
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus className="size-4" /> Add Bank Account
        </Button>
      }
    >
      <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-xs [&>svg]:shrink-0">
        <Landmark className="text-primary size-4" />
        <span className="font-medium">GL integration:</span>
        <span className="text-muted-foreground">
          Each bank account links to a Chart of Accounts control account for
          automatic journal posting on AP/AR settlement.
        </span>
      </div>
      {bankQuery.isError && (
        <ErrorState
          error={bankQuery.error}
          message="Unable to load bank accounts"
          onRetry={() => void bankQuery.refetch()}
        />
      )}
      <ConfigMasterGrid
        table={table}
        gridRef={gridRef}
        gridWidth={gridWidth}
        labels={{
          bank_name: "Bank Name",
          account_number: "Account Number",
          account_name: "Account Name",
          branch_name: "Branch",
          gl_account_id: "GL Account",
          currency_code: "Currency",
          is_active: "Status",
        }}
        titleColumn="bank_name"
        isLoading={bankQuery.isLoading}
      />
      <BankAccountDialog
        readOnly={!!editing && !canEdit}
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        saving={saving}
        glAccountCode={
          accountData?.data.find(
            (account) => account.id === editing?.gl_account_id,
          )?.code ??
          editing?.gl_account_id ??
          ""
        }
        onOpenChange={(open) => {
          if (!open) {
            setEditing(undefined);
          }
        }}
        onSave={async (value) => {
          setSaving(true);
          try {
            await saveBankAccount(value);
            toast.success(
              editing ? "Bank account updated" : "Bank account created",
            );
            setEditing(undefined);
          } catch (error) {
            setWarning(
              error instanceof Error
                ? error.message
                : "Unable to save bank account",
            );
          } finally {
            setSaving(false);
          }
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete bank account?"
        description={
          deleting
            ? `Delete ${deleting.bank_name} (${deleting.account_number})?`
            : undefined
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            if (!buCode) throw new Error("Select a business unit first");
            const res = await httpClient.delete(
              `${API_ENDPOINTS.GL_BANK_ACCOUNTS(buCode)}/${deleting.id}`,
            );
            if (!res.ok)
              throw await ApiError.from(res, "Unable to delete bank account");
            await queryClient.invalidateQueries({
              queryKey: ["accounting-master", "bank-accounts", buCode],
            });
            toast.success("Bank account deleted");
            setDeleting(null);
          } catch (error) {
            setDeleting(null);
            setWarning(
              error instanceof Error
                ? error.message
                : "Unable to delete bank account",
            );
          }
        }}
      />
      <WarningDialog
        open={!!warning}
        title="Action blocked"
        description={warning}
        onConfirm={() => setWarning("")}
      />
    </ListPageShell>
  );
}

function BankAccountDialog({
  open,
  readOnly = false,
  item,
  saving,
  glAccountCode,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  readOnly?: boolean;
  item: BankAccountMaster | null;
  saving: boolean;
  glAccountCode: string;
  onOpenChange: (open: boolean) => void;
  onSave: (value: Omit<BankAccountMaster, "id" | "doc_version">) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [bankName, setBankName] = useState(item?.bank_name ?? "");
  const [accountNumber, setAccountNumber] = useState(
    item?.account_number ?? "",
  );
  const [accountName, setAccountName] = useState(item?.account_name ?? "");
  const [branchName, setBranchName] = useState(item?.branch_name ?? "");
  const [selectedGlAccountId, setGlAccountId] = useState<string | null>(null);
  const glAccountId = selectedGlAccountId ?? glAccountCode;
  const [currencyCode, setCurrencyCode] = useState(
    item?.currency_code ?? "THB",
  );
  const [active, setActive] = useState(item?.is_active ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Bank Account Detail"
              : item
                ? "Edit Bank Account"
                : "Add Bank Account"}
          </DialogTitle>
          <DialogDescription>
            Account details for financial operations and GL control mapping.
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={readOnly}
          className="grid gap-4 py-2 @md:grid-cols-2"
        >
          <Field>
            <FieldLabel htmlFor="bank-code" required>
              Code
            </FieldLabel>
            <FieldInput
              id="bank-code"
              value={code}
              disabled={!!item}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
            />
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="bank-name" required>
              Bank Name
            </FieldLabel>
            <FieldInput
              id="bank-name"
              value={bankName}
              placeholder="e.g. Kasikorn Bank (KBANK)"
              onChange={(e) => setBankName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bank-acc-no" required>
              Account Number
            </FieldLabel>
            <FieldInput
              id="bank-acc-no"
              value={accountNumber}
              placeholder="e.g. 123-4-56789-0"
              onChange={(e) => setAccountNumber(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bank-curr" required>
              Currency
            </FieldLabel>
            <FieldInput
              id="bank-curr"
              value={currencyCode}
              maxLength={3}
              placeholder="THB"
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="bank-acc-name" required>
              Account Name
            </FieldLabel>
            <FieldInput
              id="bank-acc-name"
              value={accountName}
              placeholder="e.g. Company Limited"
              onChange={(e) => setAccountName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bank-branch">Branch Name</FieldLabel>
            <FieldInput
              id="bank-branch"
              value={branchName}
              placeholder="e.g. Silom Complex"
              onChange={(e) => setBranchName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bank-gl">GL Account Code</FieldLabel>
            <LookupChartOfAccount
              value={glAccountId}
              category="asset"
              placeholder="Select asset GL account"
              onValueChange={setGlAccountId}
            />
          </Field>
          <div className="@md:col-span-2">
            <StatusSwitch
              id="bank-account-active"
              checked={active}
              onCheckedChange={setActive}
            />
          </div>
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button
              disabled={
                saving ||
                !code.trim() ||
                !bankName.trim() ||
                !accountNumber.trim() ||
                !accountName.trim() ||
                !glAccountId ||
                !currencyCode
              }
              onClick={() =>
                onSave({
                  code,
                  bank_name: bankName,
                  account_number: accountNumber,
                  account_name: accountName,
                  branch_name: branchName || null,
                  gl_account_id: glAccountId || null,
                  currency_code: currencyCode,
                  is_active: active,
                })
              }
            >
              {item ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
