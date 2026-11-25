import { useState } from "react";
import { Download, MoreHorizontal, Play, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useRunningCode,
  useDeleteRunningCode,
  useInitRunningCode,
  useExportRunningCode,
} from "./use-running-code";
import { useDataGridState } from "@/hooks/use-data-grid-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { CardSkeletonGrid } from "@/components/loader/card-skeleton";
import RunningCodeCard from "./running-code-card";
import type { RunningCode } from "@/types/running-code";
import SearchInput from "@/components/search-input";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { RunningCodeDialog } from "./running-code-dialog";
import { useRunningCodeTable } from "./use-running-code-table";
import { useGridPagination } from "@/hooks/use-grid-pagination";
import { Loader2 } from "lucide-react";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { cn } from "@/lib/utils";
import { rowNumber } from "@/lib/row-number";

/**
 * ทุกขนาดจอใช้ lazy load — หน้านี้ไม่แบ่งหน้า เลื่อนถึงท้ายแล้วโหลดชุดถัดไป
 *
 * หลังเพิ่ม/แก้/ลบ/init ต้อง remount รายการ (`key`): `useGridPagination` refetch แค่ชุดที่
 * เปิดอยู่แล้วต่อท้าย แถวที่ลบไปจึงค้างในแถวที่สะสมไว้ · ใช้ resetKey ของ hook ไม่ได้ —
 * ถ้าอยู่ชุดแรกอยู่แล้ว มันล้างแถวทิ้งแต่ page ไม่เปลี่ยน refetch ที่ได้ข้อมูลเดิม
 * (reference เดิม) จะไม่เติมแถวกลับ ตารางว่างค้าง
 */
export default function RunningCodeComponent() {
  const [listKey, setListKey] = useState(0);
  return (
    <RunningCodeList
      key={listKey}
      onChanged={() => setListKey((k) => k + 1)}
    />
  );
}

function RunningCodeList({ onChanged }: { readonly onChanged: () => void }) {
  // แถวมาจาก state ที่ lazy load สะสมไว้ — กันคอมไพเลอร์แช่ JSX ของตาราง (routes/CLAUDE.md)
  "use no memo";
  const [deleteTarget, setDeleteTarget] = useState<RunningCode | null>(null);
  const deleteRunningCode = useDeleteRunningCode();
  const initRunningCode = useInitRunningCode();
  const { exportRunningCode, isExporting } = useExportRunningCode();
  const isMobile = useIsMobile();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRunningCode, setEditRunningCode] = useState<RunningCode | null>(
    null,
  );
  const { params, search, setSearch, tableConfig } = useDataGridState();
  const grid = useGridPagination<RunningCode>({
    useListHook: useRunningCode,
    params,
    enabled: true,
  });
  const t = useTranslations("systemAdmin.runningCode");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tfl = useTranslations("field");
  const tt = useTranslations("toast");

  const handleExport = async () => {
    try {
      const count = await exportRunningCode({
        params,
        columns: [
          { header: tfl("type"), value: (r) => r.type, width: 20 },
          { header: tfl("note"), value: (r) => r.note ?? "", width: 32 },
          {
            header: tfl("config"),
            value: (r) => JSON.stringify(r.config ?? {}),
            width: 40,
          },
        ],
      });
      if (count === 0) {
        toast.warning(tc("exportNoData"));
        return;
      }
      toast.success(tc("exportSuccess", { count }));
    } catch (err) {
      exportErrorToast(err);
    }
  };

  const runningCodes = grid.items;
  const totalRecords = grid.totalRecords;

  const table = useRunningCodeTable({
    runningCodes,
    totalRecords,
    // เลขลำดับนับต่อเนื่อง 1..N ข้ามชุดที่ lazy load
    params: { ...params, page: 1 },
    tableConfig,
    onEdit: (runningCode) => {
      setEditRunningCode(runningCode);
      setDialogOpen(true);
    },
    onDelete: setDeleteTarget,
  });

  if (grid.error)
    return <ErrorState error={grid.error} onRetry={() => grid.refetch?.()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={totalRecords}
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="hidden sm:inline-flex"
          >
            {isExporting ? (
              <Loader2 className="animate-spin" aria-hidden="true" />
            ) : (
              <Download aria-hidden="true" />
            )}
            {isExporting ? tc("exporting") : tc("export")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => globalThis.print()}
            className="hidden sm:inline-flex"
          >
            <Printer aria-hidden="true" />
            {tc("print")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              initRunningCode.mutate(undefined, {
                onSuccess: () => {
                  toast.success(t("initSuccess"));
                  onChanged();
                },
              })
            }
            disabled={initRunningCode.isPending}
            className="hidden sm:inline-flex"
          >
            <Play aria-hidden="true" />
            {initRunningCode.isPending ? t("initializing") : t("init")}
          </Button>
          <Button
            size="sm"
            onClick={() => {
              setEditRunningCode(null);
              setDialogOpen(true);
            }}
          >
            <Plus aria-hidden="true" />
            {t("add")}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="h-11 w-11 shrink-0 sm:hidden"
                aria-label={tc("aria.moreActions")}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                disabled={initRunningCode.isPending}
                onSelect={() =>
                  initRunningCode.mutate(undefined, {
                    onSuccess: () => {
                      toast.success(t("initSuccess"));
                      onChanged();
                    },
                  })
                }
              >
                <Play aria-hidden="true" />
                {initRunningCode.isPending ? t("initializing") : t("init")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {isExporting ? tc("exporting") : tc("export")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => globalThis.print()}>
                <Printer aria-hidden="true" />
                {tc("print")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
      toolbar={
        <div className="flex w-full items-center gap-2">
          <div className="flex-1">
            <SearchInput defaultValue={search} onSearch={setSearch} />
          </div>
        </div>
      }
    >
      {isMobile ? (
        grid.isLoading ? (
          <CardSkeletonGrid />
        ) : runningCodes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3">
              {runningCodes.map((rc, i) => (
                <RunningCodeCard
                  rowNo={rowNumber(undefined, i)}
                  key={rc.id}
                  item={rc}
                  onEdit={(item) => {
                    setEditRunningCode(item);
                    setDialogOpen(true);
                  }}
                  onDelete={setDeleteTarget}
                />
              ))}
            </div>
            {grid.hasMore && (
              <div ref={grid.sentinelRef} className="flex justify-center py-4">
                {grid.isLoadingMore && (
                  <Loader2 className="text-muted-foreground size-5 animate-spin" />
                )}
              </div>
            )}
          </>
        ) : (
          <EmptyComponent />
        )
      ) : (
        <DataGrid
          table={table}
          recordCount={totalRecords}
          isLoading={grid.isLoading}
          tableLayout={{ headerSticky: true }}
          emptyMessage={<EmptyComponent />}
        >
          <DataGridContainer
            className={cn("flex flex-col", listGridMaxH(false))}
          >
            <DataGridScrollArea>
              <DataGridTable />
              {grid.hasMore && (
                <div
                  ref={grid.sentinelRef}
                  className="flex justify-center py-4"
                >
                  {grid.isLoadingMore && (
                    <Loader2 className="text-muted-foreground size-5 animate-spin" />
                  )}
                </div>
              )}
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      )}

      <RunningCodeDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        runningCode={editRunningCode}
        onSaved={onChanged}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) =>
          !open && !deleteRunningCode.isPending && setDeleteTarget(null)
        }
        title={t("deleteTitle")}
        description={t("deleteConfirm", { name: deleteTarget?.type ?? "" })}
        isPending={deleteRunningCode.isPending}
        onConfirm={() => {
          if (!deleteTarget) return;
          deleteRunningCode.mutate(deleteTarget.id, {
            onSuccess: () => {
              toast.success(tt("deleteSuccess", { entity: t("entity") }));
              setDeleteTarget(null);
              onChanged();
            },
          });
        }}
      />
    </ListPageShell>
  );
}
