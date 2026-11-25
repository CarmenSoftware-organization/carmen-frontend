import { ConfigMasterGrid } from "../shared/config-master-grid";
import { useMasterGridLayout } from "../shared/use-config-list-table";
import { useAccountingConfigEdit } from "../shared/use-accounting-config-edit";
import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import { DIMENSION_DATA_TYPES } from "./dimension-data-types";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus, ListTree } from "lucide-react";
import { toast } from "sonner";
import { ListToolbar } from "@/components/list-filter/list-toolbar";
import { SaveViewDialog } from "@/components/list-filter/save-view-dialog";
import { useListFilters } from "@/hooks/use-list-filters";
import { LIST_PAGE_KEYS } from "@/constant/list-page-keys";
import {
  STATUS_FILTER_FIELDS,
  activeFromFilter,
} from "../shared/status-list-filter";
import { ListPageShell } from "@/components/share/list-page-shell";
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
import { WarningDialog } from "@/components/ui/warning-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type {
  DimensionMaster,
  DimensionValueMaster,
} from "@/types/accounting-master";

import { saveDimensionRecord } from "./save-dimension-record";
import { DimensionDialog } from "./dimension-dialog";

export default function DimensionPage() {
  "use no memo";
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const dimensionQuery = useGlDimensions();
  const valueQuery = useGlDimensionValues();
  const dimensions = useMemo(
    () =>
      (dimensionQuery.data ?? []).map((dimension) => ({
        ...dimension,
        values: (valueQuery.data ?? []).filter(
          (value) => value.dimension_id === dimension.id,
        ),
      })),
    [dimensionQuery.data, valueQuery.data],
  );
  const [search, setSearch] = useState("");
  const [saveViewDialogOpen, setSaveViewDialogOpen] = useState(false);
  const lf = useListFilters({
    pageKey: LIST_PAGE_KEYS.DIMENSION,
    fields: STATUS_FILTER_FIELDS,
  });
  const activeFilter = activeFromFilter(lf.values.filter);
  const canEdit = useAccountingConfigEdit("configuration.dimension");
  const [editing, setEditing] = useState<DimensionMaster | null | undefined>();
  const [viewingValuesId, setViewingValuesId] = useState<string | null>(null);
  const viewingValues =
    dimensions.find((dimension) => dimension.id === viewingValuesId) ?? null;
  const [deleting, setDeleting] = useState<DimensionMaster | null>(null);
  const [warning, setWarning] = useState("");

  const mutateValue = async (
    request: () => Promise<Response>,
    success: string,
  ) => {
    try {
      if (!buCode) throw new Error("Select a business unit first");
      const res = await request();
      if (!res.ok)
        throw await ApiError.from(res, "Unable to save dimension value");
      await queryClient.invalidateQueries({
        queryKey: ["accounting-master", "dimension-values", buCode],
      });
      toast.success(success);
      return true;
    } catch (error) {
      setWarning(
        error instanceof Error
          ? error.message
          : "Unable to save dimension value",
      );
      return false;
    }
  };

  const rows = useMemo(
    () =>
      dimensions
        .filter((item) =>
          `${item.code} ${item.name} ${item.name_local ?? ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .filter(
          (item) =>
            activeFilter === undefined || item.is_active === activeFilter,
        )
        .sort((a, b) => a.code.localeCompare(b.code)),
    [search, activeFilter, dimensions],
  );

  const columns = useMemo<ColumnDef<DimensionMaster>[]>(
    () => [
      {
        id: "index",
        header: "#",
        cell: ({ row }) => row.index + 1,
        enableSorting: false,
        enableHiding: false,
        size: 60,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Code" />
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
        accessorKey: "name",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Dimension Name (EN)" />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() => {
              setEditing(row.original);
            }}
          >
            {row.original.name}
          </CellAction>
        ),
      },
      {
        accessorKey: "name_local",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Dimension Name (TH)" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.name_local || "—"}
          </span>
        ),
      },
      {
        accessorKey: "data_type",
        header: "Data Type",
        cell: ({ row }) => {
          const type = DIMENSION_DATA_TYPES.find(
            (t) => t.value === (row.original.data_type ?? "lookup"),
          );
          return (
            <span className="block truncate" title={type?.label}>
              {type?.short}
            </span>
          );
        },
      },
      {
        id: "values_count",
        header: "List Master Items",
        cell: ({ row }) =>
          row.original.data_type && row.original.data_type !== "lookup" ? (
            "—"
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => setViewingValuesId(row.original.id)}
            >
              <ListTree className="mr-1 size-3.5" />
              {(row.original.values ?? []).length} values
            </Button>
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
    grow: "name",
    widths: {
      index: 60,
      code: 100,
      name: 180,
      name_local: 180,
      data_type: 120,
      values_count: 150,
      is_active: 100,
      actions: 60,
    },
    secondary: ["name_local", "data_type", "index"],
  });

  const table = useReactTable({
    data: rows,
    ...responsive,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <ListPageShell
      title="Dimensions"
      description="Manage GL dimensions and values used by Journal Vouchers"
      toolbar={
        <ListToolbar
          variant="row"
          search={search}
          onSearch={setSearch}
          lf={lf}
          fields={STATUS_FILTER_FIELDS}
          onSaveViewClick={() => setSaveViewDialogOpen(true)}
        />
      }
      actions={
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
          }}
        >
          <Plus className="size-4" /> Add Dimension
        </Button>
      }
    >
      <ConfigMasterGrid
        table={table}
        gridRef={gridRef}
        gridWidth={gridWidth}
        labels={{
          code: "Code",
          name: "Dimension Name (EN)",
          name_local: "Dimension Name (TH)",
          data_type: "Data Type",
          values_count: "List Master Items",
          is_active: "Status",
        }}
        titleColumn="code"
        isLoading={dimensionQuery.isLoading || valueQuery.isLoading}
      />
      {(dimensionQuery.isError || valueQuery.isError) && (
        <ErrorState
          error={dimensionQuery.error ?? valueQuery.error}
          message="Unable to load dimensions"
          onRetry={() => {
            void dimensionQuery.refetch();
            void valueQuery.refetch();
          }}
        />
      )}
      {editing !== undefined && (
        <DimensionDialog
          readOnly={!!editing && !canEdit}
          key={editing?.id ?? "new"}
          open={editing !== undefined}
          item={editing ?? null}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(undefined);
            }
          }}
          onSave={async (value, current) => {
            if (!buCode) throw new Error("Select a business unit first");
            const { code: _code, ...changes } = value;
            const saved = await saveDimensionRecord(
              API_ENDPOINTS.DIMENSIONS(buCode),
              current ? changes : value,
              current,
            );
            return { ...value, ...saved };
          }}
        />
      )}
      {viewingValues && (
        <DimensionValuesDialog
          open={!!viewingValues}
          dimension={viewingValues}
          onOpenChange={(open) => !open && setViewingValuesId(null)}
          onAddValue={async (val) => {
            const currentVals = viewingValues.values ?? [];
            if (
              currentVals.some(
                (v) => v.code.toUpperCase() === val.code.toUpperCase(),
              )
            ) {
              toast.error(`Value ${val.code} already exists.`);
              return false;
            }
            return mutateValue(
              () =>
                httpClient.post(API_ENDPOINTS.DIMENSION_VALUES(buCode!), {
                  dimension_id: viewingValues.id,
                  ...val,
                }),
              "Dimension value added",
            );
          }}
          onUpdateValue={(val) => {
            return mutateValue(
              () =>
                httpClient.put(
                  `${API_ENDPOINTS.DIMENSION_VALUES(buCode!)}/${val.id}`,
                  {
                    name: val.name,
                    name_local: val.name_local,
                    is_active: val.is_active,
                    doc_version: val.doc_version,
                  },
                ),
              "Dimension value updated",
            );
          }}
          onDeleteValue={(id) => {
            return mutateValue(
              () =>
                httpClient.delete(
                  `${API_ENDPOINTS.DIMENSION_VALUES(buCode!)}/${id}`,
                ),
              "Dimension value removed",
            );
          }}
        />
      )}
      <DeleteDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete dimension?"
        description={
          deleting ? `Delete ${deleting.code} — ${deleting.name}?` : undefined
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            if (!buCode) throw new Error("Select a business unit first");
            const res = await httpClient.delete(
              `${API_ENDPOINTS.DIMENSIONS(buCode)}/${deleting.id}`,
            );
            if (!res.ok)
              throw await ApiError.from(res, "Unable to delete dimension");
            await queryClient.invalidateQueries({
              queryKey: ["accounting-master", "dimensions", buCode],
            });
            toast.success("Dimension deleted");
            setDeleting(null);
          } catch (error) {
            setDeleting(null);
            setWarning(
              error instanceof Error
                ? error.message
                : "Unable to delete dimension",
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
      <SaveViewDialog
        open={saveViewDialogOpen}
        onOpenChange={setSaveViewDialogOpen}
        canManageBu={lf.view.canManageBu}
        existingNames={lf.view.existingNames}
        onSave={lf.view.saveOrUpdate}
      />
    </ListPageShell>
  );
}

function DimensionValuesDialog({
  open,
  dimension,
  onOpenChange,
  onAddValue,
  onUpdateValue,
  onDeleteValue,
}: {
  open: boolean;
  dimension: DimensionMaster;
  onOpenChange: (open: boolean) => void;
  onAddValue: (
    val: Omit<DimensionValueMaster, "id" | "dimension_id" | "doc_version">,
  ) => Promise<boolean>;
  onUpdateValue: (val: DimensionValueMaster) => Promise<boolean>;
  onDeleteValue: (id: string) => Promise<boolean>;
}) {
  const canEdit = useAccountingConfigEdit("configuration.dimension");
  const [valCode, setValCode] = useState("");
  const [valName, setValName] = useState("");
  const [valNameLocal, setValNameLocal] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingValue, setDeletingValue] =
    useState<DimensionValueMaster | null>(null);
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editNameLocal, setEditNameLocal] = useState("");
  const values = dimension.values ?? [];

  const startEdit = (v: DimensionValueMaster) => {
    setEditingId(v.id);
    setEditCode(v.code);
    setEditName(v.name);
    setEditNameLocal(v.name_local ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (original: DimensionValueMaster) => {
    if (!editCode.trim() || !editName.trim()) {
      toast.error("Code and Name (EN) are required");
      return;
    }
    const saved = await onUpdateValue({
      ...original,
      code: editCode.trim().toUpperCase(),
      name: editName.trim(),
      name_local: editNameLocal.trim() || null,
    });
    if (saved) setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            List Master Items for {dimension.name} ({dimension.code})
          </DialogTitle>
          <DialogDescription>
            Manage allowed values for this dimension.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {/* Add form */}
          {canEdit && (
            <div className="bg-muted/30 grid grid-cols-1 items-end gap-2 rounded-md p-3 @xl:grid-cols-4">
              <Field>
                <FieldLabel className="text-xs" required>
                  Code
                </FieldLabel>
                <FieldInput
                  value={valCode}
                  placeholder="e.g. CORP"
                  className="h-8 text-xs"
                  onChange={(e) => setValCode(e.target.value.toUpperCase())}
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs" required>
                  Name (EN)
                </FieldLabel>
                <FieldInput
                  value={valName}
                  placeholder="e.g. Corporate"
                  className="h-8 text-xs"
                  onChange={(e) => setValName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs">Name (TH)</FieldLabel>
                <FieldInput
                  value={valNameLocal}
                  placeholder="e.g. องค์กร"
                  className="h-8 text-xs"
                  onChange={(e) => setValNameLocal(e.target.value)}
                />
              </Field>
              <Button
                size="sm"
                className="h-8"
                disabled={!valCode.trim() || !valName.trim()}
                onClick={async () => {
                  const saved = await onAddValue({
                    code: valCode.trim().toUpperCase(),
                    name: valName.trim(),
                    name_local: valNameLocal.trim() || null,
                    is_active: true,
                  });
                  if (saved) {
                    setValCode("");
                    setValName("");
                    setValNameLocal("");
                  }
                }}
              >
                <Plus className="mr-1 size-3.5" /> Add Value
              </Button>
            </div>
          )}

          {/* Table */}
          <div className="max-h-60 overflow-hidden overflow-y-auto rounded-md border">
            <table className="block w-full text-xs @xl:table">
              <thead className="bg-muted/50 sr-only border-b @xl:not-sr-only @xl:table-header-group">
                <tr>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name (EN)</th>
                  <th className="p-2 text-left">Name (TH)</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="block divide-y @xl:table-row-group">
                {values.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="text-muted-foreground p-4 text-center"
                    >
                      No list master items defined yet.
                    </td>
                  </tr>
                ) : (
                  values.map((v) => {
                    const isEditing = editingId === v.id;
                    return (
                      <tr
                        key={v.id}
                        className={`block space-y-2 p-3 @xl:table-row @xl:space-y-0 @xl:p-0 ${isEditing ? "bg-muted/40" : ""}`}
                      >
                        {isEditing ? (
                          <>
                            <td className="block p-2 @xl:table-cell">
                              <FieldInput
                                value={editCode}
                                disabled
                                className="h-7 font-mono text-xs font-medium"
                                onChange={(e) =>
                                  setEditCode(e.target.value.toUpperCase())
                                }
                              />
                            </td>
                            <td className="block p-2 @xl:table-cell">
                              <FieldInput
                                value={editName}
                                className="h-7 text-xs"
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </td>
                            <td className="block p-2 @xl:table-cell">
                              <FieldInput
                                value={editNameLocal}
                                placeholder="TH (optional)"
                                className="h-7 text-xs"
                                onChange={(e) =>
                                  setEditNameLocal(e.target.value)
                                }
                              />
                            </td>

                            <td className="block p-2 text-right @xl:table-cell">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  className="h-8 px-2 text-xs"
                                  onClick={() => void saveEdit(v)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-xs"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td
                              data-label="Code"
                              className="before:text-muted-foreground block p-2 font-mono font-medium before:mr-2 before:content-[attr(data-label)] @xl:table-cell @xl:before:hidden"
                            >
                              {canEdit ? (
                                <CellAction onClick={() => startEdit(v)}>
                                  {v.code}
                                </CellAction>
                              ) : (
                                v.code
                              )}
                            </td>
                            <td className="block p-2 @xl:table-cell">
                              {canEdit ? (
                                <CellAction onClick={() => startEdit(v)}>
                                  {v.name}
                                </CellAction>
                              ) : (
                                v.name
                              )}
                            </td>
                            <td
                              data-label="Name (TH)"
                              className="text-muted-foreground block p-2 before:mr-2 before:content-[attr(data-label)] @xl:table-cell @xl:before:hidden"
                            >
                              {v.name_local || "—"}
                            </td>

                            <td className="block p-2 text-right @xl:table-cell">
                              <DataGridRowActions
                                activity={{ id: v.id, label: v.code }}
                                onDelete={
                                  canEdit
                                    ? () => setDeletingValue(v)
                                    : undefined
                                }
                              />
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
      <DeleteDialog
        open={!!deletingValue}
        onOpenChange={(open) => !open && setDeletingValue(null)}
        title="Delete dimension value?"
        description={
          deletingValue
            ? `Delete ${deletingValue.code} — ${deletingValue.name}?`
            : undefined
        }
        onConfirm={async () => {
          if (deletingValue && (await onDeleteValue(deletingValue.id)))
            setDeletingValue(null);
        }}
      />
    </Dialog>
  );
}
