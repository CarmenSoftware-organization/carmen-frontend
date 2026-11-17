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
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import {
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import type {
  AccountMappingRow,
  MappingType,
  Ref,
} from "@/types/chart-of-account-mapping";
import {
  AccountCell,
  CostCenterCell,
  StatusCell,
  type CellMenuHandlers,
} from "./coam-cells";

export const MOVEMENT_KEY = {
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

/**
 * คอลัมน์ที่จัดกลุ่ม — เรียงจากหยาบไปละเอียด ค่าของคอลัมน์ถือว่า "ซ้ำ" ก็ต่อเมื่อทุกชั้น
 * ก่อนหน้าก็ซ้ำด้วย (category เดียวกันแต่คนละ location ไม่นับว่าซ้ำ)
 */
const GROUP_KEYS = {
  location: (r: AccountMappingRow) => [r.location.id],
  location_type: (r: AccountMappingRow) => [r.location.id],
  category: (r: AccountMappingRow) => [r.location.id, r.category.id],
  sub_category: (r: AccountMappingRow) => [
    r.location.id,
    r.category.id,
    r.sub_category.id,
  ],
  item_group: (r: AccountMappingRow) => [
    r.location.id,
    r.category.id,
    r.sub_category.id,
    r.item_group.id,
  ],
} as const;

type GroupColumn = keyof typeof GROUP_KEYS;

/** ค่าเท่ากับแถวก่อนหน้าบนหน้าเดียวกัน — เทียบแค่แถวติดกัน จึงใช้ได้ทุกการเรียง */
function isRepeated(
  col: GroupColumn,
  cur: AccountMappingRow,
  prev: AccountMappingRow | undefined,
) {
  if (!prev) return false;
  const a = GROUP_KEYS[col](cur);
  const b = GROUP_KEYS[col](prev);
  return a.every((v, i) => v === b[i]);
}

/**
 * ค่าที่ซ้ำกับแถวบนจะจางลง ให้ตาไปจับคอลัมน์ที่ต่างกันจริง (ประเภทรายการ / cost center / บัญชี)
 * ชี้แถวแล้วกลับมาเข้ม · ไม่ซ่อนทิ้ง เพราะ location ยังเป็นปุ่มเปิดแผงแก้ไขของแถวนั้น
 * `data-slot` กัน wrapper ของ DataGrid ใส่ line-clamp ทับ
 */
function GroupValue({
  repeated,
  children,
}: {
  readonly repeated: boolean;
  readonly children: React.ReactNode;
}) {
  if (!repeated) return children;
  return (
    <div
      data-slot="coam-repeat"
      data-repeated=""
      className="opacity-35 transition-opacity focus-within:opacity-100 [tr:hover_&]:opacity-100 [tr[data-state=selected]_&]:opacity-100"
    >
      {children}
    </div>
  );
}

type CellCtx = {
  row: { index: number; original: AccountMappingRow };
  table: { getCoreRowModel: () => { rows: { original: AccountMappingRow }[] } };
};

const repeatedIn = (col: GroupColumn, { row, table }: CellCtx) =>
  isRepeated(
    col,
    row.original,
    table.getCoreRowModel().rows[row.index - 1]?.original,
  );

interface UseCoamTableOptions {
  data: AccountMappingRow[];
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  tab: MappingType;
  onOpen: (row: AccountMappingRow) => void;
  /** เมนูบนค่า cost center / account */
  menu: CellMenuHandlers;
}

/**
 * ตารางผังการผูกบัญชี (lazy load — ทุกชุดที่โหลดแล้วต่อกันเป็นรายการเดียว) — คอลัมน์ adjustment type มีเฉพาะแท็บ GL
 *
 * ประกอบ `useReactTable` เองแทน `useConfigTable` เพราะต้องการ `getRowId` = id
 * ของแถว (การเลือกแถวเพื่อ "ยืนยันว่าตรวจแล้ว" ต้องไม่ติดไปกับ index ของหน้าถัดไป)
 * และหน้านี้ไม่มี delete / status column
 */
export function useCoamTable({
  data,
  tableConfig,
  tab,
  onOpen,
  menu,
}: UseCoamTableOptions) {
  "use no memo";
  const t = useTranslations("config.chartOfAccountMapping");
  const tl = useTranslations("config.location");
  const tfl = useTranslations("field");

  const columns = useMemo<ColumnDef<AccountMappingRow>[]>(
    () => [
      selectColumn<AccountMappingRow>(),
      // lazy load: ทุกแถวอยู่ในรายการเดียว — ลำดับนับจาก 1 ต่อเนื่อง
      indexColumn<AccountMappingRow>({ page: 1, perpage: 1 }),
      {
        id: "location",
        accessorFn: (r) => r.location.code,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("location")} />
        ),
        cell: (ctx) => (
          <GroupValue repeated={repeatedIn("location", ctx)}>
            <CellAction onClick={() => onOpen(ctx.row.original)}>
              {refCell(ctx.row.original.location)}
            </CellAction>
          </GroupValue>
        ),
        size: 180,
        meta: { headerTitle: tfl("location"), skeleton: columnSkeletons.text },
      },
      {
        id: "location_type",
        accessorFn: (r) => r.location.location_type,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("locationType")} />
        ),
        cell: (ctx) => (
          <GroupValue repeated={repeatedIn("location_type", ctx)}>
            {tl(LOCATION_TYPE_KEY[ctx.row.original.location.location_type])}
          </GroupValue>
        ),
        size: 110,
        meta: {
          headerTitle: t("locationType"),
          skeleton: columnSkeletons.textShort,
        },
      },
      {
        id: "category",
        accessorFn: (r) => r.category.code,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("category")} />
        ),
        cell: (ctx) => (
          <GroupValue repeated={repeatedIn("category", ctx)}>
            {refCell(ctx.row.original.category)}
          </GroupValue>
        ),
        size: 150,
        meta: { headerTitle: tfl("category"), skeleton: columnSkeletons.text },
      },
      {
        id: "sub_category",
        accessorFn: (r) => r.sub_category.code,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("subCategory")} />
        ),
        cell: (ctx) => (
          <GroupValue repeated={repeatedIn("sub_category", ctx)}>
            {refCell(ctx.row.original.sub_category)}
          </GroupValue>
        ),
        size: 150,
        meta: {
          headerTitle: tfl("subCategory"),
          skeleton: columnSkeletons.text,
        },
      },
      {
        id: "item_group",
        accessorFn: (r) => r.item_group.code,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={tfl("itemGroup")} />
        ),
        cell: (ctx) => (
          <GroupValue repeated={repeatedIn("item_group", ctx)}>
            {refCell(ctx.row.original.item_group)}
          </GroupValue>
        ),
        size: 160,
        meta: { headerTitle: tfl("itemGroup"), skeleton: columnSkeletons.text },
      },
      {
        id: "movement",
        accessorFn: (r) => r.movement,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("movement")} />
        ),
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
              accessorFn: (r) => r.adjustment_type?.code,
              header: ({ column }) => (
                <DataGridColumnHeader
                  column={column}
                  title={t("adjustmentType")}
                />
              ),
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
        id: "cost_center",
        accessorFn: (r) => r.cost_center.code,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("costCenter")} />
        ),
        cell: ({ row }) => <CostCenterCell row={row.original} menu={menu} />,
        size: 200,
        meta: { headerTitle: t("costCenter"), skeleton: columnSkeletons.text },
      },
      {
        id: "account",
        accessorFn: (r) => r.account.code,
        header: ({ column }) => (
          <DataGridColumnHeader column={column} title={t("account")} />
        ),
        cell: ({ row }) => <AccountCell row={row.original} menu={menu} />,
        size: 240,
        meta: { headerTitle: t("account"), skeleton: columnSkeletons.text },
      },
      {
        id: "status",
        enableSorting: false,
        header: t("status"),
        cell: ({ row }) => <StatusCell row={row.original} />,
        size: 150,
        meta: { headerTitle: t("status"), skeleton: columnSkeletons.badge },
      },
    ],
    [t, tl, tfl, tab, onOpen, menu],
  );

  return useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
    ...tableConfig,
    pageCount: 1,
  });
}
