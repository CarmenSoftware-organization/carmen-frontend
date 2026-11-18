import type React from "react";
import { useState } from "react";
import type {
  ColumnDef,
  DisplayColumnDef,
  OnChangeFn,
  RowSelectionState,
  VisibilityState,
} from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { useNavigate } from "react-router";
import { listReturnState } from "@/hooks/use-list-return";
import {
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Copy,
  Trash2,
} from "lucide-react";
import { dispatchPermissionDenied } from "@/components/permission-denied-dialog";
import { useCreatableWorkflows } from "@/hooks/use-workflow";
import { WORKFLOW_TYPE, isPriceHidden } from "@/types/workflows";
import { HiddenValue } from "@/components/share/hidden-value";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import { CellAction } from "@/components/ui/cell-action";
import {
  auditColumns,
  columnSkeletons,
  customActionColumn,
  indexColumn,
} from "@/components/ui/data-grid/columns";
import { PrSendBackHint } from "./pr-send-back-hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatAmount } from "@/lib/currency-utils";
import { StatusChip } from "@/components/ui/status-chip";
import { PR_STATUS_CONFIG } from "@/constant/purchase-request";
import type { PurchaseRequest } from "@/types/purchase-request";
import { PR_STATUS } from "@/types/purchase-request";
import type { ParamsDto } from "@/types/params";
import type { useDataGridState } from "@/hooks/use-data-grid-state";

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "แผนก" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`
 * (ไม่นับ audit ที่ซ่อนเป็น default) — All documents ไม่มีช่องติ๊ก 55 + ปุ่มแถว 60 จึงลบ 115:
 * ครบ 1075 / 960 (ติ๊ก 55 # 60 เลขที่ 210 วันที่ 95 workflow 100 สถานะ 140 ผู้ขอ 110
 * แผนก 125 ยอด 120 ปุ่ม 60) · ไม่มี # 1015 / 900 · ไม่มี workflow 915 / 800 ·
 * กล่องแคบ (วันที่+ป้ายส่งกลับลงใต้เลขที่ เลขที่ 150) 760 / 645 · ไม่มีผู้ขอ 650 / 535
 * — กล่องที่จอ 768 = 660 · จุดเปลี่ยนสูงกว่าผลรวมของขั้นนั้น 5px
 * กล่องกว้างมาก (≥1400 หลังหัก) ผู้ขอ 110→200 — ผลรวมครบ 1050 ยังต่ำกว่าจุดเปลี่ยน
 * ยุบวันที่ลงใต้เลขที่**ก่อน**ซ่อนผู้ขอ — คอลัมน์เลขที่ 210 ใช้จริงแค่ ~90px (ที่ 1024
 * กางเมนู แผนกเหลือ 177 ถูกตัด ทั้งที่ยุบวันที่แล้วได้คอลัมน์ผู้ขอคืนมาด้วย)
 * ผู้ขอที่ถูกซ่อนย้ายเป็นบรรทัดรองใต้แผนก · # และ workflow ดูได้ในหน้าเอกสาร
 */
function columnTier(width: number | undefined, isMyPending: boolean) {
  const w = (width ?? Number.POSITIVE_INFINITY) - (isMyPending ? 115 : 0);
  return {
    showIndex: w >= 965,
    showWorkflow: w >= 905,
    roomy: w >= 1400,
    wide: w >= 805,
    showRequester: w >= 650,
  };
}

interface UsePurchaseRequestTableOptions {
  items: PurchaseRequest[];
  totalRecords: number;
  params: ParamsDto;
  tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
  onEdit: (item: PurchaseRequest) => void;
  onDelete: (item: PurchaseRequest) => void;
  onApprove?: (item: PurchaseRequest) => void;
  onReject?: (item: PurchaseRequest) => void;
  isMyPending?: boolean;
  onRowSelect?: (item: PurchaseRequest, next: boolean) => void;
  onSelectAll?: () => void;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** ความกว้างกล่องตาราง (px) — `undefined` = ยังไม่ได้วัด ใช้ชุดคอลัมน์จอกว้าง */
  containerWidth?: number;
}

export function usePrTable({
  items,
  totalRecords,
  params,
  tableConfig,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  isMyPending = true,
  onRowSelect,
  onSelectAll,
  rowSelection,
  onRowSelectionChange,
  containerWidth,
}: UsePurchaseRequestTableOptions) {
  "use no memo";
  const { showIndex, showWorkflow, showRequester, wide, roomy } = columnTier(
    containerWidth,
    isMyPending,
  );
  // คอลัมน์ที่ผู้ใช้เปิด/ปิดเองจากเมนู Toggle Columns — audit ซ่อนเป็น default
  // ขั้นตามความกว้างกล่องทับเฉพาะคอลัมน์ที่บังคับซ่อน
  const [userVisibility, setUserVisibility] = useState<VisibilityState>({
    created_at: false,
    updated_at: false,
  });
  const { dateFormat, dateTimeFormat, amountFormat, defaultCurrencyCode } =
    useProfile();
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const t = useTranslations("procurement.purchaseRequest");
  const navigate = useNavigate();
  const { canCreate: canCreatePr } = useCreatableWorkflows(WORKFLOW_TYPE.PR);
  const handleDuplicate = (item: PurchaseRequest) => {
    if (!canCreatePr) {
      dispatchPermissionDenied(undefined, t("noCreatableWorkflow"));
      return;
    }
    navigate(
      `/procurement/purchase-request/new?duplicate_id=${item.id}`,
      listReturnState(),
    );
  };

  const dataColumns: ColumnDef<PurchaseRequest>[] = [
    {
      accessorKey: "pr_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("prNo")} />
      ),
      // ป้าย "ส่งกลับ" ต่อท้ายเลขที่แทนคอลัมน์ของตัวเอง — ใบที่ถูกตีกลับมีไม่กี่ใบ
      // คอลัมน์แยกจึงว่างเกือบทุกแถวแต่กินที่ 110px · hover ป้ายเพื่อดูเหตุผล
      // data-slot ให้ rowClamp ของ DataGrid ข้ามกล่องนี้ ไม่งั้นลูกถูกแปลงเป็น -webkit-box
      cell: ({ row }) => {
        const sendBack = (
          <PrSendBackHint
            prId={row.original.id}
            lastAction={row.original.last_action}
          />
        );
        if (wide)
          return (
            <div data-slot="cell-stack" className="flex items-center gap-2">
              <CellAction onClick={() => onEdit(row.original)}>
                {row.original.pr_no}
              </CellAction>
              {sendBack}
            </div>
          );
        // กล่องแคบ: คอลัมน์วันที่ถูกซ่อน — วันที่ + ป้ายส่งกลับลงบรรทัดรองใต้เลขที่
        return (
          <div data-slot="cell-stack" className="flex flex-col items-start">
            <CellAction onClick={() => onEdit(row.original)}>
              {row.original.pr_no}
            </CellAction>
            <div className="flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                {formatDate(row.original.pr_date, dateFormat)}
              </span>
              {sendBack}
            </div>
          </div>
        );
      },
      // 210 = เลขที่ยาว (PR20260400051) + ป้าย SEND BACK ไม่ถูกตัดที่ 1366px
      // (200 ขาดไป 2px — เซลล์มี padding 12px สองข้าง) · กล่องแคบป้ายลงบรรทัดรอง เหลือ 150
      size: wide ? 210 : 150,
      meta: { headerTitle: tfl("prNo"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "pr_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("date")}
          className="justify-center"
        />
      ),
      cell: ({ row }) => formatDate(row.original.pr_date, dateFormat),
      size: 95,
      meta: {
        headerTitle: tfl("date"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-center",
      },
    },
    {
      accessorKey: "workflow_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("workflow")} />
      ),
      cell: ({ row }) => (
        <span
          className="wrap-break-word whitespace-normal"
          title={row.original.workflow_name ?? undefined}
        >
          {row.original.workflow_name}
        </span>
      ),
      meta: {
        headerTitle: tfl("workflow"),
        skeleton: columnSkeletons.text,
      },
      size: 100,
    },
    {
      accessorKey: "pr_status",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("status")} />
      ),
      // ชื่อ stage เป็นบรรทัดรองของสถานะ แทนคอลัมน์ Stage แยก — สองคอลัมน์นั้นพูด
      // เรื่องเดียวกันซ้ำ (Create Request คู่ DRAFT, Completed คู่ COMPLETED)
      cell: ({ row }): React.ReactNode => {
        const { pr_status: status, workflow_current_stage: stage } =
          row.original;
        const config = PR_STATUS_CONFIG[status] ?? PR_STATUS_CONFIG.draft;
        return (
          <div data-slot="cell-stack" className="flex min-w-0 flex-col">
            <StatusChip status={status} label={config.label} />
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
      // กล่องกว้างมาก (4K) ชื่อเต็มไม่ถูกตัด — แผนกยืดอยู่แล้ว ไม่เสียอะไร
      size: roomy ? 200 : 110,
    },
    {
      // ก่อนแผนก (คอลัมน์ยืด) — วางหลังแผนกแล้วที่ 4K ยอดเงินห่างจากข้อมูลอื่น ~2,700px
      accessorKey: "base_total_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("amount")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        if (isPriceHidden(row.original.hidden_fields, "total_price"))
          return <HiddenValue />;
        const amount = row.original.base_total_amount;
        if (amount == null) return <span></span>;
        return (
          <p className="font-medium whitespace-nowrap tabular-nums">
            {formatAmount(amount, amountFormat)}
            <span className="text-muted-foreground ms-1 text-xs font-normal">
              {defaultCurrencyCode}
            </span>
          </p>
        );
      },
      meta: {
        headerTitle: tfl("amount"),
        skeleton: columnSkeletons.text,
        cellClassName: "text-right",
        headerClassName: "text-right",
      },
      size: 120,
    },
    {
      accessorKey: "department_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("department")} />
      ),
      // คอลัมน์ข้อความที่ยาวได้ — รับที่เหลือ ไม่ให้คอลัมน์สั้นห่างกันเป็นร้อยพิกเซลที่ 4K
      // size = ความกว้างขั้นต่ำ
      size: 125,
      cell: ({ row }) => (
        <div data-slot="cell-stack" className="flex min-w-0 flex-col">
          <span
            className="block truncate"
            title={row.original.department_name ?? undefined}
          >
            {row.original.department_name}
          </span>
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
      meta: {
        headerTitle: tfl("department"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    ...auditColumns<PurchaseRequest>(tfl, dateTimeFormat),
  ];

  const prActionColumn = customActionColumn<PurchaseRequest>(({ row }) => {
    const item = row.original;
    const isDraft = item.pr_status === PR_STATUS.DRAFT;
    const isPendingApproval = item.pr_status === PR_STATUS.IN_PROGRESS;

    return (
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-xs" aria-label="Actions">
              <MoreHorizontal aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onApprove && isPendingApproval && (
              <DropdownMenuItem
                className="cursor-pointer font-semibold tracking-wide"
                onClick={() => onApprove(item)}
              >
                <CheckCircle2
                  className="text-success-ink size-3"
                  aria-hidden="true"
                />
                {tc("approve")}
              </DropdownMenuItem>
            )}

            {onReject && isPendingApproval && (
              <DropdownMenuItem
                className="cursor-pointer font-semibold tracking-wide"
                onClick={() => onReject(item)}
              >
                <XCircle
                  className="text-destructive size-3"
                  aria-hidden="true"
                />
                {tc("reject")}
              </DropdownMenuItem>
            )}

            {(onApprove || onReject) && isPendingApproval && (
              <DropdownMenuSeparator />
            )}

            <DropdownMenuItem onClick={() => handleDuplicate(item)}>
              <Copy aria-hidden="true" />
              {tc("duplicate")}
            </DropdownMenuItem>

            {isDraft && (
              <DropdownMenuItem
                onClick={() => onDelete(item)}
                variant={"destructive"}
              >
                <Trash2 className="text-destructive" aria-hidden="true" />
                {tc("delete")}
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    );
  });

  const prSelectColumn: DisplayColumnDef<PurchaseRequest> = {
    id: "select",
    enableSorting: false,
    enableHiding: false,
    enableResizing: false,
    size: 55,
    meta: {
      headerClassName: "text-center print:hidden",
      cellClassName: "text-center print:hidden",
      skeleton: columnSkeletons.checkbox,
    },
    header: ({ table }) => {
      const isAllSelected = table.getIsAllPageRowsSelected();
      const isSomeSelected = table.getIsSomePageRowsSelected();
      return (
        <Checkbox
          checked={
            isSomeSelected && !isAllSelected ? "indeterminate" : isAllSelected
          }
          disabled={items.length === 0}
          onCheckedChange={() => onSelectAll?.()}
          aria-label={tc("aria.selectAll")}
          className="align-[inherit]"
        />
      );
    },
    cell: ({ row }) => (
      <>
        {row.getIsSelected() && (
          <div className="bg-primary absolute inset-s-0 top-0 bottom-0 w-0.5 rounded-full" />
        )}
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(value) => onRowSelect?.(row.original, !!value)}
          aria-label={tc("aria.selectRow")}
          className="align-[inherit]"
        />
      </>
    ),
  };

  const allColumns: ColumnDef<PurchaseRequest>[] = [
    // all-document ไม่มี batch approve/reject ให้ทำ เลยไม่ต้องมีช่องติ๊ก
    ...(isMyPending ? [prSelectColumn] : []),
    indexColumn<PurchaseRequest>(params),
    ...dataColumns,
    ...(isMyPending ? [prActionColumn] : []),
  ];

  return useReactTable({
    data: items,
    columns: allColumns,
    getCoreRowModel: getCoreRowModel(),
    enableRowSelection: isMyPending,
    ...tableConfig,
    // key ของ selection เป็น pr id ไม่ใช่เลข index แถว — ข้อมูลถูกลบ/เรียงใหม่แล้ว
    // ที่ติ๊กไว้ยังชี้ใบเดิม
    getRowId: (row) => row.id,
    state: {
      ...tableConfig.state,
      rowSelection,
      columnVisibility: {
        ...userVisibility,
        ...(!showIndex && { index: false }),
        ...(!showWorkflow && { workflow_name: false }),
        ...(!showRequester && { requestor_name: false }),
        ...(!wide && { pr_date: false }),
      },
    },
    onColumnVisibilityChange: setUserVisibility,
    onRowSelectionChange,
    pageCount: Math.ceil(totalRecords / (Number(params.perpage) || 10)),
  });
}
