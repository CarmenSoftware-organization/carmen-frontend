import { useState } from "react";
import {
  CalendarPlus,
  Download,
  Loader2,
  MoreHorizontal,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useInventoryPeriodAll,
  useGenerateNextInventoryPeriod,
  useExportInventoryPeriod,
} from "./use-inventory-period";
import { INVENTORY_PERIOD_STATUS_CONFIG } from "@/constant/inventory-period";
import { ErrorState } from "@/components/ui/error-state";
import EmptyComponent from "@/components/empty-component";
import { useExportErrorToast } from "@/hooks/use-export-error-toast";
import { ListPageShell } from "@/components/share/list-page-shell";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useProfile } from "@/hooks/use-profile";
import { todayDateInput } from "./inventory-period-phase";
import {
  InventoryPeriodBoard,
  InventoryPeriodBoardSkeleton,
} from "./inventory-period-board";

/** จำนวนรอบที่เปิดอยู่ที่ปุ่ม "เติมรอบ" จะเติมให้ครบ */
const GENERATE_TARGET = 12;

/**
 * หน้ารอบสินค้าคงคลัง — อ่านอย่างเดียว แสดงเป็นกระดานรายปี (ไม่ใช่ตารางแบ่งหน้า)
 *
 * รอบมีปีละ 12 แถว ดึงทั้งหมดครั้งเดียวแล้ววางให้เห็นครบ ไม่มีช่องค้นหา/ตัวกรอง:
 * ค้นรหัสรอบในทะเบียนที่เรียงตามเดือนอยู่แล้วไม่ช่วยอะไร และตัวกรองสถานะเคยทำให้
 * รอบที่เปิดอยู่ตกไปหน้า 2 ของตาราง
 */
export default function InventoryPeriodComponent() {
  const generateNext = useGenerateNextInventoryPeriod();
  const { exportInventoryPeriod, isExporting } = useExportInventoryPeriod();
  const [generateOpen, setGenerateOpen] = useState(false);
  const { currentPeriod } = useProfile();
  const today = todayDateInput();
  const t = useTranslations("systemAdmin.inventoryPeriod");
  const tc = useTranslations("common");
  const exportErrorToast = useExportErrorToast();
  const tt = useTranslations("toast");

  const { data, isLoading, error, refetch } = useInventoryPeriodAll();
  const periods = data ?? [];

  const handleExport = async () => {
    try {
      const count = await exportInventoryPeriod({
        // export เอาทั้งทะเบียนเหมือนที่หน้าแสดง — เพดาน perpage ของ backend คือ 100
        // (ราว 8 ปี) เกินกว่านั้นค่อยเปลี่ยนไปวนหน้า
        params: { page: 1, perpage: 100, sort: "start_at:asc" },
        columns: [
          { header: t("period"), value: (r) => r.period, width: 14 },
          {
            header: t("fiscalYear"),
            value: (r) => r.fiscal_year ?? 0,
            width: 12,
          },
          {
            header: t("fiscalMonth"),
            value: (r) => r.fiscal_month ?? 0,
            width: 12,
          },
          { header: t("startAt"), value: (r) => r.start_at ?? "", width: 14 },
          { header: t("endAt"), value: (r) => r.end_at ?? "", width: 14 },
          {
            header: t("status"),
            value: (r) =>
              INVENTORY_PERIOD_STATUS_CONFIG[r.status]?.label ?? r.status,
            width: 12,
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

  // backend เติมรอบที่เปิดอยู่ให้ครบ count ไม่ใช่สร้างเพิ่ม count รอบ
  // (micro-business inventory-period.service.ts generateNextPeriods)
  const openCount = periods.filter((p) => p.status === "open").length;
  const toCreate = Math.max(0, GENERATE_TARGET - openCount);

  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      count={data?.length}
      actions={
        <div className="flex w-full items-center gap-2 sm:w-auto">
          {/* ไม่มีปุ่ม "เพิ่ม" — รอบใหม่เกิดจากการปิดงวด วันที่กำหนดโดยระบบ
              งานที่เหลือ (เติมรอบ/ส่งออก/พิมพ์) อยู่ในเมนูเดียวกันทุกขนาดจอ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                className="size-11 shrink-0 sm:size-8"
                aria-label={tc("aria.moreActions")}
              >
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-60">
              <DropdownMenuItem
                disabled={generateNext.isPending || toCreate === 0}
                onSelect={() => setGenerateOpen(true)}
              >
                <CalendarPlus aria-hidden="true" />
                <span className="flex flex-col">
                  {t("generateNext")}
                  {toCreate === 0 && (
                    <span className="text-muted-foreground text-xs">
                      {t("generateNothing")}
                    </span>
                  )}
                </span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleExport} disabled={isExporting}>
                {isExporting ? (
                  <Loader2 className="animate-spin" aria-hidden="true" />
                ) : (
                  <Download aria-hidden="true" />
                )}
                {isExporting ? tc("exporting") : tc("export")}
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => globalThis.print()}>
                <Printer aria-hidden="true" />
                {tc("print")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      }
    >
      {isLoading ? (
        <InventoryPeriodBoardSkeleton />
      ) : periods.length === 0 ? (
        // BU ที่ยังไม่มีรอบเลย — ไม่มีปุ่ม "เพิ่ม" ทางเดียวที่จะเริ่มได้คือ "เติมรอบ" ซึ่งซ่อนอยู่ใน
        // เมนู ⋯ จึงยื่นปุ่มนั้นให้ตรง ๆ ไม่งั้นหน้าเปล่าไม่บอกว่าต้องทำอะไรต่อ
        <EmptyComponent
          icon={CalendarPlus}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          content={
            <Button
              size="sm"
              disabled={generateNext.isPending}
              onClick={() => setGenerateOpen(true)}
            >
              <CalendarPlus aria-hidden="true" />
              {t("emptyAction")}
            </Button>
          }
        />
      ) : (
        <InventoryPeriodBoard
          periods={periods}
          currentPeriodId={currentPeriod?.id}
          today={today}
        />
      )}

      <ConfirmDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        title={t("generateTitle")}
        description={t("generateDesc", { open: openCount, create: toCreate })}
        confirmIcon={<CalendarPlus aria-hidden="true" />}
        isPending={generateNext.isPending}
        onConfirm={() =>
          generateNext.mutate(
            { count: GENERATE_TARGET, start_day: 1 },
            {
              onSuccess: () => {
                setGenerateOpen(false);
                toast.success(tt("createSuccess", { entity: t("entity") }));
              },
            },
          )
        }
      />
    </ListPageShell>
  );
}
