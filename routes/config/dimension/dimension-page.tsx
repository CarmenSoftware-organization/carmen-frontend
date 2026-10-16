import {
  useGlDimensions,
  useGlDimensionValues,
} from "@/hooks/use-gl-dimensions";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  DIMENSION_DATA_TYPES,
  DIMENSION_DATE_FORMATS,
} from "./dimension-data-types";
import { StatusBadge } from "@/components/ui/status-badge";
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { Plus, ListTree, Trash2 } from "lucide-react";
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
import { StatusFilter } from "@/components/ui/status-filter";
import { WarningDialog } from "@/components/ui/warning-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type {
  DimensionMaster,
  DimensionValueMaster,
  DimensionDataType,
  DimensionDateFormat,
} from "@/types/accounting-master";

import { saveDimensionRecord } from "./save-dimension-record";

export default function DimensionPage() {
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
  const [status, setStatus] = useState("");
  const [detailOnly, setDetailOnly] = useState(false);
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
        .filter((item) => !status || item.is_active === (status === "active"))
        .sort(
          (a, b) => a.sequence - b.sequence || a.code.localeCompare(b.code),
        ),
    [search, status, dimensions],
  );

  const columns = useMemo<ColumnDef<DimensionMaster>[]>(
    () => [
      {
        accessorKey: "code",
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title="Dimension Code" />
        ),
        cell: ({ row }) => (
          <CellAction
            onClick={() => {
              setDetailOnly(true);
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
              setDetailOnly(true);
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
        accessorKey: "sequence",
        header: "Sequence",
        cell: ({ row }) => (
          <Badge data-standard-chip="" variant="outline" size="sm">
            Seq {row.original.sequence}
          </Badge>
        ),
      },
      {
        accessorKey: "data_type",
        header: "Data Type",
        cell: ({ row }) =>
          DIMENSION_DATA_TYPES.find(
            (type) => type.value === (row.original.data_type ?? "lookup"),
          )?.label,
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

            onEdit={() => {
              setDetailOnly(false);
              setEditing(row.original);
            }}
            onDelete={() => setDeleting(row.original)}
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
      title="Dimensions"
      description="Manage GL dimensions and values used by Journal Vouchers"
      toolbar={
        <>
          <SearchInput
            defaultValue={search}
            onSearch={setSearch}
            onInputChange={setSearch}
          />
          <StatusFilter
            value={status}
            onChange={setStatus}
            defaultLabel="All statuses"
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </>
      }
      actions={
        <Button
          size="sm"
          onClick={() => {
            setDetailOnly(false);
            setEditing(null);
          }}
        >
          <Plus className="size-4" /> Add Dimension
        </Button>
      }
    >
      <DataGrid
        table={table}
        recordCount={rows.length}
        isLoading={dimensionQuery.isLoading || valueQuery.isLoading}
        emptyMessage={<EmptyComponent />}
        tableLayout={{ width: "auto", headerSticky: true }}
        tableClassNames={{ bodyRow: "h-10" }}
      >
        <DataGridContainer scroll className="max-h-[calc(100vh-14rem)]">
          <DataGridTable />
        </DataGridContainer>
      </DataGrid>
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
          readOnly={detailOnly}
          key={editing?.id ?? "new"}
          open={editing !== undefined}
          item={editing ?? null}
          onOpenChange={(open) => {
            if (!open) {
              setEditing(undefined);
              setDetailOnly(false);
            }
          }}
          onSave={async (value, current) => {
            if (!buCode) throw new Error("Select a business unit first");
            const { code: _code, ...changes } = value;
            const saved = await saveDimensionRecord(
              API_ENDPOINTS.GL_DIMENSIONS(buCode),
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
                httpClient.post(API_ENDPOINTS.GL_DIMENSION_VALUES(buCode!), {
                  gl_dimension_id: viewingValues.id,
                  ...val,
                }),
              "Dimension value added",
            );
          }}
          onUpdateValue={(val) => {
            return mutateValue(
              () =>
                httpClient.put(
                  `${API_ENDPOINTS.GL_DIMENSION_VALUES(buCode!)}/${val.id}`,
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
                  `${API_ENDPOINTS.GL_DIMENSION_VALUES(buCode!)}/${id}`,
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
              `${API_ENDPOINTS.GL_DIMENSIONS(buCode)}/${deleting.id}`,
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
    </DisplayTemplate>
  );
}

export function DimensionDialog({
  open,
  readOnly = false,
  item,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  readOnly?: boolean;
  item: DimensionMaster | null;
  onOpenChange: (open: boolean) => void;
  onSave: (
    value: Omit<DimensionMaster, "id" | "doc_version" | "values">,
    current: DimensionMaster | null,
  ) => Promise<DimensionMaster>;
}) {
  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const [savedItem, setSavedItem] = useState(item);
  const [subValues, setSubValues] = useState(() =>
    (item?.values ?? []).map((value) => ({
      ...value,
      key: value.id,
      dirty: false,
    })),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const initial = getDimensionFormDefaults(item);
  const [code, setCode] = useState(initial.code);
  const [name, setName] = useState(initial.name);
  const [nameLocal, setNameLocal] = useState(initial.name_local);
  const [sequence, setSequence] = useState(initial.sequence);
  const [active, setActive] = useState(initial.is_active);
  const [dataType, setDataType] = useState<DimensionDataType>(
    initial.data_type,
  );
  const [dateFormat, setDateFormat] = useState<DimensionDateFormat>(
    initial.date_format,
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {readOnly
              ? "Dimension Detail"
              : item
                ? "Edit Dimension"
                : "Add Dimension"}
          </DialogTitle>
          <DialogDescription>
            Defines a category of analytical tags (e.g., market segment,
            project).
          </DialogDescription>
        </DialogHeader>
        <fieldset
          disabled={readOnly || saving}
          className="grid gap-4 py-2 sm:grid-cols-2"
        >
          <Field>
            <FieldLabel htmlFor="dim-code" required>
              Dimension Code (lowercase/underscore)
            </FieldLabel>
            <FieldInput
              id="dim-code"
              value={code}
              disabled={!!savedItem}
              maxLength={20}
              placeholder="e.g. market, project, event"
              onChange={(e) =>
                setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
              }
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dim-name" required>
              Dimension Name (EN)
            </FieldLabel>
            <FieldInput
              id="dim-name"
              value={name}
              maxLength={100}
              placeholder="e.g. Market Segment"
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dim-name-local">
              Dimension Name (TH)
            </FieldLabel>
            <FieldInput
              id="dim-name-local"
              value={nameLocal}
              maxLength={100}
              placeholder="e.g. กลุ่มตลาด"
              onChange={(e) => setNameLocal(e.target.value)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="dim-seq" required>
              Sequence (1–10)
            </FieldLabel>
            <FieldInput
              id="dim-seq"
              type="number"
              min={1}
              max={10}
              value={sequence}
              onChange={(e) =>
                setSequence(
                  Math.max(1, Math.min(10, Number(e.target.value) || 1)),
                )
              }
            />
          </Field>
          <DimensionTypeFields
            dataType={dataType}
            dateFormat={dateFormat}
            disabled={readOnly || saving}
            onDataTypeChange={setDataType}
            onDateFormatChange={setDateFormat}
          />
          <StatusSwitch
            id="dim-active"
            checked={active}
            onCheckedChange={setActive}
          />
        </fieldset>
        {dataType === "lookup" && (
          <DimensionSubValues
            readOnly={readOnly || saving}
            savedId={savedItem?.id}
            subValues={subValues}
            setSubValues={setSubValues}
          />
        )}
        {saveError && (
          <p role="alert" className="text-destructive text-xs">
            {saveError}
          </p>
        )}
        <DialogFooter>
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly && (
            <Button
              disabled={saving || !code.trim() || !name.trim()}
              onClick={async () => {
                setSaving(true);
                setSaveError("");
                try {
                  await saveDimensionWithValues({
                    buCode,
                    values: {
                      code: code.trim(),
                      name: name.trim(),
                      name_local: nameLocal.trim() || null,
                      sequence,
                      is_active: active,
                      data_type: dataType,
                      ...(dataType === "date"
                        ? { date_format: dateFormat }
                        : {}),
                    },
                    savedItem,
                    subValues: dataType === "lookup" ? subValues : [],
                    onSave,
                    setSavedItem,
                    setSubValues,
                  });
                  toast.success("Dimension and sub-values saved");
                  onOpenChange(false);
                } catch (error) {
                  setSaveError(
                    error instanceof Error
                      ? error.message
                      : "Unable to save dimension. Retry Save.",
                  );
                } finally {
                  await Promise.all([
                    queryClient.invalidateQueries({
                      queryKey: ["accounting-master", "dimensions", buCode],
                    }),
                    queryClient.invalidateQueries({
                      queryKey: [
                        "accounting-master",
                        "dimension-values",
                        buCode,
                      ],
                    }),
                  ]);
                  setSaving(false);
                }
              }}
            >
              {saving ? "Saving…" : savedItem ? "Save" : "Create"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
      <DialogContent className="sm:max-w-2xl">
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
          <div className="bg-muted/30 grid grid-cols-1 items-end gap-2 rounded-md p-3 sm:grid-cols-4">
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

          {/* Table */}
          <div className="max-h-60 overflow-hidden overflow-y-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 border-b">
                <tr>
                  <th className="p-2 text-left">Code</th>
                  <th className="p-2 text-left">Name (EN)</th>
                  <th className="p-2 text-left">Name (TH)</th>
                  <th className="p-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
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
                        className={isEditing ? "bg-muted/40" : undefined}
                      >
                        {isEditing ? (
                          <>
                            <td className="p-2">
                              <FieldInput
                                value={editCode}
                                disabled
                                className="h-7 font-mono text-xs font-medium"
                                onChange={(e) =>
                                  setEditCode(e.target.value.toUpperCase())
                                }
                              />
                            </td>
                            <td className="p-2">
                              <FieldInput
                                value={editName}
                                className="h-7 text-xs"
                                onChange={(e) => setEditName(e.target.value)}
                              />
                            </td>
                            <td className="p-2">
                              <FieldInput
                                value={editNameLocal}
                                placeholder="TH (optional)"
                                className="h-7 text-xs"
                                onChange={(e) =>
                                  setEditNameLocal(e.target.value)
                                }
                              />
                            </td>

                            <td className="p-2 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  size="sm"
                                  className="h-6 px-2 text-xs"
                                  onClick={() => void saveEdit(v)}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-xs"
                                  onClick={cancelEdit}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-2 font-mono font-medium">
                              {v.code}
                            </td>
                            <td className="p-2">{v.name}</td>
                            <td className="text-muted-foreground p-2">
                              {v.name_local || "—"}
                            </td>

                            <td className="p-2 text-right">
                              <DataGridRowActions
                                activity={{ id: v.id, label: v.code }}
                                onEdit={() => startEdit(v)}
                                onDelete={() => setDeletingValue(v)}
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

interface DimensionValueDraft extends DimensionValueMaster {
  key: string;
  dirty: boolean;
}
function DimensionSubValues({
  readOnly,
  savedId,
  subValues,
  setSubValues,
}: {
  readOnly: boolean;
  savedId?: string;
  subValues: DimensionValueDraft[];
  setSubValues: React.Dispatch<React.SetStateAction<DimensionValueDraft[]>>;
}) {
  return (
    <fieldset disabled={readOnly} className="space-y-3 border-t pt-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">List Master Items</h3>
        {!readOnly && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSubValues((current) => [
                ...current,
                {
                  key: crypto.randomUUID(),
                  id: "",
                  dimension_id: savedId ?? "",
                  doc_version: 0,
                  code: "",
                  name: "",
                  name_local: "",
                  is_active: true,
                  dirty: true,
                },
              ])
            }
          >
            <Plus className="size-4" /> Add Value
          </Button>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Manage the values available for this dimension in Journal Vouchers.
      </p>
      {!subValues.length && (
        <p className="text-muted-foreground text-xs">
          No list master items defined yet.
        </p>
      )}
      {subValues.map((value, index) => {
        const update = (patch: Partial<DimensionValueMaster>) =>
          setSubValues((current) =>
            current.map((row) =>
              row.key === value.key ? { ...row, ...patch, dirty: true } : row,
            ),
          );
        return (
          <div
            key={value.key}
            className="grid gap-3 border-b pb-4 sm:grid-cols-[1fr_1fr_1fr_auto]"
          >
            <Field>
              <FieldLabel htmlFor={`sub-code-${value.key}`} required>
                Code
              </FieldLabel>
              <FieldInput
                id={`sub-code-${value.key}`}
                value={value.code}
                disabled={!!value.id}
                maxLength={10}
                onChange={(e) => update({ code: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`sub-name-${value.key}`} required>
                Name (EN)
              </FieldLabel>
              <FieldInput
                id={`sub-name-${value.key}`}
                value={value.name}
                maxLength={50}
                onChange={(e) => update({ name: e.target.value })}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`sub-local-${value.key}`}>
                Name (TH)
              </FieldLabel>
              <FieldInput
                id={`sub-local-${value.key}`}
                value={value.name_local ?? ""}
                maxLength={100}
                onChange={(e) => update({ name_local: e.target.value })}
              />
            </Field>
            <div className="flex items-end">
              {!readOnly && !value.id && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove sub-value ${index + 1}`}
                  onClick={() =>
                    setSubValues((current) =>
                      current.filter((row) => row.key !== value.key),
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}

async function saveDimensionWithValues({
  buCode,
  values,
  savedItem,
  subValues,
  onSave,
  setSavedItem,
  setSubValues,
}: {
  buCode: string | undefined;
  values: Omit<DimensionMaster, "id" | "doc_version" | "values">;
  savedItem: DimensionMaster | null;
  subValues: DimensionValueDraft[];
  onSave: (
    value: Omit<DimensionMaster, "id" | "doc_version" | "values">,
    current: DimensionMaster | null,
  ) => Promise<DimensionMaster>;
  setSavedItem: (value: DimensionMaster) => void;
  setSubValues: React.Dispatch<React.SetStateAction<DimensionValueDraft[]>>;
}) {
  const codes = subValues.map((value) => value.code.trim().toUpperCase());
  if (subValues.some((value) => !value.code.trim() || !value.name.trim())) {
    throw new Error("Sub-value Code and Name (EN) are required.");
  }
  if (new Set(codes).size !== codes.length) {
    throw new Error("Sub-value codes must be unique.");
  }
  if (!buCode) {
    throw new Error("Select a business unit first");
  }
  const master = await onSave(values, savedItem);
  setSavedItem(master);
  const results = await Promise.allSettled(
    subValues
      .filter((row) => row.dirty)
      .map(async (value) => {
        const changes = {
          name: value.name.trim(),
          name_local: value.name_local?.trim() || null,
          is_active: value.is_active,
        };
        const saved = await saveDimensionRecord(
          API_ENDPOINTS.GL_DIMENSION_VALUES(buCode),
          value.id
            ? changes
            : {
                ...changes,
                code: value.code.trim().toUpperCase(),
                gl_dimension_id: master.id,
              },
          value.id ? value : null,
        );
        setSubValues((current) =>
          current.map((row) =>
            row.key === value.key
              ? { ...row, ...saved, dimension_id: master.id, dirty: false }
              : row,
          ),
        );
      }),
  );
  const failed = results.find((result) => result.status === "rejected");
  if (failed?.status === "rejected") throw failed.reason;
}

function DimensionTypeFields({
  dataType,
  dateFormat,
  disabled,
  onDataTypeChange,
  onDateFormatChange,
}: {
  dataType: DimensionDataType;
  dateFormat: DimensionDateFormat;
  disabled: boolean;
  onDataTypeChange: (value: DimensionDataType) => void;
  onDateFormatChange: (value: DimensionDateFormat) => void;
}) {
  return (
    <>
      <Field>
        <FieldLabel htmlFor="dim-data-type" required>
          Data Type
        </FieldLabel>
        <Select
          value={dataType}
          disabled={disabled}
          onValueChange={(value) =>
            onDataTypeChange(value as DimensionDataType)
          }
        >
          <SelectTrigger id="dim-data-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {DIMENSION_DATA_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      {dataType === "date" && (
        <Field>
          <FieldLabel htmlFor="dim-date-format" required>
            Date Format
          </FieldLabel>
          <Select
            value={dateFormat}
            disabled={disabled}
            onValueChange={(value) =>
              onDateFormatChange(value as DimensionDateFormat)
            }
          >
            <SelectTrigger id="dim-date-format">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DIMENSION_DATE_FORMATS.map((format) => (
                <SelectItem key={format} value={format}>
                  {format}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      )}
    </>
  );
}

function getDimensionFormDefaults(item: DimensionMaster | null) {
  return {
    code: item?.code ?? "",
    name: item?.name ?? "",
    name_local: item?.name_local ?? "",
    sequence: item?.sequence ?? 1,
    is_active: item?.is_active ?? true,
    data_type: item ? (item.data_type ?? "lookup") : "string",
    date_format: item?.date_format ?? "DD/MM/YYYY",
  } as const;
}
