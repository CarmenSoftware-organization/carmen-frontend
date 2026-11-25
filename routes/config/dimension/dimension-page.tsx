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
import { WarningDialog } from "@/components/ui/warning-dialog";
import { ErrorState } from "@/components/ui/error-state";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError } from "@/lib/api-error";
import { httpClient } from "@/lib/http-client";
import type { DimensionMaster } from "@/types/accounting-master";

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
  /** เปิดจากปุ่มจำนวนค่าย่อย → dialog focus ที่ตารางค่าย่อย */
  const [focusValues, setFocusValues] = useState(false);
  const [deleting, setDeleting] = useState<DimensionMaster | null>(null);
  const [warning, setWarning] = useState("");

  const rows = useMemo(
    () =>
      dimensions
        .filter((item) =>
          `${item.code} ${item.name}`
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
              setFocusValues(false);
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
              setFocusValues(false);
              setEditing(row.original);
            }}
          >
            {row.original.name}
          </CellAction>
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
              onClick={() => {
                setFocusValues(true);
                setEditing(row.original);
              }}
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
      data_type: 120,
      values_count: 150,
      is_active: 100,
      actions: 60,
    },
    secondary: ["data_type", "index"],
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
            setFocusValues(false);
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
          focusValues={focusValues}
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
