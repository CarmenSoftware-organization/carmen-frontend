import { ConfigMasterGrid } from "../shared/config-master-grid";
import { useMasterGridLayout } from "../shared/use-config-list-table";
import { useAccountingConfigEdit } from "../shared/use-accounting-config-edit";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Building2, Plus } from "lucide-react";
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
import {
  type AssetCategoryMaster,
  useAccountingMasterMock,
} from "../accounting-master-mock";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { indexColumn } from "@/components/ui/data-grid/columns";

export default function AssetCategoryPage() {
  "use no memo";
  const store = useAccountingMasterMock();
  const [search, setSearch] = useState("");
  const canEdit = useAccountingConfigEdit("accounting.config.asset");
  const [editing, setEditing] = useState<
    AssetCategoryMaster | null | undefined
  >();
  const [deleting, setDeleting] = useState<AssetCategoryMaster | null>(null);

  const rows = useMemo(
    () =>
      store.assetCategories.filter((item) =>
        `${item.code} ${item.description} ${item.asset_account_id ?? ""} ${item.accum_dep_account_id ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search, store.assetCategories],
  );

  const columns = useMemo<ColumnDef<AssetCategoryMaster>[]>(
    () => [
      indexColumn<AssetCategoryMaster>(),
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Category Code" />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() => {
              setEditing(row.original);
            }}
          >
            <span className="font-mono font-semibold">{row.original.code}</span>
          </CellAction>
        ),
      },
      {
        accessorKey: "description",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Description" />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() => {
              setEditing(row.original);
            }}
          >
            {row.original.description}
          </CellAction>
        ),
      },
      {
        accessorKey: "useful_life_years",
        header: "Useful Life",
        cell: ({ row }) => (
          <Badge data-standard-chip="" variant="outline" size="sm">
            {row.original.useful_life_years} years
          </Badge>
        ),
      },
      {
        accessorKey: "asset_account_id",
        header: "Asset Cost A/C",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.asset_account_id || "—"}
          </span>
        ),
      },
      {
        accessorKey: "accum_dep_account_id",
        header: "Accum Dep A/C",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.accum_dep_account_id || "—"}
          </span>
        ),
      },
      {
        accessorKey: "dep_expense_account_id",
        header: "Dep Expense A/C",
        cell: ({ row }) => (
          <span className="font-mono text-xs">
            {row.original.dep_expense_account_id || "—"}
          </span>
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
            activity={{
              id: row.original.id,
              disabled: true,
              disabledTitle: "Activity is unavailable for mock data",
            }}
            onDelete={() => setDeleting(row.original)}
          />
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const { gridRef, gridWidth, ...responsive } = useMasterGridLayout(columns, {
    grow: "description",
    widths: {
      code: 120,
      description: 180,
      useful_life_years: 110,
      asset_account_id: 150,
      accum_dep_account_id: 150,
      dep_expense_account_id: 150,
      is_active: 100,
      actions: 60,
    },
    secondary: [
      "dep_expense_account_id",
      "accum_dep_account_id",
      "asset_account_id",
    ],
  });

  const table = useReactTable({
    data: rows,
    ...responsive,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ListPageShell
      title="Asset Categories"
      mock
      description="Fixed asset categories, standard useful life years, and GL depreciation account legs"
      toolbar={
        <SearchInput
          defaultValue={search}
          onSearch={setSearch}
          onInputChange={setSearch}
        />
      }
      actions={
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus className="size-4" /> Add Asset Category
        </Button>
      }
    >
      <div className="bg-muted/30 flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-xs [&>svg]:shrink-0">
        <Building2 className="text-primary size-4" />
        <span className="font-medium">Three-leg accounting mapping:</span>
        <span className="text-muted-foreground">
          Each asset category specifies the Asset Cost (BS), Accumulated
          Depreciation (contra-asset BS), and Depreciation Expense (P&L)
          accounts.
        </span>
      </div>
      <ConfigMasterGrid
        table={table}
        gridRef={gridRef}
        gridWidth={gridWidth}
        labels={{
          code: "Category Code",
          description: "Description",
          useful_life_years: "Useful Life",
          asset_account_id: "Asset Cost A/C",
          accum_dep_account_id: "Accum Dep A/C",
          dep_expense_account_id: "Dep Expense A/C",
          is_active: "Status",
        }}
        titleColumn="code"
        isLoading={false}
      />
      <AssetCategoryDialog
        readOnly={!!editing && !canEdit}
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(undefined);
          }
        }}
        onSave={(value) => {
          store.saveAssetCategory(value, editing?.id);
          toast.success(
            editing ? "Asset category updated" : "Asset category created",
          );
          setEditing(undefined);
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete asset category?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={() => {
          if (!deleting) return;
          store.deleteAssetCategory(deleting);
          toast.success("Asset category deleted");
          setDeleting(null);
        }}
      />
    </ListPageShell>
  );
}

function AssetCategoryDialog({
  open,
  readOnly = false,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  readOnly?: boolean;
  item: AssetCategoryMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (value: Omit<AssetCategoryMaster, "id" | "doc_version">) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [usefulLife, setUsefulLife] = useState(item?.useful_life_years ?? 5);
  const [assetAcc, setAssetAcc] = useState(item?.asset_account_id ?? "");
  const [accumDepAcc, setAccumDepAcc] = useState(
    item?.accum_dep_account_id ?? "",
  );
  const [depExpAcc, setDepExpAcc] = useState(
    item?.dep_expense_account_id ?? "",
  );
  const [active, setActive] = useState(item?.is_active ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Asset Category Detail"
              : item
                ? "Edit Asset Category"
                : "Add Asset Category"}
          </DialogTitle>
          <DialogDescription>
            Configuration for asset classification, lifespan, and three-leg GL
            posting.
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={readOnly}
          className="grid gap-4 py-2 @md:grid-cols-2"
        >
          <Field>
            <FieldLabel htmlFor="ast-code" required>
              Category Code
            </FieldLabel>
            <FieldInput
              id="ast-code"
              value={code}
              disabled={!!item}
              maxLength={20}
              placeholder="e.g. COMP, VEH, BLDG"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ast-life" required>
              Useful Life (Years)
            </FieldLabel>
            <FieldInput
              id="ast-life"
              type="number"
              min={1}
              value={usefulLife}
              onChange={(e) =>
                setUsefulLife(Math.max(1, Number(e.target.value) || 1))
              }
            />
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="ast-desc" required>
              Description
            </FieldLabel>
            <FieldInput
              id="ast-desc"
              value={description}
              maxLength={100}
              placeholder="e.g. Computer Hardware & Software"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field className="@md:col-span-2">
            <FieldLabel htmlFor="ast-leg1">
              Asset Cost Account (Balance Sheet Asset)
            </FieldLabel>
            <LookupChartOfAccount
              value={assetAcc}
              category="asset"
              placeholder="Select asset cost account"
              onValueChange={setAssetAcc}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ast-leg2">Accumulated Dep A/C</FieldLabel>
            <LookupChartOfAccount
              value={accumDepAcc}
              category="asset"
              placeholder="Select accumulated dep account"
              onValueChange={setAccumDepAcc}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="ast-leg3">Dep Expense A/C</FieldLabel>
            <LookupChartOfAccount
              value={depExpAcc}
              category="expense"
              placeholder="Select depreciation expense account"
              onValueChange={setDepExpAcc}
            />
          </Field>
          <div className="@md:col-span-2">
            <StatusSwitch
              id="asset-category-active"
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
              disabled={!code.trim() || !description.trim()}
              onClick={() =>
                onSave({
                  code,
                  description,
                  useful_life_years: usefulLife,
                  asset_account_id: assetAcc || null,
                  accum_dep_account_id: accumDepAcc || null,
                  dep_expense_account_id: depExpAcc || null,
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
