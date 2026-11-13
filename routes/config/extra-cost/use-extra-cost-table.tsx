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
import type { ExtraCost } from "@/types/extra-cost";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseExtraCostTableOptions {
  data: ExtraCost[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (extraCost: ExtraCost) => void;
  onDelete: (extraCost: ExtraCost) => void;
  /** ความกว้างของกล่องตาราง (px) จาก ConfigListTemplate — `undefined` = ยังไม่ได้วัด */
  containerWidth?: number;
}

/**
 * กล่องกว้างพอ = ชื่อกว้างคงที่ สถานะชิดซ้ายและรับที่เหลือ → สถานะอยู่ติดชื่อทุกขนาดจอ
 * (เดิมแบ่งตามสัดส่วน บนจอ 4K ชื่อกว้าง 1,693px สถานะจึงห่างจากชื่อทั้งจอ)
 *
 * เกณฑ์ 860 = ผลรวม `size` เมื่อผู้ใช้เปิดคอลัมน์ Created/Updated ครบ
 * (55 select + 60 # + 260 ชื่อ + 100 สถานะ + 160 + 160 + 60 ปุ่ม = 855) กล่องแคบกว่านั้นถ้าล็อก
 * ความกว้างคอลัมน์ ตารางจะล้นแนวนอนทันทีที่เปิดสองคอลัมน์นั้น จึงปล่อยแบ่งตามสัดส่วนแบบเดิม
 * ซึ่งบนกล่องแคบชื่อกับสถานะอยู่ใกล้กันอยู่แล้ว
 */
const WIDE_BOX = 860;
const NAME_WIDTH = 260;

export function useExtraCostTable({
  data,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseExtraCostTableOptions) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const wide = (containerWidth ?? Number.POSITIVE_INFINITY) >= WIDE_BOX;
  const columns: ColumnDef<ExtraCost>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("name") || "..."}
        </CellAction>
      ),
      meta: { headerTitle: tfl("name"), skeleton: columnSkeletons.text },
      ...(wide && { size: NAME_WIDTH }),
    },
    // ชิดซ้ายทั้งสองโหมด — ป้ายที่จัดกึ่งกลางในคอลัมน์กว้างจะลอยห่างจากชื่อครึ่งคอลัมน์
    statusColumn<ExtraCost>(tfl, { align: "start", grow: wide }),
    ...auditColumns<ExtraCost>(tfl, dateTimeFormat),
  ];

  return useConfigTable<ExtraCost>({
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
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
