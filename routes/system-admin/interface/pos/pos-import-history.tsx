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
import { useCan } from "@/hooks/use-can";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getUserErrorMessage } from "@/lib/error-message";
import { cn } from "@/lib/utils";
import {
  confirmationState,
  importStatusTone,
  type ConfirmationState,
} from "./pos-import-status";
import { PosSimphonyUploadButton } from "./pos-simphony-upload-button";
import type { PosBrand, PosImportListItem } from "./pos-sale-types";
import { useCancelPosImport, usePosImports } from "./use-pos-sale";

const LEGACY_EXPORT_WARNING = "legacy_export_version";

const CONFIRMATION_CLASS: Record<ConfirmationState, string> = {
  cancelled: "text-muted-foreground",
  not_applicable: "text-muted-foreground",
  pending: "text-muted-foreground",
  partial: "text-warning-ink",
  confirmed: "text-success-ink",
};

/**
 * แท็บประวัติการนำเข้ายอดขาย POS — ตาราง server-side pagination + อัปโหลด (Simphony) + ยกเลิก
 *
 * @param brand แบรนด์ POS ของหน้านี้
 * @returns React element ของแท็บ
 */
export function PosImportHistory({ brand }: { brand: PosBrand }) {
  "use no memo";
  const t = useTranslations("systemAdmin.interface.posSale.history");
  const tStatus = useTranslations("systemAdmin.interface.posSale.importStatus");
  const tc = useTranslations("common");
  const tErr = useTranslations("errors");
  const { canWrite } = useCan();
  const { dateFormat } = useProfile();
  const formatAmount = useAmountFormatter();
  const { params, tableConfig } = useDataGridState({ defaultPerpage: 20 });
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
        id: "store_name",
        header: t("columns.store"),
        cell: ({ row }) => row.original.store_name ?? "",
        enableSorting: false,
        meta: { skeleton: columnSkeletons.text },
      },
      {
        id: "source",
        header: t("columns.source"),
        cell: ({ row }) => row.original.source ?? "",
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
              {tStatus(r.status)}
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
        id: "confirmation",
        header: t("columns.confirmation"),
        cell: ({ row }) => {
          const r = row.original;
          const state = confirmationState(r);
          if (state === "not_applicable") return "-";
          return (
            <span className={cn(CONFIRMATION_CLASS[state])}>
              {t(`confirmation.${state}`)}
              {state === "partial" &&
                ` (${r.confirmed_line_count}/${r.line_count})`}
            </span>
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
          const canCancel = canWrite && confirmationState(r) === "pending";
          return (
            <span className="flex items-center justify-end gap-1">
              {r.status === "success" && (
                <Button asChild variant="ghost" size="xs">
                  <Link
                    to={`/system-admin/interface/pos/${brand}/imports/${r.id}`}
                  >
                    {t("actions.inspect")}
                  </Link>
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
    [t, tStatus, dateFormat, formatAmount, brand, canWrite],
  );

  const table = useReactTable({
    data: items,
    columns,
    getCoreRowModel: getCoreRowModel(),
    ...tableConfig,
    pageCount: Math.ceil(totalRecords / (params.perpage as number)),
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
      {brand === "simphony" && canWrite && (
        <div className="flex justify-end">
          <PosSimphonyUploadButton />
        </div>
      )}
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
