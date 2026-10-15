import { useMemo } from "react";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import { useCan } from "@/hooks/use-can";
import { usePermissionPrefix } from "@/hooks/use-permission-prefix";
import { buildPermissionKey } from "@/constant/permissions";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import type { ColumnDef } from "@tanstack/react-table";
import { useGlAccountGroups } from "../shared/use-gl-account-groups";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  customActionColumn,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseCoaTableOptions {
  data: ChartOfAccount[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: ChartOfAccount) => void;
  onDelete: (item: ChartOfAccount) => void;
}

export function useCoaTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseCoaTableOptions) {
  const t = useTranslations("config.chartOfAccounts");
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const navigate = useNavigate();
  const deleteGate = useDeleteGate();
  const { can, isAdmin } = useCan();
  const prefix = usePermissionPrefix();
  const editPermission = prefix ? buildPermissionKey(prefix, "update") : undefined;
  const groupQuery = useGlAccountGroups();
  const groupMap = useMemo(
    () => new Map((groupQuery.data ?? []).map((g) => [g.id, g])),
    [groupQuery.data],
  );

  const columns: ColumnDef<ChartOfAccount>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)} className="font-mono font-bold text-primary">
          {row.getValue("code") || "..."}
        </CellAction>
      ),
      size: 100,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "description_1",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("accountName")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)} className="space-y-0.5 text-left">
          <div className="font-medium text-foreground">{row.original.description_1}</div>
          {row.original.description_2 && (
            <div className="text-xs text-muted-foreground">{row.original.description_2}</div>
          )}
        </CellAction>
      ),
      size: 180,
      meta: { headerTitle: t("accountName"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "description_2",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "nature",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("nature")} />
      ),
      cell: ({ row }) => t(`nature.${row.original.nature}`),
      size: 110,
      meta: { headerTitle: tfl("nature"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
      cell: ({ row }) => t(`accountType.${row.original.type}`),
      size: 180,
      meta: { headerTitle: tfl("type"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "account_group_id",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("labels.groupingTreeLevel")} />
      ),
      cell: ({ row }) => {
        const id = row.original.account_group?.id ?? row.original.account_group_id;
        if (!id) return <span className="text-muted-foreground">—</span>;
        const g = groupMap.get(id);
        return g ? (
          <span className="inline-flex items-center gap-1 rounded bg-primary/10 px-2 py-0.5 font-mono text-xs font-medium text-primary">
            L{g.level} | {g.code} {g.name}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{id}</span>
        );
      },
      size: 160,
      meta: {
        headerTitle: t("labels.groupingTreeLevel"),
        skeleton: columnSkeletons.textShort,
      },
    },
    statusColumn<ChartOfAccount>(tfl),
    ...auditColumns<ChartOfAccount>(tfl, dateTimeFormat),
    customActionColumn<ChartOfAccount>(({ row }) => (
      <DataGridRowActions
        activity={{ id: row.original.id, label: row.original.code }}
        onEdit={() => navigate(`/config/chart-of-accounts/${row.original.id}?mode=edit`, listReturnState())}
        onDelete={() => onDelete(row.original)}
        {...deleteGate}
        editPermission={editPermission}
        editDenied={!!editPermission && !isAdmin && !can(editPermission)}
      />
    )),
  ];

  return useConfigTable<ChartOfAccount>({
    data,
    columns,
    totalRecords,
    params,
    tableConfig,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },

  });
}
