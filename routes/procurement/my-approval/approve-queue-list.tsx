import type { ColumnDef } from "@tanstack/react-table";
import { HiddenValue } from "@/components/share/hidden-value";
import { isPriceHidden } from "@/types/workflows";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { Clock } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import { PR_STATUS_CONFIG } from "@/constant/purchase-request";
import type { ApprovalItem } from "@/types/approval";
import { formatDate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router";
import {
  columnSkeletons,
  indexColumn,
} from "@/components/ui/data-grid/columns";
import { SendBackStatus } from "@/components/share/sendback-status";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { DataGridColumnHeader } from "@/components/ui/data-grid/data-grid-column-header";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import type { useDataGridState } from "@/hooks/use-data-grid-state";
import type { ParamsDto } from "@/types/params";
import EmptyComponent from "@/components/empty-component";
import { useElementWidth } from "@/hooks/use-element-width";

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "รายละเอียด" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`:
 * ครบ 1050 (#60 เอกสาร 200 รายละเอียด 240 ผู้ขอ 160 ขั้น 140 ยอด 140 รอ 110) · ไม่มีผู้ขอ 890 ·
 * ไม่มีเลขลำดับ 830 · ไม่มีขั้น + รายละเอียดขั้นต่ำ 200 = 650 (กล่องที่จอ 768 = 660)
 * จุดเปลี่ยนตั้งสูงกว่าผลรวมราว 70–80px — คอลัมน์รองกลับมาเมื่อรายละเอียดได้ที่ราว 310px แล้ว
 * ยกเว้นผู้ขอ (1075 = เหลือ 265px) ให้ขึ้นที่จอ 1366 กาง sidebar (กล่อง 1083) และขั้น (885)
 * ให้ขึ้นที่ iPad 1180 (กล่อง 896) — ผู้อนุมัติดูสองคอลัมน์นี้บ่อย
 * แคบกว่า 650 (มือถือ): ตัดคอลัมน์รายละเอียด ย้ายผู้ขาย/แผนกเป็นบรรทัดรองใต้เลขเอกสาร
 * และเลิก grow ให้สามคอลัมน์ที่เหลือแบ่งตามสัดส่วน · ของที่ซ่อนยังดูได้ในหน้าเอกสาร
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showRequester: w >= 1075,
    showIndex: w >= 970,
    showStage: w >= 885,
    showDetails: w >= 650,
  };
}

interface ApprovalQueueListProps {
  readonly items: ApprovalItem[];
  readonly totalRecords: number;
  readonly isLoading: boolean;
  readonly dateFormat: string;
  readonly params: ParamsDto;
  readonly tableConfig: ReturnType<typeof useDataGridState>["tableConfig"];
}

export default function ApprovalQueueList({
  items,
  totalRecords,
  isLoading,
  dateFormat,
  params,
  tableConfig,
}: ApprovalQueueListProps) {
  "use no memo";
  const t = useTranslations("procurement.approval");
  const tfl = useTranslations("field");

  const formatAmount = useAmountFormatter();
  // ลบขอบ 1px สองข้างของ DataGridContainer ออก ได้ความกว้างที่ตารางใช้จริง
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const { showRequester, showIndex, showStage, showDetails } = columnTier(
    gridBoxWidth == null ? undefined : gridBoxWidth - 2,
  );

  const DOC_TYPE_CONFIG: Record<
    string,
    {
      label: string;
      variant: "info" | "warning" | "success";
      href: (id: string) => string;
    }
  > = {
    pr: {
      label: t("pr"),
      variant: "info",
      href: (id) => `/procurement/purchase-request/${id}`,
    },
    po: {
      label: t("po"),
      variant: "warning",
      href: (id) => `/procurement/purchase-order/${id}`,
    },
    sr: {
      label: t("sr"),
      variant: "success",
      href: (id) => `/store-operation/store-requisition/${id}`,
    },
  };

  // ป้าย BU โชว์เฉพาะเมื่อหน้านี้มีเอกสารจากหลายหน่วยธุรกิจปนกัน — ถ้ามีหน่วยเดียว
  // ป้ายเดียวกันซ้ำทุกแถวไม่ได้บอกอะไร
  const multiBu = new Set(items.map((i) => i.bu_code)).size > 1;
  const today = startOfDay(new Date());

  const columns: ColumnDef<ApprovalItem>[] = [
    indexColumn<ApprovalItem>(params),
    {
      accessorKey: "doc_no",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("document")} />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const typeConfig = DOC_TYPE_CONFIG[item.doc_type];
        const typeBadge = (
          <Badge variant={typeConfig?.variant ?? "secondary"} size="xs">
            {typeConfig?.label ?? item.doc_type.toUpperCase()}
          </Badge>
        );
        return (
          // data-slot ให้ rowClamp ของ DataGrid ข้ามกล่องนี้ — ไม่งั้นมันกลายเป็น
          // -webkit-box แล้วสองบรรทัดถูกบีบเป็นบรรทัดเดียว
          <div
            data-slot="cell-stack"
            className="flex max-w-full flex-col items-start gap-1"
          >
            <div className="flex items-center gap-1.5">
              {showDetails && typeBadge}
              <Link
                to={typeConfig?.href(item.id) ?? "#"}
                className="text-primary text-xs font-semibold whitespace-nowrap hover:underline"
              >
                {item.doc_no}
              </Link>
              {multiBu && (
                <Badge variant="outline" size="xs">
                  {item.bu_code}
                </Badge>
              )}
            </div>
            {/* กล่องแคบ: คอลัมน์รายละเอียดถูกซ่อน — ป้ายประเภทลงมาคู่กับผู้ขาย/แผนก
                ใต้เลขเอกสาร ให้เลขเอกสารได้ทั้งบรรทัด (ป้าย + เลข 136px ไม่พอในคอลัมน์มือถือ) */}
            {!showDetails && (
              <div className="flex max-w-full min-w-0 items-center gap-1.5">
                {typeBadge}
                {(item.vendor_name || item.department_name) && (
                  <span className="text-muted-foreground truncate text-xs">
                    {item.vendor_name || item.department_name}
                  </span>
                )}
              </div>
            )}
            <SendBackStatus lastAction={item.last_action} />
          </div>
        );
      },
      // กล่องแคบไม่มีคอลัมน์ grow → แบ่งตามสัดส่วน 130 : 90 : 95 (มือถือ 332px ≈ 137/95/100)
      // เนื้อหาที่ต้องการ: เลขเอกสาร 102 · ยอด 67 · วันที่ 70 (+ padding 24 ทุกช่อง)
      size: showDetails ? 200 : 130,
      meta: { headerTitle: t("document"), skeleton: columnSkeletons.text },
    },
    {
      // PO → ผู้ขาย · SR → ต้นทาง → ปลายทาง (มาใน counterparty_name ทั้งคู่)
      // PR ไม่มีคู่ค้า จึงใช้แผนกแทน · description เป็นบรรทัดรอง (ว่างบ่อย)
      id: "details",
      accessorFn: (row) => row.vendor_name || row.department_name,
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={t("details")} />
      ),
      cell: ({ row }) => {
        const item = row.original;
        const primary = item.vendor_name || item.department_name;
        return (
          <div data-slot="cell-stack" className="flex min-w-0 flex-col">
            <span className="truncate text-xs">{primary || "—"}</span>
            {item.description && (
              <span className="text-muted-foreground truncate text-xs">
                {item.description}
              </span>
            )}
          </div>
        );
      },
      enableSorting: false,
      // คอลัมน์ข้อความยาวคอลัมน์เดียว — รับที่เหลือ ไม่ให้คอลัมน์สั้นห่างกันบนจอกว้าง
      size: showStage ? 240 : 200,
      meta: {
        headerTitle: t("details"),
        skeleton: columnSkeletons.text,
        grow: true,
      },
    },
    {
      accessorKey: "requestor_name",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("requester")} />
      ),
      cell: ({ row }) => (
        <span className="truncate text-xs">
          {row.original.requestor_name || "—"}
        </span>
      ),
      size: 160,
      meta: { headerTitle: tfl("requester"), skeleton: columnSkeletons.text },
    },
    {
      // ขั้นของ workflow คือสิ่งที่ผู้อนุมัติสนใจ — ใบที่ยังไม่มีขั้น (เช่น PO ที่ไม่ผูก
      // workflow stage) ถอยไปโชว์สถานะเอกสารแทน จะได้ไม่เป็นช่องว่าง
      accessorKey: "workflow_current_stage",
      header: ({ column }) => (
        <DataGridColumnHeader column={column} title={tfl("stage")} />
      ),
      cell: ({ row }) => {
        const { workflow_current_stage: stage, status } = row.original;
        if (stage) return <span className="truncate text-xs">{stage}</span>;
        const config =
          PR_STATUS_CONFIG[status || "draft"] ?? PR_STATUS_CONFIG.draft;
        return <StatusChip status={status || "draft"} label={config.label} />;
      },
      size: 140,
      meta: { headerTitle: tfl("stage"), skeleton: columnSkeletons.text },
    },
    {
      accessorKey: "total_amount",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={tfl("amount")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const item = row.original;
        // ใบเบิกสินค้าไม่มียอดเงิน — 0 ของมันไม่ใช่ศูนย์บาทจริง
        if (item.doc_type === "sr") {
          return <span className="text-muted-foreground">—</span>;
        }
        if (isPriceHidden(item.hidden_fields, "total_price")) {
          return <HiddenValue />;
        }
        // กล่องแคบ: สกุลเงินลงบรรทัดรอง ไม่งั้นยอดหกหลักถูกตัดในคอลัมน์ ~90px
        return (
          <span
            data-slot="cell-stack"
            className={cn(
              "text-xs whitespace-nowrap tabular-nums",
              !showDetails && "flex flex-col items-end",
            )}
          >
            {formatAmount(item.total_amount)}
            <span
              className={cn("text-muted-foreground", showDetails && "ml-1")}
            >
              {item.currency_code}
            </span>
          </span>
        );
      },
      size: showDetails ? 140 : 90,
      meta: {
        headerTitle: tfl("amount"),
        cellClassName: "text-right",
        headerClassName: "text-right",
        skeleton: columnSkeletons.text,
      },
    },
    {
      // เรียงด้วย doc_date (คีย์ใน allowlist ของ backend) — รอนานสุด = วันที่เก่าสุด
      accessorKey: "doc_date",
      header: ({ column }) => (
        <DataGridColumnHeader
          column={column}
          title={t("waiting")}
          className="justify-end"
        />
      ),
      cell: ({ row }) => {
        const { doc_date } = row.original;
        if (!doc_date) return <span className="text-muted-foreground">—</span>;
        const days = Math.max(
          0,
          differenceInCalendarDays(today, new Date(doc_date)),
        );
        return (
          <div data-slot="cell-stack" className="flex flex-col items-end">
            <span
              className={cn(
                "text-xs font-semibold tabular-nums",
                days > 7
                  ? "text-destructive"
                  : days > 3
                    ? "text-warning-ink"
                    : "text-muted-foreground",
              )}
            >
              {t("daysWaiting", { count: days })}
            </span>
            <span className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
              {formatDate(doc_date, dateFormat)}
            </span>
          </div>
        );
      },
      size: showDetails ? 110 : 95,
      meta: {
        headerTitle: t("waiting"),
        cellClassName: "text-right",
        headerClassName: "text-right",
        skeleton: columnSkeletons.text,
      },
    },
  ];

  const pageSize = tableConfig.state.pagination.pageSize;

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / pageSize),
    state: {
      ...tableConfig.state,
      columnVisibility: {
        index: showIndex,
        details: showDetails,
        requestor_name: showRequester,
        workflow_current_stage: showStage,
      },
    },
  });

  return (
    <div ref={setGridBox}>
      <DataGrid
        table={table}
        recordCount={totalRecords}
        isLoading={isLoading}
        emptyMessage={
          <EmptyComponent
            icon={Clock}
            title={t("noPendingApprovals")}
            description={t("noPendingApprovalsDesc")}
          />
        }
        tableLayout={{ headerSticky: true }}
      >
        <DataGridContainer className="flex max-h-[calc(100vh-13rem-3rem)] flex-col">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination />
        </DataGridContainer>
      </DataGrid>
    </div>
  );
}
