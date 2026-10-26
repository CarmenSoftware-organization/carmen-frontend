import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Loader2, TriangleAlert, X } from "lucide-react";
import type { ColumnDef } from "@tanstack/react-table";
import { getCoreRowModel, useReactTable } from "@tanstack/react-table";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DataGridPagination } from "@/components/ui/data-grid/data-grid-pagination";
import { columnSkeletons } from "@/components/ui/data-grid/columns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import EmptyComponent from "@/components/empty-component";
import { ErrorState } from "@/components/ui/error-state";
import { cn } from "@/lib/utils";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getUserErrorMessage } from "@/lib/error-message";
import {
  confirmationState,
  clampPerpage,
  importStatusLabel,
  importStatusTone,
} from "./pos-import-status";
import type { PosBrand, PosImportListItem } from "@/types/pos-sale";
import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { setURLParams } from "@/hooks/use-url";
import { useCancelPosImport, usePosImports } from "../shared/use-pos-sale";

const LEGACY_EXPORT_WARNING = "legacy_export_version";

/**
 * ประวัติการนำเข้ายอดขาย POS — ตาราง server-side pagination + ลิงก์ Sales Consumption + ดูบรรทัด + ยกเลิก
 *
 * @param brand กรองแบรนด์ — ไม่ส่ง = ทุกแบรนด์
 * @param selectedId id ของการนำเข้าที่กำลังดูบรรทัดอยู่ (ไฮไลต์ปุ่ม)
 * @returns React element ของตาราง
 */
export function PosImportHistory({
  brand,
  selectedId,
}: {
  brand?: PosBrand;
  selectedId?: string;
}) {
  "use no memo";
  const t = useTranslations("operationPlan.posSale.history");
  const tStatus = useTranslations("operationPlan.posSale.importStatus");
  const tc = useTranslations("common");
  const tErr = useTranslations("errors");
  const { canWrite: contractWrite } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  const tBrand = useTranslations("operationPlan.importPos.brand");
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const { params: rawParams, tableConfig } = useDataGridState({
    defaultPerpage: 20,
  });
  const params = { ...rawParams, perpage: clampPerpage(rawParams.perpage, 20) };
  const { data, isLoading, error, refetch } = usePosImports(params, brand);
  const cancel = useCancelPosImport();
  const [cancelTarget, setCancelTarget] = useState<PosImportListItem | null>(
    null,
  );

  const items = data?.data ?? [];
  const totalRecords = data?.paginate?.total ?? 0;

  const columns = useMemo<ColumnDef<PosImportListItem>[]>(
    () => [
      {
        id: "doc_date",
        header: t("columns.docDate"),
        // doc_date เป็นวันล้วน (YYYY-MM-DD) — ใส่เวลาท้องถิ่นกันวันเลื่อนตามโซนเวลา
        cell: ({ row }) =>
          row.original.doc_date
            ? formatDate(`${row.original.doc_date}T00:00:00`, dateFormat)
            : "",
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "brand",
        header: t("columns.pos"),
        cell: ({ row }) => tBrand(row.original.brand),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "file_name",
        header: t("columns.file"),
        cell: ({ row }) => (
          <span className="block max-w-56 truncate">
            {row.original.file_name}
          </span>
        ),
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "ingest_method",
        header: t("columns.channel"),
        cell: ({ row }) =>
          row.original.ingest_method === "manual" ||
          row.original.ingest_method === "sftp"
            ? t(`channel.${row.original.ingest_method}`)
            : row.original.ingest_method,
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => {
          const r = row.original;
          const badge = (
            <StatusDotBadge tone={importStatusTone(r.status)}>
              {importStatusLabel(tStatus, r.status)}
            </StatusDotBadge>
          );
          return (
            <span className="flex items-center gap-1.5">
              {r.error_message ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>{badge}</span>
                  </TooltipTrigger>
                  <TooltipContent>{r.error_message}</TooltipContent>
                </Tooltip>
              ) : (
                badge
              )}
              {r.warnings.includes(LEGACY_EXPORT_WARNING) && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="text-warning-ink"
                      aria-label={t("legacyWarning")}
                    >
                      <TriangleAlert className="size-4" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{t("legacyWarning")}</TooltipContent>
                </Tooltip>
              )}
            </span>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.badge },
      },
      {
        id: "total_records",
        header: t("columns.lines"),
        cell: ({ row }) => row.original.total_records,
        enableSorting: false,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
          skeleton: columnSkeletons.number,
        },
      },
      {
        id: "total_sales_amount",
        header: t("columns.sales"),
        cell: ({ row }) => formatAmount(row.original.total_sales_amount),
        enableSorting: false,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right tabular-nums",
          skeleton: columnSkeletons.number,
        },
      },
      {
        id: "sales_consumption",
        header: t("columns.salesConsumption"),
        cell: ({ row }) => {
          const sc = row.original.sales_consumption;
          if (!sc) return "-";
          return (
            <Link
              to={`/operation-plan/sales-consumption/${sc.id}`}
              className="text-primary hover:underline"
            >
              {sc.sc_no}
            </Link>
          );
        },
        enableSorting: false,
        meta: { skeleton: columnSkeletons.textShort },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const r = row.original;
          const canCancel =
            contractWrite &&
            entitlementOf("pos", r.brand) !== "expired" &&
            confirmationState(r) === "pending";
          return (
            <span className="flex items-center justify-end gap-1">
              {r.status === "success" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  aria-pressed={selectedId === r.id}
                  className={cn(selectedId === r.id && "text-primary")}
                  onClick={() => setURLParams({ import: r.id })}
                >
                  {t("actions.viewLines")}
                </Button>
              )}
              {canCancel && (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-destructive"
                  onClick={() => setCancelTarget(r)}
                >
                  {t("actions.cancel")}
                </Button>
              )}
            </span>
          );
        },
        enableSorting: false,
        enableHiding: false,
        meta: {
          headerClassName: "text-right",
          cellClassName: "text-right",
          skeleton: columnSkeletons.textShort,
        },
      },
    ],
    [
      t,
      tStatus,
      tBrand,
      dateFormat,
      formatAmount,
      contractWrite,
      entitlementOf,
      selectedId,
    ],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / params.perpage),
  });

  const confirmCancel = () => {
    if (!cancelTarget) return;
    cancel.mutate(cancelTarget.id, {
      onSuccess: () => {
        setCancelTarget(null);
        toast.success(t("cancelDialog.success"));
      },
      onError: (err) => {
        setCancelTarget(null);
        toast.error(getUserErrorMessage(err, tErr));
      },
    });
  };

  if (error) {
    return <ErrorState error={error} onRetry={() => void refetch()} />;
  }

  return (
    <div className="space-y-3 pt-4">
      <DataGrid
        table={table}
        recordCount={totalRecords}
        isLoading={isLoading}
        tableLayout={{ headerSticky: true }}
        emptyMessage={<EmptyComponent />}
      >
        <DataGridContainer className="flex flex-col">
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
          <DataGridPagination sizes={[10, 20, 50, 100]} />
        </DataGridContainer>
      </DataGrid>

      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(o) => !cancel.isPending && !o && setCancelTarget(null)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogTitle className="text-base">
            {t("cancelDialog.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {t("cancelDialog.desc")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancel.isPending}>
              <X />
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirmCancel();
              }}
              disabled={cancel.isPending}
            >
              {cancel.isPending && <Loader2 className="animate-spin" />}
              {t("cancelDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
