import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import {
  actionColumn,
  auditColumns,
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { useProfile } from "@/hooks/use-profile";
import type { PriceList, PriceListStatus } from "@/types/price-list";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { PlPeriodCell } from "./pl-period-cell";

interface UsePriceListTableOptions {
  priceLists: PriceList[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (priceList: PriceList) => void;
  onDelete: (priceList: PriceList) => void;
  /** แท็บหมดช่วงแล้ว — ส่งต่อให้ PlPeriodCell */
  quietExpired?: boolean;
}

export function usePriceListTable({
  priceLists,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  quietExpired = false,
}: UsePriceListTableOptions) {
  "use no memo";
  const { dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const deleteGate = useDeleteGate();

  const dataColumns: ColumnDef<PriceList>[] = [
    {
      // id = ชื่อ column จริงของ backend (`pricelist_no`) เพื่อให้ sort ส่ง field ถูกต้อง;
      // response ส่งค่ามาใน field `no` (backend alias) จึงอ่านค่าจาก row.no
      id: "pricelist_no",
      accessorFn: (row) => row.no,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("no")} />
      ),
      cell: ({ row }) => (
        <CellAction
          onClick={() => onEdit(row.original)}
          className="whitespace-nowrap"
        >
          {row.original.no}
        </CellAction>
      ),
      size: 160,
      meta: { headerTitle: tfl("no"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <span className="block truncate" title={row.original.name || undefined}>
          {row.original.name}
        </span>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
      size: 240,
    },
    {
      id: "vendor_name",
      accessorFn: (row) => row.vendor?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("vendor")} />
      ),
      cell: ({ row }) => {
        const name = row.original.vendor?.name;
        if (!name) return <span className="text-muted-foreground">—</span>;
        return (
          <span className="block truncate" title={name}>
            {name}
          </span>
        );
      },
      meta: { headerTitle: tfl("vendor"), skeleton: columnSkeletons.text },
      size: 240,
    },
    {
      // id เป็นชื่อคอลัมน์จริงใน DB เพื่อให้ sort ฝั่ง server ได้ (เรียงช่วงเวลา = เรียงวันเริ่ม)
      id: "effective_from_date",
      accessorKey: "effectivePeriod",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("effectivePeriod")} />
      ),
      cell: ({ row }) => (
        <PlPeriodCell
          period={row.getValue("effective_from_date")}
          compact
          quietExpired={quietExpired}
        />
      ),
      meta: {
        headerTitle: tfl("effectivePeriod"),
        skeleton: columnSkeletons.text,
      },
      size: 220,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("status")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => {
        const status = row.getValue<string>("status");
        return (
          <StatusIconLabel
            status={status}
            // ป้ายมาจาก i18n ไม่ใช่ PL_STATUS_CONFIG ที่เป็นอังกฤษล้วน — หน้านี้มีไทย
            // อยู่แล้ว ไม่ถอยไปเป็นอังกฤษเพื่อให้เหมือน PR
            label={ts(status as PriceListStatus)}
            // คอลัมน์นี้จัดกลาง — label เป็น inline-flex ซึ่ง text-center ของเซลล์
            // เอื้อมไม่ถึงเมื่ออยู่ในกล่อง clamp ของ DataGrid
            className="flex w-full justify-center uppercase"
          />
        );
      },
      size: 120,
      meta: {
        headerTitle: tfl("status"),
        cellClassName: "text-center",
        headerClassName: "text-center",
        skeleton: columnSkeletons.badge,
      },
    },
    ...auditColumns<PriceList>(tfl, dateTimeFormat),
  ];

  const allColumns: ColumnDef<PriceList>[] = [
    selectColumn<PriceList>(),
    indexColumn<PriceList>(params),
    ...dataColumns,
    actionColumn<PriceList>(onDelete, {
      ...deleteGate,
      activity: { id: (r) => r.id, label: (r) => r.no },
    }),
  ];

  return useReactTable({
    data: priceLists,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
