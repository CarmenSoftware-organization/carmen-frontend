import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigListTable } from "../shared/use-config-list-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import type { Shelf } from "@/types/shelf";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { useProfile } from "@/hooks/use-profile";

interface UseShelfTableOptions {
  containerWidth?: number;
  data: Shelf[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (shelf: Shelf) => void;
  onDelete: (shelf: Shelf) => void;
}

export function useShelfTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseShelfTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const columns: ColumnDef<Shelf>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("code") || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.textShort },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => row.getValue("name") || "...",
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      // คอลัมน์ grow — ตัดบรรทัดเดียวตามความกว้างคอลัมน์ ข้อความเต็มดูจาก title ตอน hover
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description || "-"}
        </span>
      ),
      enableSorting: false,
      meta: { headerTitle: tfl("description"), skeleton: columnSkeletons.text },
    },
    statusColumn<Shelf>(tfl),
    ...auditColumns<Shelf>(tfl, dateTimeFormat),
  ];

  return useConfigListTable<Shelf>({
    containerWidth,
    // description เป็นข้อความยาว → เป็นตัว grow (เดิม grow ที่ name ทำให้ name กว้างพันกว่า px
    // ขณะที่ description เหลือ 150 ตัดสองบรรทัด) · code 130 = รหัสยาวสุด ~96px + padding 24
    // (100 เดิมทำ CHRONO-04 ตัดบรรทัด) · name 220 = ชื่อยาวสุด ~177px + padding
    // ชุดเต็ม 55+60+130+220+110+100+60 = 735 (พอที่กล่อง 1024 = 742)
    // ตัด description แล้ว 625 (กล่อง tablet 662) — แบ่งตามสัดส่วนแทนจะบีบ code จนตัดบรรทัด
    // description ยังดูได้ใน dialog และ card view
    layout: {
      grow: "description",
      widths: { code: 130, name: 220, description: 110 },
      secondary: ["description"],
    },
    data,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    // ยังไม่เปิด activity — shelf ไม่อยู่ใน activity-registry ของ backend
    // (backend ยังไม่มีโมดูลนี้เลย) เปิดไปเมนูจะกดแล้วว่างเปล่า
  });
}
