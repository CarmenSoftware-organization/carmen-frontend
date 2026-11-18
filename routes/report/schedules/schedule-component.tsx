import { useState } from "react";
import { useTranslations } from "use-intl";
import {
  DataGrid,
  DataGridContainer,
  DataGridScrollArea,
} from "@/components/ui/data-grid/data-grid";
import { DataGridTable } from "@/components/ui/data-grid/data-grid-table";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import EmptyComponent from "@/components/empty-component";
import { toast } from "sonner";
import { useBuCode } from "@/hooks/use-bu-code";
import { useErrorToast } from "@/hooks/use-error-toast";
import {
  useDeleteReportSchedule,
  useReportSchedules,
} from "./use-report-schedule";
import type { ReportSchedule } from "@/types/report-schedule";
import { CreateScheduleDialog } from "./create-schedule-dialog";
import { SCHEDULE_CARD_BELOW, useScheduleTable } from "./use-schedule-table";
import { ScheduleCards } from "./schedule-cards";
import { useElementWidth } from "@/hooks/use-element-width";
import { cn } from "@/lib/utils";
import { ListPageShell } from "@/components/share/list-page-shell";
import { listGridMaxH } from "@/components/share/list-grid-max-h";
import { DocumentListActions } from "@/components/share/document-list-actions";

export default function ScheduleComponent() {
  const t = useTranslations("reportSchedule");
  const buCode = useBuCode();
  const errorToast = useErrorToast();

  const [createOpen, setCreateOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ReportSchedule | null>(
    null,
  );

  const { data: schedules = [], isLoading, refetch } = useReportSchedules();
  const deleteMutation = useDeleteReportSchedule();

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteMutation.mutateAsync(pendingDelete.id);
      toast.success(t("deleteSuccess"));
      setPendingDelete(null);
    } catch (err) {
      // เดิมโยน err.message ดิบ และ fallback ยังเป็น t("deleteConfirm") ซึ่งเป็น
      // ประโยคถามยืนยัน ไม่ใช่ข้อความบอกว่าลบไม่สำเร็จ
      errorToast(err);
    }
  };

  // เลือกคอลัมน์จากความกว้างกล่องตาราง (หักขอบ DataGridContainer ข้างละ 1px)
  const [setGridBox, gridBoxWidth] = useElementWidth();
  const containerWidth = gridBoxWidth == null ? undefined : gridBoxWidth - 2;
  const asCards =
    containerWidth != null &&
    containerWidth < SCHEDULE_CARD_BELOW &&
    schedules.length > 0;

  const table = useScheduleTable({
    schedules,
    onDelete: setPendingDelete,
    containerWidth,
  });

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={schedules.length}
      actions={
        <DocumentListActions
          onAdd={() => setCreateOpen(true)}
          addLabel={t("createSchedule")}
          hideExportPrint
        />
      }
    >
      <div ref={setGridBox}>
        <DataGrid
          table={table}
          recordCount={schedules.length}
          isLoading={isLoading}
          tableLayout={{ headerSticky: true }}
          emptyMessage={<EmptyComponent />}
        >
          <DataGridContainer
            className={cn("flex flex-col", listGridMaxH(false))}
          >
            <DataGridScrollArea>
              {asCards ? (
                <ScheduleCards
                  schedules={schedules}
                  onDelete={setPendingDelete}
                />
              ) : (
                <DataGridTable />
              )}
            </DataGridScrollArea>
          </DataGridContainer>
        </DataGrid>
      </div>

      <CreateScheduleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        buCode={buCode ?? ""}
        onCreated={() => refetch()}
      />

      <DeleteDialog
        open={!!pendingDelete}
        onOpenChange={(v) => !v && setPendingDelete(null)}
        onConfirm={handleDelete}
        isPending={deleteMutation.isPending}
        title={t("deleteConfirm")}
        description={pendingDelete?.name}
      />
    </ListPageShell>
  );
}
