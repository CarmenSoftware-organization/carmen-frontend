import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";
import type { EcoLabel } from "@/types/eco-label";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseEcoLabelTableOptions {
  data: EcoLabel[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (ecoLabel: EcoLabel) => void;
  onDelete: (ecoLabel: EcoLabel) => void;
  /** ความกว้างของกล่องตาราง (px) จาก ConfigListTemplate — `undefined` = ยังไม่ได้วัด */
  containerWidth?: number;
}

/**
 * Code / Name กว้างคงที่ Description รับที่ว่างที่เหลือ (grow) → ชื่ออยู่ติดรหัสทุกขนาดจอ
 * (เดิมแบ่งตามสัดส่วน บนจอ 4K สามคอลัมน์กว้างคอลัมน์ละ 860px แต่คำอธิบายถูกตัดที่ 384px)
 *
 * ผลรวม `size` (55 select ที่ไม่เรนเดอร์ + 60 # + code + name + description + 100 สถานะ + 60 ปุ่ม)
 * - กล่องกว้าง: 55 + 60 + 160 + 300 + 200 + 100 + 60 = 935 → จุดสลับ 940 (ต้องสูงกว่าผลรวม)
 * - กล่องแคบ (tablet): 55 + 60 + 110 + 150 + 127 + 100 + 60 = 662 = กล่องที่จอ 768 พอดี
 * `size` ของ Description คือความกว้างขั้นต่ำของมัน
 */
const WIDE_BOX = 940;
const columnSizes = (containerWidth: number | undefined) =>
  (containerWidth ?? Number.POSITIVE_INFINITY) >= WIDE_BOX
    ? { code: 160, name: 300, description: 200 }
    : { code: 110, name: 150, description: 127 };

export function useEcoLabelTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseEcoLabelTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const sizes = columnSizes(containerWidth);
  const columns: ColumnDef<EcoLabel>[] = [
    {
      accessorKey: "code",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("code")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          <span className="text-xs">{row.getValue("code")}</span>
        </CellAction>
      ),
      size: sizes.code,
      meta: { headerTitle: tfl("code"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => <span>{row.getValue("name") || "..."}</span>,
      size: sizes.name,
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description}
        </span>
      ),
      enableSorting: false,
      size: sizes.description,
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    statusColumn<EcoLabel>(tfl),
    ...auditColumns<EcoLabel>(tfl, dateTimeFormat),
  ];

  return useConfigTable<EcoLabel>({
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
  });
}
