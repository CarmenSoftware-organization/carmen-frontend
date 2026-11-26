import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import type { RunningCode } from "@/types/running-code";
import { exampleSegments } from "./running-code-config";
import { isDefaultNote } from "./running-code-labels";
import {
  RunningCodeExample,
  RunningCodeTypeText,
  useRunningCodeTypeLabel,
} from "./running-code-cells";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

interface UseRunningCodeTableOptions {
  runningCodes: RunningCode[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (runningCode: RunningCode) => void;
  onDelete: (runningCode: RunningCode) => void;
}

export function useRunningCodeTable({
  runningCodes,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseRunningCodeTableOptions) {
  const tfl = useTranslations("field");
  const t = useTranslations("systemAdmin.runningCode");
  const now = new Date();
  const typeLabel = useRunningCodeTypeLabel();

  const columns: ColumnDef<RunningCode>[] = [
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
      cell: ({ row }) => (
        <CellAction
          onClick={() => onEdit(row.original)}
          className="block w-full min-w-0"
        >
          <RunningCodeTypeText
            type={row.original.type}
            label={typeLabel(row.original.type)}
          />
        </CellAction>
      ),
      // กว้างคงที่ (Note เป็นตัว grow) — ถ้าปล่อยแบ่งตามสัดส่วน บนจอ 4K Type กับ Note
      // ห่างกันราว 1,450px (skill carmen-blue-ui-design ข้อ 2) · บรรทัดหลักเป็นชื่อคนอ่าน
      // key ดิบบรรทัดรอง ยาวสุด "ACCOUNTS-RECEIVABLE-CREDIT-NOTE" 11px mono tracking-tight
      // ~197px + padding 24 = 221 (วัด 2026-11-26) — ส่วนที่ใช้แยก AP/AR อยู่ท้าย key
      // ตัดท้ายเมื่อไรแยกไม่ออก จึงต้องกว้างพอทั้งเส้น
      size: 222,
      meta: { skeleton: columnSkeletons.text },
    },
    {
      id: "example",
      // ตัวอย่างเลขที่เอกสาร — หน้านี้ตั้ง "รูปแบบ" คนดูอยากเห็นผลลัพธ์ ไม่ใช่ต้องเปิด
      // dialog ทีละแถว (ข้อ 8) · config ที่ตัวช่วยอ่านไม่ออกโชว์ — เหมือนค่าว่าง
      header: () => t("example"),
      enableSorting: false,
      cell: ({ row }) => {
        return (
          <RunningCodeExample
            segments={exampleSegments(row.original.config, now)}
          />
        );
      },
      // ยาวสุด "FA‹ASSET-CATEGORY›26110001" 185px + padding 24 = 209 (วัด 2026-11-26)
      size: 210,
      meta: { headerTitle: t("example"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "note",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("note")} />
      ),
      cell: ({ row }) => {
        // note ที่ระบบเขียนให้ทุกแถวตอน Init ไม่บอกอะไร — โชว์เหมือนค่าว่าง
        const note = row.getValue<string>("note");
        return note && !isDefaultNote(note) ? (
          <span className="block truncate" title={note}>
            {note}
          </span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        );
      },
      // คอลัมน์ข้อความยาวตัวเดียวของตาราง รับความกว้างที่เหลือ — ตัดด้วย truncate ตาม
      // ความกว้างจริง ไม่ใช่ที่ 24rem ตายตัวทั้งที่จอมีที่ · `size` คือความกว้างขั้นต่ำ:
      // ผลรวม size ต้องไม่เกินกล่องที่ tablet (662px) และ `getTotalSize()` นับคอลัมน์
      // select (55) ที่ไม่ได้เรนเดอร์ด้วย → 55+60+222+210+53+60 = 660
      size: 53,
      meta: {
        headerTitle: tfl("note"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
  ];

  return useConfigTable<RunningCode>({
    data: runningCodes,
    columns,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    activity: { id: (r) => r.id, label: (r) => r.type },
  });
}
