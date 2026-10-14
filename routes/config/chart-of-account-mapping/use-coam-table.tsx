"use no memo";
import { useMemo } from "react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { NameWithSubtext } from "@/components/share/name-with-sub-text";
import { CellAction } from "@/components/ui/cell-action";
import {
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import type { ParamsDto } from "@/types/params";
import type {
  AccountMappingRow,
  MappingType,
  Ref,
} from "@/types/chart-of-account-mapping";
import { AccountCell, CostCenterCell, StatusCell } from "./coam-cells";

const MOVEMENT_KEY = {
  grn: "movementGrn",
  cn: "movementCn",
  adjustment: "movementAdjustment",
  sr_in: "movementSrIn",
  sr_out: "movementSrOut",
} as const;

const LOCATION_TYPE_KEY = {
  inventory: "typeInventory",
  direct: "typeDirect",
  consignment: "typeConsignment",
} as const;

const refCell = (v: Ref | null) =>
  v ? (
    <NameWithSubtext primary={v.code} secondary={v.name} />
  ) : (
    <span className="text-muted-foreground">—</span>
  );

interface UseCoamTableOptions {
  data: AccountMappingRow[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  tab: MappingType;
  onOpen: (row: AccountMappingRow) => void;
}

/**
 * ตารางผังการผูกบัญชี (server pagination) — คอลัมน์ adjustment type มีเฉพาะแท็บ GL
 *
 * ประกอบ `useReactTable` เองแทน `useConfigTable` เพราะต้องการ `getRowId` = id
 * ของแถว (การเลือกแถวเพื่อ "ยืนยันว่าตรวจแล้ว" ต้องไม่ติดไปกับ index ของหน้าถัดไป)
 * และหน้านี้ไม่มี delete / status column
 */
export function useCoamTable({
  data,
  totalRecords,
  params,
  tableConfig,
  tab,
  onOpen,
}: UseCoamTableOptions) {
  "use no memo";
  const t = useTranslations("config.chartOfAccountMapping");
  const tl = useTranslations("config.location");
  const tfl = useTranslations("field");
  const { page, perpage } = params;

  const columns = useMemo<ColumnDef<AccountMappingRow>[]>(
    () => [
      selectColumn<AccountMappingRow>(),
      indexColumn<AccountMappingRow>({ page, perpage }),
      {
        id: "location",
        header: tfl("location"),
        cell: ({ row }) => (
          <CellAction onClick={() => onOpen(row.original)}>
            {refCell(row.original.location)}
          </CellAction>
        ),
        size: 180,
        meta: { headerTitle: tfl("location"), skeleton: columnSkeletons.text },
      },
      {
        id: "location_type",
        header: t("locationType"),
        cell: ({ row }) =>
          tl(LOCATION_TYPE_KEY[row.original.location.location_type]),
        size: 110,
        meta: {
          headerTitle: t("locationType"),
          skeleton: columnSkeletons.textShort,
        },
      },
      {
        id: "category",
        header: tfl("category"),
        cell: ({ row }) => refCell(row.original.category),
        size: 150,
        meta: { headerTitle: tfl("category"), skeleton: columnSkeletons.text },
      },
      {
        id: "sub_category",
        header: tfl("subCategory"),
        cell: ({ row }) => refCell(row.original.sub_category),
        size: 150,
        meta: {
          headerTitle: tfl("subCategory"),
          skeleton: columnSkeletons.text,
        },
      },
      {
        id: "item_group",
        header: tfl("itemGroup"),
        cell: ({ row }) => refCell(row.original.item_group),
        size: 160,
        meta: { headerTitle: tfl("itemGroup"), skeleton: columnSkeletons.text },
      },
      {
        id: "movement",
        header: t("movement"),
        cell: ({ row }) => t(MOVEMENT_KEY[row.original.movement]),
        size: 140,
        meta: {
          headerTitle: t("movement"),
          skeleton: columnSkeletons.textShort,
        },
      },
      ...(tab === "GL"
        ? [
            {
              id: "adjustment_type",
              header: t("adjustmentType"),
              cell: ({ row }) => refCell(row.original.adjustment_type),
              size: 160,
              meta: {
                headerTitle: t("adjustmentType"),
                skeleton: columnSkeletons.text,
              },
            } satisfies ColumnDef<AccountMappingRow>,
          ]
        : []),
      {
        id: "account",
        header: t("account"),
        cell: ({ row }) => <AccountCell row={row.original} />,
        size: 240,
        meta: { headerTitle: t("account"), skeleton: columnSkeletons.text },
      },
      {
        id: "cost_center",
        header: t("costCenter"),
        cell: ({ row }) => <CostCenterCell row={row.original} />,
        size: 200,
        meta: { headerTitle: t("costCenter"), skeleton: columnSkeletons.text },
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <StatusCell row={row.original} />,
        size: 150,
        meta: { headerTitle: t("status"), skeleton: columnSkeletons.badge },
      },
    ],
    [t, tl, tfl, tab, onOpen, page, perpage],
  );

  return useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    enableSorting: false,
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(perpage) || 1)),
  });
}
