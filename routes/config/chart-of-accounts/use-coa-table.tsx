import { useMemo } from "react";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { DataGridRowActions } from "@/components/ui/data-grid/data-grid-row-actions";
import type { ColumnDef } from "@tanstack/react-table";
import { useGlAccountGroups } from "../shared/use-gl-account-groups";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigListTable } from "../shared/use-config-list-table";
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

/** ชื่อบรรทัดที่สอง — ข้ามเมื่อซ้ำกับชื่อหลัก (ข้อมูลนำเข้าส่วนใหญ่กรอกสองช่องเหมือนกัน) */
export function secondaryName(account: ChartOfAccount): string | null {
  const second = account.description_2?.trim();
  if (!second) return null;
  return second.toLowerCase() === account.description_1?.trim().toLowerCase()
    ? null
    : second;
}

interface UseCoaTableOptions {
  containerWidth?: number;
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
  containerWidth,
}: UseCoaTableOptions) {
  const t = useTranslations("config.chartOfAccounts");
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const deleteGate = useDeleteGate();
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
        <CellAction
          onClick={() => onEdit(row.original)}
          className="text-primary font-mono font-bold"
        >
          {row.getValue("code") || "..."}
        </CellAction>
      ),
      size: 100,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      // ด้านบัญชีเป็นแกนแนวตั้งถัดจากรหัส แบบสมุดบัญชีแยกประเภท — ตัวย่อ mono ให้ตรงกันทุกแถว
      accessorKey: "nature",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("nature")} />
      ),
      cell: ({ row }) => (
        <span
          className="text-foreground font-mono font-semibold"
          title={t(`nature.${row.original.nature}`)}
        >
          {t(`natureShort.${row.original.nature}`)}
        </span>
      ),
      size: 120,
      meta: { headerTitle: tfl("nature"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "description_1",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("accountName")} />
      ),
      cell: ({ row }) => {
        const secondary = secondaryName(row.original);
        return (
          <CellAction
            onClick={() => onEdit(row.original)}
            className="space-y-0.5 text-left"
          >
            <div className="text-foreground font-medium">
              {row.original.description_1}
            </div>
            {secondary && (
              <div className="text-muted-foreground text-xs">{secondary}</div>
            )}
          </CellAction>
        );
      },
      size: 240,
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
      accessorKey: "category",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("category")} />
      ),
      cell: ({ row }) =>
        row.original.category ? (
          t(`accountCategory.${row.original.category}`)
        ) : (
          <span className="text-warning-ink">{t("labels.categoryUnset")}</span>
        ),
      size: 140,
      meta: { headerTitle: tfl("category"), skeleton: columnSkeletons.text },
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
        <DataGridColumnHeader
          column={column}
          title={t("labels.groupingTreeLevel")}
        />
      ),
      cell: ({ row }) => {
        const id =
          row.original.account_group?.id ?? row.original.account_group_id;
        if (!id) return <span className="text-muted-foreground">—</span>;
        const g = groupMap.get(id);
        return g ? (
          <span>
            <span className="text-muted-foreground">L{g.level} · </span>
            <span className="font-mono">{g.code}</span> {g.name}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs">{id}</span>
        );
      },
      size: 180,
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
        onDelete={() => onDelete(row.original)}
        {...deleteGate}
      />
    )),
  ];

  return useConfigListTable<ChartOfAccount>({
    containerWidth,
    layout: {
      grow: "description_1",
      widths: {
        code: 100,
        nature: 120,
        description_1: 220,
        category: 140,
        type: 180,
        account_group_id: 180,
      },
      // แยกหมวด / ประเภท / กลุ่มเป็นคอลัมน์จริง ชื่อไม่ต้องยืดกินที่ว่างทั้งแถว — กล่องแคบซ่อนจากหัวรายการก่อน
      // (audit ซ่อนไว้ก่อนเหมือนทุกหน้ารายการ — เปิดได้จากเมนูคอลัมน์)
      secondary: [
        "account_group_id",
        "type",
        "category",
      ],
    },
    data,
    columns,
    totalRecords,
    params,
    tableConfig,
    hideStatus: true,
    initialState: {
      columnVisibility: {
        description_2: false,
        created_at: false,
        updated_at: false,
      },
    },
  });
}
