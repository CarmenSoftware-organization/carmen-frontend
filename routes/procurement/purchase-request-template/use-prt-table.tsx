import { useTranslations } from "use-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import { useConfigTable } from "@/components/ui/data-grid/use-config-table";
import type { PurchaseRequestTemplate } from "@/types/purchase-request";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import {
  auditColumns,
  columnSkeletons,
  statusColumn,
} from "@/components/ui/data-grid/columns";
import { useProfile } from "@/hooks/use-profile";

interface UsePrtTableOptions {
  templates: PurchaseRequestTemplate[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (template: PurchaseRequestTemplate) => void;
  onDelete: (template: PurchaseRequestTemplate) => void;
  /** ความกว้างของกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด โชว์ครบทุกคอลัมน์ */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * คอลัมน์สั้นกว้างคงที่ คำอธิบายรับที่เหลือ (`meta.grow`) — เดิมแบ่งสัดส่วนเท่ากัน บน Full HD
 * แต่ละคอลัมน์กว้าง 275px ชื่อกับเวิร์กโฟลว์ห่างกันโดยไม่จำเป็น ตารางกว้างขั้นต่ำเท่าผลรวม `size`
 * ซึ่งนับคอลัมน์ select (55) ที่หน้านี้ไม่ได้เรนเดอร์ด้วย:
 *   ครบ             55+60+220+160+160+160+100+60 = 975
 *   ไม่มีเลขลำดับ                                   = 915
 *   ไม่มีผู้สร้าง                                    = 755
 *   ไม่มีเวิร์กโฟลว์                                  = 595  (กล่องที่จอ 768 = 662)
 * ซ่อนเลขลำดับก่อน (บอกอะไรน้อยสุด) แล้วผู้สร้าง แล้วเวิร์กโฟลว์ · จุดเปลี่ยนขั้นตั้งสูงกว่าผลรวม
 * 35px — คอลัมน์รองกลับมาเมื่อคำอธิบายได้ที่ ~195px แล้วเท่านั้น
 * ของที่ซ่อนยังดูได้: เวิร์กโฟลว์ = มุมมองการ์ด/หน้ารายละเอียด · ผู้สร้าง = Activity ของแถว ·
 * คอลัมน์ที่ผู้ใช้เปิดเพิ่มเอง (created, updated) ไม่นับในงบ — เกินกล่องก็เลื่อนแนวนอนในกรอบเอง
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showIndex: w >= 1010,
    showCreatedBy: w >= 950,
    showWorkflow: w >= 790,
  };
}

export function usePrtTable({
  templates,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UsePrtTableOptions) {
  "use no memo";

  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();
  const { showCreatedBy, showIndex, showWorkflow } = columnTier(containerWidth);

  const columns: ColumnDef<PurchaseRequestTemplate>[] = [
    {
      accessorKey: "name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("name")} />
      ),
      cell: ({ row }) => (
        <CellAction onClick={() => onEdit(row.original)}>
          {row.original.name || "..."}
        </CellAction>
      ),
      size: 220,
      meta: { headerTitle: tfl("name") },
    },
    {
      id: "workflow_name",
      accessorFn: (row) => row.workflow?.name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("workflow")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.workflow?.name ?? undefined}
        >
          {row.original.workflow?.name || "—"}
        </span>
      ),
      size: 160,
      meta: {
        headerTitle: tfl("workflow"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      accessorKey: "description",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("description")} />
      ),
      // ข้อความยาวรับที่ว่างที่เหลือ — ชื่อ/เวิร์กโฟลว์จึงอยู่ชิดกันบนจอกว้าง
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.description ?? undefined}
        >
          {row.original.description || "—"}
        </span>
      ),
      size: 160,
      meta: {
        headerTitle: tfl("description"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      // ใครเป็นคนสร้างแม่แบบ — แม่แบบถูกใช้ซ้ำข้ามแผนก คนที่เปิดมาเจอต้องรู้ว่า
      // ของใครก่อนจะเอาไปสั่งของจริง · เรียงได้ผ่าน `sort=created_by:asc` ซึ่ง
      // gateway รับไปทำเอง (ดึงทั้งชุด → resolve ชื่อ → เรียง → ตัดหน้า) เพราะ
      // ชื่อผู้สร้างไม่ใช่คอลัมน์ในตาราง — แถวที่ไม่มีชื่ออยู่ท้ายเสมอทั้งสองทิศ
      id: "created_by",
      accessorFn: (row) => row.audit?.created?.name ?? "",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("createdBy")} />
      ),
      cell: ({ row }) => (
        <span
          className="text-muted-foreground block truncate"
          title={row.original.audit?.created?.name}
        >
          {row.original.audit?.created?.name || "—"}
        </span>
      ),
      size: 160,
      meta: {
        headerTitle: tfl("createdBy"),
        skeleton: columnSkeletons.text,
      },
    },
    // status column แทรกเองก่อน created/updated (useConfigTable ส่ง hideStatus)
    statusColumn<PurchaseRequestTemplate>(tfl),
    ...auditColumns<PurchaseRequestTemplate>(tfl, dateTimeFormat),
  ];

  // ซ่อนผ่านรายการคอลัมน์ ไม่ใช่ CSS — ความกว้างขั้นต่ำของตารางที่มีคอลัมน์ยืดคิดจากทุกคอลัมน์
  // ที่ TanStack ถือว่ามองเห็น · ตัดออกจากรายการเลย เมนู Toggle Columns ของผู้ใช้จึงไม่ถูกทับ
  const hidden = new Set<string>([
    ...(showCreatedBy ? [] : ["created_by"]),
    ...(showWorkflow ? [] : ["workflow_name"]),
  ]);
  const visibleColumns = columns.filter((c) => {
    const key =
      c.id ?? ("accessorKey" in c ? String(c.accessorKey) : undefined);
    return !key || !hidden.has(key);
  });

  return useConfigTable<PurchaseRequestTemplate>({
    data: templates,
    columns: visibleColumns,
    hideIndex: !showIndex,
    totalRecords,
    params,
    tableConfig,
    onDelete,
    hideStatus: true,
    // คอลัมน์ audit ซ่อนเป็น default (เปิดได้จากเมนู Toggle Columns)
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    activity: { id: (r) => r.id, label: (r) => r.name },
  });
}
