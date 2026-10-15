import type { ColumnDef } from "@tanstack/react-table";
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
import { StatusIconLabel } from "@/components/ui/status-icon-label";

interface UseStoreRequisitionTableOptions {
  items: StoreRequisition[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: StoreRequisition) => void;
  onDelete: (item: StoreRequisition) => void;
}

export function useStoreRequisitionTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
}: UseStoreRequisitionTableOptions) {
  "use no memo";
  const { dateFormat, dateTimeFormat } = useProfile();
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const ts = useTranslations("status");
  const deleteGate = useDeleteGate();

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
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            <div className="flex items-center gap-1.5">
              <CellAction onClick={() => onEdit(row.original)}>
                {row.getValue("sr_no")}
              </CellAction>
              <SrSendBackHint
                srId={row.original.id}
                lastAction={row.original.last_action}
              />
            </div>
            {type && (
              <span className="text-muted-foreground text-xs uppercase">
                {type}
              </span>
            )}
          </div>
        );
      },
      meta: { headerTitle: tfl("srNo"), skeleton: columnSkeletons.text },
      // เลขที่ยาว + ป้าย SEND BACK ไม่ถูกตัดที่ 1366px (ค่าเดียวกับ PO list)
      size: 225,
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
      meta: { headerTitle: tfl("fromTo"), skeleton: columnSkeletons.text },
      size: 170,
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
      size: 120,
    },
    {
      accessorKey: "department_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("department")} />
      ),
      cell: ({ row }) => (
        <span
          className="block truncate"
          title={row.original.department_name ?? undefined}
        >
          {row.original.department_name}
        </span>
      ),
      size: 130,
      meta: { headerTitle: tfl("department"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "doc_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      // ชื่อ stage เป็นบรรทัดรองของสถานะ แทนคอลัมน์ Current Stage แยก
      // (ท่าเดียวกับ PR/PO list)
      cell: ({ row }) => {
        const status = row.getValue("doc_status") as StoreRequisitionStatus;
        const stage = row.original.workflow_current_stage;
        return (
          <div data-slot="cell-stack" className="flex min-w-0 flex-col">
            <StatusIconLabel
              status={status}
              label={ts(status)}
              // uppercase ด้วย CSS ไม่ใช่ .toUpperCase() — ค่าที่ export/คัดลอก
              // ยังเป็นข้อความเดิม และภาษาไทยที่ไม่มีตัวพิมพ์ใหญ่ก็ไม่โดนแตะ
              // (ต่างจากโมดูลอื่นที่ label uppercase มาจาก createStatusConfig แล้ว)
              className="uppercase"
            />
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
      },
      meta: {
        headerTitle: tfl("status"),
        skeleton: columnSkeletons.badge,
      },
      size: 140,
    },
    {
      accessorKey: "workflow_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("workflowStage")} />
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
        headerTitle: tfl("workflowStage"),
        skeleton: columnSkeletons.text,
      },
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
    initialState: {
      columnVisibility: { created_at: false, updated_at: false },
    },
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
