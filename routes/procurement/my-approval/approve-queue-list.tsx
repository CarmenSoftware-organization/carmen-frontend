import type { ColumnDef } from "@tanstack/react-table";
import { HiddenValue } from "@/components/share/hidden-value";
import { isPriceHidden } from "@/types/workflows";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { Clock } from "lucide-react";
import { StatusChip } from "@/components/ui/status-chip";
import { PR_STATUS_CONFIG } from "@/constant/purchase-request";
import type { ApprovalItem } from "@/types/approval";
import { SlaStatus } from "@/components/share/sla-status";
import { formatDate } from "@/lib/date-utils";
import { Badge } from "@/components/ui/badge";
import { Link, useNavigate } from "react-router";
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
import {
  ListCard,
  ListCardRow,
  ListCardSendBackRow,
  ListCardSkeleton,
} from "@/components/share/list-card";
import { rowNumber } from "@/lib/row-number";

/**
 * ขั้นของคอลัมน์ตามความกว้างของกล่องตาราง (ไม่ใช่ของจอ — sidebar พับ/กางได้)
 *
 * "รายละเอียด" รับที่เหลือ (`meta.grow`) ที่เหลือกว้างคงที่ ตารางจึงกว้างขั้นต่ำเท่าผลรวม `size`:
 * ครบ 1038 (#48 เอกสาร 200 รายละเอียด 240 ผู้ขอ 160 ขั้น 140 ยอด 140 รอ 110) · ไม่มีผู้ขอ 878 ·
 * ไม่มีขั้น + รายละเอียดขั้นต่ำ 200 = 698 · ไม่มีคอลัมน์รอ (ลงใต้ยอด) = 588 (กล่องที่จอ 768 = 660)
 * `#` แสดงตลอดทุกขั้น (2026-11-18 ผู้ใช้ใช้เลขอ้างอิงแถวเวลาคุยกัน) — ขั้นแคบสุดจึงย้าย
 * "รอมาแล้ว" ลงบรรทัดรองใต้ยอดเงินแทน
 * จุดเปลี่ยนตั้งสูงกว่าผลรวมราว 70–80px — คอลัมน์รองกลับมาเมื่อรายละเอียดได้ที่ราว 310px แล้ว
 * ยกเว้นผู้ขอ (1075 = เหลือ 265px) ให้ขึ้นที่จอ 1366 กาง sidebar (กล่อง 1083) และขั้น (885)
 * ให้ขึ้นที่ iPad 1180 (กล่อง 896) — ผู้อนุมัติดูสองคอลัมน์นี้บ่อย
 * แคบกว่า 650 (มือถือ): เลิกเป็นตาราง เปลี่ยนเป็นการ์ดใบละเอกสาร ที่ถือทุกช่องของตาราง
 * (ตารางสามคอลัมน์ที่บีบไว้เดิมต้องซ่อนผู้ขอ/ขั้น/คำอธิบาย ผู้อนุมัติบนมือถือจึงไม่เห็น)
 */
function columnTier(width: number | undefined) {
  const w = width ?? Number.POSITIVE_INFINITY;
  return {
    showRequester: w >= 1075,
    showStage: w >= 885,
    showWaiting: w >= 703,
    cardView: w < 650,
  };
}

/** ยอดเงินของหนึ่งใบ — SR ไม่มียอด (0 ของมันไม่ใช่ศูนย์บาทจริง) · ใช้ทั้งตารางและการ์ด */
function ApprovalAmount({ item }: { readonly item: ApprovalItem }) {
  const formatAmount = useAmountFormatter();
  if (item.doc_type === "sr") {
    return <span className="text-muted-foreground">—</span>;
  }
  if (isPriceHidden(item.hidden_fields, "total_price")) {
    return <HiddenValue />;
  }
  return (
    <span className="text-xs whitespace-nowrap tabular-nums">
      {formatAmount(item.total_amount)}
      <span className="text-muted-foreground ml-1">{item.currency_code}</span>
    </span>
  );
}

/**
 * จำนวนวันที่รอ (สีตามความเร่ง) + วันที่เอกสาร + SLA ของ stage ที่รออยู่ — ใช้ทั้งตารางและการ์ด
 * SLA อยู่ในช่องนี้เพราะช่อง "รอมาแล้ว" แสดงทุกขนาดกล่อง (คอลัมน์ · ใต้ยอดเมื่อกล่องแคบ · แถวในการ์ด)
 */
function WaitingDays({
  item,
  dateFormat,
  today,
  now,
}: {
  readonly item: ApprovalItem;
  readonly dateFormat: string;
  readonly today: Date;
  readonly now: Date;
}) {
  const t = useTranslations("procurement.approval");
  const docDate = item.doc_date;
  const sla = (
    <SlaStatus
      dueAt={item.sla_due_at}
      minutes={item.sla_minutes}
      now={now}
      className="text-right"
    />
  );
  if (!docDate) {
    return (
      <div data-slot="cell-stack" className="flex flex-col items-end">
        <span className="text-muted-foreground">—</span>
        {sla}
      </div>
    );
  }
  const days = Math.max(0, differenceInCalendarDays(today, new Date(docDate)));
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
        {formatDate(docDate, dateFormat)}
      </span>
      {sla}
    </div>
  );
}

/** ขั้นของ workflow — ใบที่ยังไม่มีขั้น (เช่น PO ที่ไม่ผูก stage) ถอยไปโชว์สถานะเอกสาร */
function StageValue({ item }: { readonly item: ApprovalItem }) {
  const { workflow_current_stage: stage, status } = item;
  if (stage) return <span className="truncate text-xs">{stage}</span>;
  const config = PR_STATUS_CONFIG[status || "draft"] ?? PR_STATUS_CONFIG.draft;
  return <StatusChip status={status || "draft"} label={config.label} />;
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

  const navigate = useNavigate();
  // ลบขอบ 1px สองข้างของ DataGridContainer ออก ได้ความกว้างที่ตารางใช้จริง
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const { showRequester, showStage, showWaiting, cardView } = columnTier(
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
  const now = new Date();
  const today = startOfDay(now);

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
        return (
          // data-slot ให้ rowClamp ของ DataGrid ข้ามกล่องนี้ — ไม่งั้นมันกลายเป็น
          // -webkit-box แล้วสองบรรทัดถูกบีบเป็นบรรทัดเดียว
          <div
            data-slot="cell-stack"
            className="flex max-w-full flex-col items-start gap-1"
          >
            <div className="flex items-center gap-1.5">
              <Badge variant={typeConfig?.variant ?? "secondary"} size="xs">
                {typeConfig?.label ?? item.doc_type.toUpperCase()}
              </Badge>
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
            <SendBackStatus lastAction={item.last_action} />
          </div>
        );
      },
      size: 200,
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
      cell: ({ row }) => <StageValue item={row.original} />,
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
      cell: ({ row }) =>
        showWaiting ? (
          <ApprovalAmount item={row.original} />
        ) : (
          // คอลัมน์ "รอมาแล้ว" ถูกซ่อนในกล่องแคบสุด — ย้ายมาเป็นบรรทัดรองใต้ยอด
          <div data-slot="cell-stack" className="flex flex-col items-end">
            <ApprovalAmount item={row.original} />
            <WaitingDays
              item={row.original}
              dateFormat={dateFormat}
              today={today}
              now={now}
            />
          </div>
        ),
      size: 140,
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
      cell: ({ row }) => (
        <WaitingDays
          item={row.original}
          dateFormat={dateFormat}
          today={today}
          now={now}
        />
      ),
      size: 110,
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
        doc_date: showWaiting,
        requestor_name: showRequester,
        workflow_current_stage: showStage,
      },
    },
  });

  const emptyMessage = (
    <EmptyComponent
      icon={Clock}
      title={t("noPendingApprovals")}
      description={t("noPendingApprovalsDesc")}
    />
  );

  // กล่องที่ผูก ref วัดความกว้างต้องอยู่ทั้งสองโหมด ไม่งั้นสลับกลับเป็นตารางไม่ได้
  return (
    <div ref={setGridBox}>
      <DataGrid
        table={table}
        recordCount={totalRecords}
        isLoading={isLoading}
        emptyMessage={emptyMessage}
        tableLayout={{ headerSticky: true }}
      >
        {cardView ? (
          <div className="flex flex-col gap-2">
            {isLoading
              ? Array.from({ length: 3 }).map((_, i) => (
                  <ListCardSkeleton
                    key={`skeleton-${i}`}
                    rows={6}
                    hasFooter={false}
                  />
                ))
              : items.length === 0
                ? emptyMessage
                : items.map((item, i) => {
                    const typeConfig = DOC_TYPE_CONFIG[item.doc_type];
                    return (
                      <ListCard
                        rowNo={rowNumber(params, i)}
                        key={`${item.doc_type}-${item.id}`}
                        title={item.doc_no}
                        onOpen={
                          typeConfig
                            ? () => navigate(typeConfig.href(item.id))
                            : undefined
                        }
                        badge={
                          <span className="flex shrink-0 items-center gap-1.5">
                            {multiBu && (
                              <Badge variant="outline" size="xs">
                                {item.bu_code}
                              </Badge>
                            )}
                            <Badge
                              variant={typeConfig?.variant ?? "secondary"}
                              size="xs"
                            >
                              {typeConfig?.label ?? item.doc_type.toUpperCase()}
                            </Badge>
                          </span>
                        }
                      >
                        <ListCardRow label={t("details")}>
                          {item.vendor_name || item.department_name || "—"}
                        </ListCardRow>
                        {item.description && (
                          <ListCardRow label={tfl("description")}>
                            {item.description}
                          </ListCardRow>
                        )}
                        <ListCardRow label={tfl("requester")}>
                          {item.requestor_name || "—"}
                        </ListCardRow>
                        <ListCardRow label={tfl("stage")}>
                          <StageValue item={item} />
                        </ListCardRow>
                        <ListCardRow label={tfl("amount")}>
                          <ApprovalAmount item={item} />
                        </ListCardRow>
                        <ListCardRow label={t("waiting")}>
                          <WaitingDays
                            item={item}
                            dateFormat={dateFormat}
                            today={today}
                            now={now}
                          />
                        </ListCardRow>
                        <ListCardSendBackRow lastAction={item.last_action} />
                      </ListCard>
                    );
                  })}
            <DataGridPagination className="bg-card rounded-xl border" />
          </div>
        ) : (
          <DataGridContainer className="flex max-h-[calc(100vh-13rem-3rem)] flex-col">
            <DataGridScrollArea>
              <DataGridTable />
            </DataGridScrollArea>
            <DataGridPagination />
          </DataGridContainer>
        )}
      </DataGrid>
    </div>
  );
}
