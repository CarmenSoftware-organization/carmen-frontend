import { useAccountingConfigEdit } from "../shared/use-accounting-config-edit";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Bookmark, Plus } from "lucide-react";
import { toast } from "sonner";
import SearchInput from "@/components/search-input";
import EmptyComponent from "@/components/empty-component";
import DisplayTemplate from "@/components/display-template";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import { CellAction } from "@/components/ui/cell-action";
import {
  DataGrid,
  DataGridContainer,
} from "@/components/ui/data-grid/data-grid";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
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
import { Switch } from "@/components/ui/switch";
import { WarningDialog } from "@/components/ui/warning-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type { JvPrefixMaster } from "@/types/accounting-master";

export default function JvPrefixPage() {
  "use no memo";
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const prefixQuery = useQuery({
    queryKey: ["accounting-master", "jv-prefixes", buCode],
    enabled: !!buCode,
    queryFn: async (): Promise<JvPrefixMaster[]> => {
      const res = await httpClient.get(API_ENDPOINTS.GL_JV_PREFIXES(buCode!));
      if (!res.ok) throw await ApiError.from(res, "Unable to load JV prefixes");
      const json = await res.json();
      return Array.isArray(json) ? json : (json.data ?? []);
    },
  });
  const [search, setSearch] = useState("");
  const canEdit = useAccountingConfigEdit("accounting.config.gl");
  const [editing, setEditing] = useState<JvPrefixMaster | null | undefined>();
  const [deleting, setDeleting] = useState<JvPrefixMaster | null>(null);
  const [warning, setWarning] = useState("");

  const rows = useMemo(
    () =>
      (prefixQuery.data ?? []).filter((item) =>
        `${item.code} ${item.description} ${item.description_local ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase()),
      ),
    [search, prefixQuery.data],
  );

  const columns = useMemo<ColumnDef<JvPrefixMaster>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Prefix Code" />
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
          <DataGridColumnHeader column={column} title="Description (EN)" />
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
        accessorKey: "description_local",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Description (TH)" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.description_local || "—"}
          </span>
        ),
      },
      {
        accessorKey: "is_default",
        header: "Default",
        cell: ({ row }) =>
          row.original.is_default ? (
            <Badge
              data-standard-chip=""
              variant="outline"
              size="sm"
              className="border-primary text-primary"
            >
              Default
            </Badge>
          ) : null,
      },
      {
        accessorKey: "is_system",
        header: "System",
        cell: ({ row }) =>
          row.original.is_system ? (
            <Badge data-standard-chip="" variant="outline" size="sm">
              System
            </Badge>
          ) : null,
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
            onDelete={
              row.original.is_system
                ? undefined
                : () => setDeleting(row.original)
            }
          />
        ),
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <DisplayTemplate
      title="Journal Voucher Prefixes"
      description="Document prefix codes for classifying Journal Vouchers (AJ, PV, RV, etc.)"
      toolbar={
        <SearchInput
          defaultValue={search}
          onSearch={setSearch}
          onInputChange={setSearch}
        />
      }
      actions={
        <Button size="sm" onClick={() => setEditing(null)}>
          <Plus className="size-4" /> Add JV Prefix
        </Button>
      }
    >
      <div className="bg-muted/30 flex items-center gap-2 rounded-md px-3 py-2 text-xs">
        <Bookmark className="text-primary size-4" />
        <span className="font-medium">System prefixes:</span>
        <span className="text-muted-foreground">
          Prefixes flagged as System cannot be deleted because they are used by
          auto-generated transactions.
        </span>
      </div>
      <DataGrid
        table={table}
        recordCount={rows.length}
        emptyMessage={<EmptyComponent />}
        tableLayout={{ width: "auto", headerSticky: true }}
        tableClassNames={{ bodyRow: "h-10" }}
      >
        <DataGridContainer scroll className="max-h-[calc(100vh-14rem)]">
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
      {prefixQuery.isError && (
        <ErrorState
          error={prefixQuery.error}
          message="Unable to load JV prefixes"
          onRetry={() => void prefixQuery.refetch()}
        />
      )}
      <JvPrefixDialog
        readOnly={!!editing && !canEdit}
        key={editing?.id ?? "new"}
        open={editing !== undefined}
        item={editing ?? null}
        onOpenChange={(open) => {
          if (!open) {
            setEditing(undefined);
          }
        }}
        onSave={async (value) => {
          try {
            if (!buCode) throw new Error("Select a business unit first");
            const endpoint = API_ENDPOINTS.GL_JV_PREFIXES(buCode);
            const res = editing
              ? await httpClient.put(`${endpoint}/${editing.id}`, {
                  description: value.description,
                  description_local: value.description_local,
                  is_default: value.is_default,
                  is_active: value.is_active,
                  doc_version: editing.doc_version,
                })
              : await httpClient.post(endpoint, value);
            if (!res.ok)
              throw await ApiError.from(res, "Unable to save JV prefix");
            await queryClient.invalidateQueries({
              queryKey: ["accounting-master", "jv-prefixes", buCode],
            });
            toast.success(editing ? "JV Prefix updated" : "JV Prefix created");
            setEditing(undefined);
          } catch (error) {
            setWarning(
              error instanceof Error
                ? error.message
                : "Unable to save JV prefix",
            );
          }
        }}
      />
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete JV prefix?"
        description={
          deleting
            ? `Delete ${deleting.code} — ${deleting.description}?`
            : undefined
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            if (!buCode) throw new Error("Select a business unit first");
            const res = await httpClient.delete(
              `${API_ENDPOINTS.GL_JV_PREFIXES(buCode)}/${deleting.id}`,
            );
            if (!res.ok)
              throw await ApiError.from(res, "Unable to delete JV prefix");
            await queryClient.invalidateQueries({
              queryKey: ["accounting-master", "jv-prefixes", buCode],
            });
            toast.success("JV prefix deleted");
            setDeleting(null);
          } catch (error) {
            setDeleting(null);
            setWarning(
              error instanceof Error
                ? error.message
                : "Unable to delete JV prefix",
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
    </DisplayTemplate>
  );
}

function JvPrefixDialog({
  open,
  readOnly = false,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  readOnly?: boolean;
  item: JvPrefixMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    value: Omit<JvPrefixMaster, "id" | "is_system" | "doc_version">,
  ) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [descriptionLocal, setDescriptionLocal] = useState(
    item?.description_local ?? "",
  );
  const [isDefault, setIsDefault] = useState(item?.is_default ?? false);
  const [active, setActive] = useState(item?.is_active ?? true);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "JV Prefix Detail"
              : item
                ? "Edit JV Prefix"
                : "Add JV Prefix"}
          </DialogTitle>
          <DialogDescription>
            Prefix code used as running number prefix in Journal Vouchers.
          </DialogDescription>
        </DialogHeader>
        <fieldset disabled={readOnly} className="grid gap-4 py-2">
          <Field>
            <FieldLabel htmlFor="jv-code" required>
              Prefix Code (2-10 Chars)
            </FieldLabel>
            <FieldInput
              id="jv-code"
              value={code}
              disabled={!!item}
              maxLength={10}
              placeholder="e.g. AJ, RV, PV"
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="jv-desc" required>
              Description (EN)
            </FieldLabel>
            <FieldInput
              id="jv-desc"
              value={description}
              maxLength={100}
              placeholder="e.g. Adjustment Voucher"
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="jv-desc-local">Description (TH)</FieldLabel>
            <FieldInput
              id="jv-desc-local"
              value={descriptionLocal}
              maxLength={100}
              placeholder="e.g. ใบสำคัญปรับปรุง"
              onChange={(e) => setDescriptionLocal(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between rounded-md border p-2.5">
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">Default Prefix</p>
              <p className="text-muted-foreground text-xs">
                Set as default running prefix for Journal Vouchers
              </p>
            </div>
            <Switch
              id="jv-default"
              checked={isDefault}
              onCheckedChange={setIsDefault}
              aria-label="Default Prefix"
            />
          </div>
          <StatusSwitch
            id="jv-active"
            checked={active}
            onCheckedChange={setActive}
          />
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
                  description_local: descriptionLocal || null,
                  is_default: isDefault,
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
