import { useState } from "react";
import type { ColumnDef, VisibilityState } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  actionColumn,
  auditColumns,
  columnSkeletons,
  indexColumn,
  selectColumn,
} from "@/components/ui/data-grid/columns";
import { SrSendBackHint } from "./sr-send-back-hint";
import { useDeleteGate } from "@/hooks/use-delete-gate";
import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type {
  StoreRequisition,
  StoreRequisitionStatus,
  StoreRequisitionType,
} from "@/types/store-requisition";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import { StatusChip } from "@/components/ui/status-chip";

interface UseStoreRequisitionTableOptions {
  items: StoreRequisition[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: StoreRequisition) => void;
  onDelete: (item: StoreRequisition) => void;
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "From → To" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (นับคอลัมน์ select 55 ที่ไม่ได้เรนเดอร์ · ไม่นับ audit ที่ซ่อนเป็น default):
 *   ครบ  55+48+225+105+100+170+140+160+140+60 = 1203
 *   ไม่มี workflow                              = 1103
 *   ไม่มีผู้ขอ (ลงบรรทัดรองใต้แผนก)                 =  963
 *   กล่องแคบ (ไม่มีวันที่ ลงใต้เลขที่ · เลขที่ 150 · From → To ขั้นต่ำ 110 · แผนก 130)
 *        55+48+150+110+130+140+60 = 693
 *   ไม่มีคอลัมน์สถานะ (ชิปลงใต้แผนก)              =  553  (กล่องที่จอ 768 = 662)
 * `#` แสดงตลอดทุกขั้น (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน) — ขั้นแคบสุดจึงย้ายสถานะ
 * ลงบรรทัดรองใต้แผนกแทน (ช่องเลขที่สูง 4 บรรทัดอยู่แล้ว)
 * จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px · workflow ดูได้ในหน้าเอกสาร
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showWorkflow: w >= 1208,
    showRequester: w >= 1108,
    wide: w >= 968,
    showStatus: w >= 698,
  };
}

export function useStoreRequisitionTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  containerWidth,
}: UseStoreRequisitionTableOptions) {
  "use no memo";
  const { showStatus, showWorkflow, showRequester, wide } =
    columnTier(containerWidth);
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — audit ซ่อนเป็น default
  // ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    created_at: false,
    updated_at: false,
  });
  const { dateFormat, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const deleteGate = useDeleteGate();

  // ชิปสถานะ + ชื่อ stage — ใช้ทั้งในคอลัมน์สถานะและเป็นบรรทัดรองใต้แผนกในกล่องแคบสุด
  const statusStack = (sr: StoreRequisition) => {
    const status = sr.doc_status as StoreRequisitionStatus;
    const stage = sr.workflow_current_stage;
    return (
      <div data-slot="cell-stack" className="flex min-w-0 flex-col items-start">
        <StatusChip status={status} label={ts(status)} />
        {stage && (
          <span
            className="text-muted-foreground truncate text-xs"
            title={stage}
          >
            {stage}
          </span>
        )}
      </div>
    );
  };

  const dataColumns: ColumnDef<StoreRequisition>[] = [
    {
      accessorKey: "sr_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("srNo")} />
      ),
      // ป้าย "ส่งกลับ" ต่อท้ายเลขที่แทนคอลัมน์ของตัวเอง (ท่าเดียวกับ PR/PO list) —
      // hover ป้ายเพื่อดูเหตุผล · ชนิดใบเป็นบรรทัดรองแทนคอลัมน์ Type ให้ตาราง
      // พอดีจอ 1366px · ชนิดใบไม่มีสี สีสงวนไว้ให้สถานะ
      // data-slot ให้ rowClamp ของ DataGrid ข้ามกล่องนี้
      cell: ({ row }) => {
        const type = row.original.sr_type as StoreRequisitionType | null;
        const no = (
          <CellAction onClick={() => onEdit(row.original)}>
            {row.getValue("sr_no")}
          </CellAction>
        );
        const sendBack = (
          <SrSendBackHint
            srId={row.original.id}
            lastAction={row.original.last_action}
          />
        );
        const typeLine = type && (
          <span className="text-muted-foreground text-xs uppercase">
            {type}
          </span>
        );
        if (wide)
          return (
            <div data-slot="cell-stack" className="flex flex-col items-start">
              <div className="flex items-center gap-1.5">
                {no}
                {sendBack}
              </div>
              {typeLine}
            </div>
          );
        // กล่องแคบ: คอลัมน์วันที่ถูกซ่อน — ชนิด / วันที่ / ป้ายส่งกลับ ลงบรรทัดรองบรรทัดละอย่าง
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            {no}
            {typeLine}
            <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {formatDate(row.original.sr_date, dateFormat)}
            </span>
            {sendBack}
          </div>
        );
      },
      meta: { headerTitle: tfl("srNo"), skeleton: columnSkeletons.text },
      // เลขที่ยาว + ป้าย SEND BACK ไม่ถูกตัดที่ 1366px (ค่าเดียวกับ PO list)
      // กล่องแคบป้ายลงบรรทัดรอง เหลือ 150
      size: wide ? 225 : 150,
    },
    {
      accessorKey: "sr_date",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("date")} />
      ),
      // nowrap — คอลัมน์แคบแล้ววันที่ตัดบรรทัดตรงขีด (2026-04- / 28)
      cell: ({ row }) => (
        <span className="whitespace-nowrap">
          {formatDate(row.getValue("sr_date"), dateFormat)}
        </span>
      ),
      meta: { headerTitle: tfl("date"), skeleton: columnSkeletons.text },
      size: 105,
    },
    {
      accessorKey: "workflow_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("workflow")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.workflow_name ?? undefined}
        >
          {row.original.workflow_name}
        </span>
      ),
      size: 100,
      meta: {
        headerTitle: tfl("workflow"),
        skeleton: columnSkeletons.text,
      },
    },
    {
      // id เป็นชื่อคอลัมน์จริงใน DB เพื่อให้ sort ฝั่ง server ได้ (เรียง From → To = เรียงต้นทาง)
      id: "from_location_name",
      accessorFn: (row) =>
        `${row.from_location_name} → ${row.to_location_name}`,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("fromTo")} />
      ),
      cell: ({ getValue }) => (
        <span className="block truncate" title={getValue<string>()}>
          {getValue<string>()}
        </span>
      ),
      // ข้อความยาวได้ — รับที่เหลือ ไม่ให้คอลัมน์สั้นห่างกันเป็นร้อยพิกเซลที่ 4K · size = ขั้นต่ำ
      meta: {
        headerTitle: tfl("fromTo"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
      size: wide ? 170 : 110,
    },
    {
      accessorKey: "requestor_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("requester")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.requestor_name ?? undefined}
        >
          {row.original.requestor_name}
        </span>
      ),
      meta: { headerTitle: tfl("requester"), skeleton: columnSkeletons.text },
      // 140 ให้ชื่อ-นามสกุลอ่านออก (120 ตัดเหลือ "ศิริวรรณ Purcha…")
      size: 140,
    },
    {
      accessorKey: "department_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("department")} />
      ),
      cell: ({ row }) => (
        <div data-slot="cell-stack" className="flex min-w-0 flex-col">
          <span
            className="block truncate"
            title={row.original.department_name ?? undefined}
          >
            {row.original.department_name}
          </span>
          {/* คอลัมน์สถานะถูกซ่อนในกล่องแคบสุด — ชิปย้ายมาเป็นบรรทัดรอง */}
          {!showStatus && statusStack(row.original)}
          {/* คอลัมน์ผู้ขอถูกซ่อนในกล่องแคบ — ย้ายมาเป็นบรรทัดรอง */}
          {!showRequester && row.original.requestor_name && (
            <span
              className="text-muted-foreground block truncate text-xs"
              title={row.original.requestor_name}
            >
              {row.original.requestor_name}
            </span>
          )}
        </div>
      ),
      // จอกว้าง 160 ให้ "Guest Service and …" อ่านออก · กล่องแคบ 130 ให้พองบ 662
      size: wide ? 160 : 130,
      meta: { headerTitle: tfl("department"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "doc_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      // ชื่อ stage เป็นบรรทัดรองของสถานะ แทนคอลัมน์ Current Stage แยก
      // (ท่าเดียวกับ PR/PO list)
      cell: ({ row }) => statusStack(row.original),
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
      },
      size: 140,
    },
    ...auditColumns<StoreRequisition>(tfl, dateTimeFormat),
  ];

  const allColumns: ColumnDef<StoreRequisition>[] = [
    selectColumn<StoreRequisition>(),
    indexColumn<StoreRequisition>(params),
    ...dataColumns,
    actionColumn<StoreRequisition>(onDelete, {
      ...deleteGate,
      // backend ลบให้เฉพาะ draft (SR_ONLY_DRAFT_DELETABLE) — ปิดปุ่มตั้งแต่ต้น
      // ดีกว่าให้กดยืนยันแล้วค่อยเด้ง error
      deleteDisabledTitle: (r) =>
        r.doc_status === "draft" ? undefined : tc("deleteOnlyDraft"),
      activity: { id: (r) => r.id, label: (r) => r.sr_no },
    }),
  ];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    state: {
      ...tableConfig.state,
      columnVisibility: {
        ...userVisibility,
        ...(!showStatus && { doc_status: false }),
        ...(!showWorkflow && { workflow_name: false }),
        ...(!showRequester && { requestor_name: false }),
        ...(!wide && { sr_date: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
