import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useLocale, useTranslations } from "use-intl";
import { useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, type LucideIcon } from "lucide-react";
import {
  type ColumnDef,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import EmptyComponent from "@/components/empty-component";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { useBuCode } from "@/hooks/use-bu-code";
import { QUERY_KEYS } from "@/constant/query-keys";
import { formatLocalizedDate } from "@/lib/date-utils";
import { CN_STATUS_CONFIG } from "@/constant/credit-note";
import { GRN_STATUS_CONFIG } from "@/constant/goods-receive-note";
import { IA_STATUS_CONFIG } from "@/constant/inventory-adjustment";
import { PO_STATUS_CONFIG } from "@/constant/purchase-order";
import { PR_STATUS_CONFIG } from "@/constant/purchase-request";
import { SR_STATUS_CONFIG } from "@/constant/store-requisition";
import type { StatusConfig } from "@/constant/status-config";
import type {
  ReviewDocument,
  ReviewGroupCounts,
  ReviewGroupFilter,
  ReviewTransactionKey,
  ReviewTransactionStat,
} from "@/types/period-end";
import { buildDocumentPath } from "./pe-document-paths";
import { useReviewDocuments } from "./use-review-documents";

const STATUS_CONFIGS: Record<ReviewTransactionKey, StatusConfig> = {
  pr: PR_STATUS_CONFIG,
  po: PO_STATUS_CONFIG,
  grn: GRN_STATUS_CONFIG,
  cn: CN_STATUS_CONFIG,
  sr: SR_STATUS_CONFIG,
  si: IA_STATUS_CONFIG,
  so: IA_STATUS_CONFIG,
};

const FILTERS: readonly ReviewGroupFilter[] = [
  "incomplete",
  "complete",
  "cancelled",
  "all",
];

function countFor(filter: ReviewGroupFilter, c: ReviewGroupCounts): number {
  switch (filter) {
    case "incomplete":
      return c.draft + c.in_progress;
    case "complete":
      return c.complete;
    case "cancelled":
      return c.cancelled;
    case "all":
      return c.draft + c.in_progress + c.complete + c.cancelled;
  }
}

/**
 * ผู้เรียกต้องใส่ `key={moduleKey}` เพื่อให้ตัวกรองกลับเป็น "ยังไม่เสร็จ" ทุกครั้งที่เปิดหรือ
 * เปลี่ยนโมดูล — state อยู่ในนี้ ไม่มี effect ไล่ reset
 */
interface Props {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly moduleKey: ReviewTransactionKey | null;
  readonly stat: ReviewTransactionStat | null;
  readonly icon: LucideIcon;
  readonly color: string;
}

export function PeDocumentsDialog({
  open,
  onOpenChange,
  moduleKey,
  stat,
  icon: Icon,
  color,
}: Props) {
  "use no memo";
  const locale = useLocale();
  const t = useTranslations("inventoryManagement.periodEnd");
  const tfl = useTranslations("field");
  const te = useTranslations("errors");

  const buCode = useBuCode();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ReviewGroupFilter>("incomplete");

  const query = useReviewDocuments(moduleKey, filter, open);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  const documents = useMemo<ReviewDocument[]>(
    () => query.data?.pages.flatMap((p) => p.data) ?? [],
    [query.data],
  );

  // ตัวเลขหน้าแรกของ endpoint รายการสดกว่า — จำค่าล่าสุดไว้ตอนสลับตัวกรองจะได้ไม่กระพริบ
  // (dialog remount ทุกครั้งที่เปิด/เปลี่ยนโมดูลผ่าน key ค่าจึงไม่รั่วข้ามโมดูล)
  const freshSummary = query.data?.pages[0]?.summary;
  const [lastSummary, setLastSummary] = useState<ReviewGroupCounts>();
  if (freshSummary && freshSummary !== lastSummary)
    setLastSummary(freshSummary);
  const counts: ReviewGroupCounts | undefined =
    freshSummary ?? lastSummary ?? stat?.group_counts;

  // เปิด dialog = เห็นสถานะล่าสุด (ไปแก้เอกสารแล้วกลับมา) ทั้งรายการและตัวเลขในการ์ด
  useEffect(() => {
    if (!open || !moduleKey || !buCode) return;
    void queryClient.invalidateQueries({
      queryKey: [
        QUERY_KEYS.PERIOD_ENDS,
        buCode,
        "review",
        moduleKey,
        "documents",
      ],
    });
    void queryClient.invalidateQueries({
      queryKey: [QUERY_KEYS.PERIOD_ENDS, buCode, "review"],
      exact: true,
    });
  }, [open, moduleKey, buCode, queryClient]);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const loadMoreFailed = query.isFetchNextPageError;
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage || loadMoreFailed) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) void fetchNextPage();
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [
    hasNextPage,
    isFetchingNextPage,
    loadMoreFailed,
    fetchNextPage,
    documents.length,
  ]);
  const statusConfig = moduleKey ? STATUS_CONFIGS[moduleKey] : null;
  const moduleLabel = moduleKey ? t(`modules.${moduleKey}`) : "";

  const columns = useMemo<ColumnDef<ReviewDocument>[]>(
    () => [
      {
        id: "index",
        header: () => "#",
        cell: ({ row }) => row.index + 1,
        size: 56,
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
      },
      {
        accessorKey: "no",
        header: () => tfl("documentNo"),
        cell: ({ row }) => {
          const label = <span className="text-micro">{row.original.no}</span>;
          if (!moduleKey) return label;
          return (
            <Link
              to={buildDocumentPath(moduleKey, row.original.id)}
              onClick={() => onOpenChange(false)}
              className="text-primary hover:underline focus-visible:underline"
            >
              {label}
            </Link>
          );
        },
        size: 200,
      },
      {
        accessorKey: "status",
        header: () => tfl("status"),
        cell: ({ row }) => {
          const cfg = statusConfig?.[row.original.status];
          return (
            <Badge className={cfg?.className} size="xs">
              {cfg?.label ??
                row.original.status.toUpperCase().replace(/_/g, " ")}
            </Badge>
          );
        },
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
        size: 140,
      },
      {
        accessorKey: "date",
        header: () => tfl("date"),
        cell: ({ row }) => (
          <span className="text-muted-foreground tabular-nums">
            {formatLocalizedDate(row.original.date, locale)}
          </span>
        ),
        meta: {
          headerClassName: "text-center",
          cellClassName: "text-center",
        },
        size: 140,
      },
    ],
    [statusConfig, moduleKey, onOpenChange, tfl, locale],
  );

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row) => row.id,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 sm:max-w-3xl">
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 z-20 h-0.5"
          style={{ background: color }}
        />
        <div className="relative space-y-4 px-6 pt-10 pb-6">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div
                aria-hidden="true"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: `color-mix(in oklch, ${color}, transparent 82%)`,
                  color,
                }}
              >
                <Icon className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div
                  className="text-micro-legal mb-1 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-semibold"
                  style={{
                    background: `color-mix(in oklch, ${color}, transparent 88%)`,
                    color,
                  }}
                >
                  {t("documents")}
                </div>
                <DialogTitle className="text-base">{moduleLabel}</DialogTitle>
                <DialogDescription className="mt-1">
                  {t("documentsSummary", {
                    draft: counts?.draft ?? 0,
                    inProgress: counts?.in_progress ?? 0,
                    complete: counts?.complete ?? 0,
                    cancelled: counts?.cancelled ?? 0,
                    total: counts ? countFor("all", counts) : 0,
                  })}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            value={filter}
            onValueChange={(v) => setFilter(v as ReviewGroupFilter)}
          >
            <TabsList className="h-auto w-full flex-wrap">
              {FILTERS.map((f) => (
                <TabsTrigger key={f} value={f} className="flex-1">
                  {t(`documentsFilter.${f}`)}
                  <span className="text-muted-foreground tabular-nums">
                    {counts ? countFor(f, counts) : "-"}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <DataGrid
            table={table}
            recordCount={documents.length}
            isLoading={query.isLoading}
            tableLayout={{ headerSticky: true, rowBorder: true }}
            emptyMessage={
              query.isError && documents.length === 0 ? (
                <ErrorState
                  error={query.error}
                  onRetry={() => void query.refetch()}
                />
              ) : (
                <EmptyComponent
                  icon={FileText}
                  title={
                    filter === "incomplete" &&
                    counts &&
                    countFor("all", counts) > 0
                      ? t("noIncompleteDocuments")
                      : t("noDocuments")
                  }
                />
              )
            }
          >
            <DataGridContainer className="flex max-h-[60vh] flex-col rounded-lg border">
              <DataGridScrollArea>
                <DataGridTable />
                <div ref={sentinelRef} aria-hidden="true" className="h-px" />
                {isFetchingNextPage && (
                  <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-sm">
                    <Loader2 className="size-4 animate-spin" />
                  </div>
                )}
                {loadMoreFailed && (
                  <div className="flex items-center justify-center gap-3 py-3 text-sm">
                    <span className="text-muted-foreground">
                      {t("loadMoreFailed")}
                    </span>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => void fetchNextPage()}
                    >
                      {te("tryAgain")}
                    </Button>
                  </div>
                )}
              </DataGridScrollArea>
            </DataGridContainer>
          </DataGrid>
        </div>
      </DialogContent>
    </Dialog>
  );
}
