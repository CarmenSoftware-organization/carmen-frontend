import type { ColumnDef } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import type { RunningCode } from "@/types/running-code";
import { exampleCode } from "./running-code-config";
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

  const columns: ColumnDef<RunningCode>[] = [
    {
      accessorKey: "type",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("type")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.getValue("type")}
        </CellAction>
      ),
      // กว้างคงที่ (Note เป็นตัว grow) — ถ้าปล่อยแบ่งตามสัดส่วน บนจอ 4K Type กับ Note
      // ห่างกันราว 1,450px (skill carmen-blue-ui-design ข้อ 2)
      size: 190,
      meta: { skeleton: columnSkeletons.text },
    },
    {
      id: "example",
      // ตัวอย่างเลขที่เอกสาร — หน้านี้ตั้ง "รูปแบบ" คนดูอยากเห็นผลลัพธ์ ไม่ใช่ต้องเปิด
      // dialog ทีละแถว (ข้อ 8) · config ที่ตัวช่วยอ่านไม่ออกโชว์ — เหมือนค่าว่าง
      header: () => t("example"),
      enableSorting: false,
      cell: ({ row }) => {
        const example = exampleCode(row.original.config, now);
        return example ? (
          <span className="font-mono">{example}</span>
        ) : (
          <span className="text-muted-foreground/60">—</span>
        );
      },
      size: 180,
      meta: { headerTitle: t("example"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "note",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("note")} />
      ),
      cell: ({ row }) => {
        const note = row.getValue<string>("note");
        return note ? (
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
      // select (55) ที่ไม่ได้เรนเดอร์ด้วย → 55+60+190+180+115+60 = 660
      size: 115,
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
