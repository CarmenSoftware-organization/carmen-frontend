import { Save, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import type {
  LocalizedTitle,
  WidgetDisplay,
  WidgetParams,
  WidgetType,
} from "@/types/dashboard-widget";
import { useWidgetConfigState } from "./use-widget-config-state";
import { WidgetConfigFields } from "./widget-config-form";
import { defaultWidgetTypeFor } from "./widget-shape";

interface WidgetConfigDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly dataset: DashboardDataset;
  readonly initialParams?: WidgetParams | null;
  /** ค่าการแสดงผลเดิม — ไม่ส่ง = ยังไม่เคยตั้ง */
  readonly initialDisplay?: WidgetDisplay | null;
  /** ชนิดกราฟที่ใช้อยู่ — คุมทั้ง preview และฟิลด์ที่โผล่ (min/max เฉพาะ gauge) */
  readonly widgetType?: WidgetType;
  readonly isPending?: boolean;
  /** ชื่อที่ผู้ใช้ตั้งเอง — null/ไม่ส่ง = ใช้ชื่อตั้งต้นของ dataset (ดู `customWidgetTitle`) */
  readonly initialTitle?: LocalizedTitle | null;
  readonly onSubmit: (
    params: WidgetParams,
    display: WidgetDisplay,
    titleI18n: LocalizedTitle | null,
  ) => void;
}

/** ตั้งค่า widget ที่บันทึกแล้ว — การเพิ่ม widget ใหม่ใช้ `AddWidgetDialog` */
export function WidgetConfigDialog({
  open,
  onOpenChange,
  isPending,
  ...rest
}: WidgetConfigDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      {/* เปลือกเดียวกับหน้าปรับแต่งของ AddWidgetDialog: หัว/ท้ายตรึง เนื้อหาเลื่อนเอง —
          ฟอร์มที่ param เยอะจะไม่ดันปุ่มบันทึกตกใต้จอ */}
      <DialogContent className="flex h-[min(90vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* เนื้อหาอยู่ใต้ DialogContent ซึ่ง unmount ตอนปิด — เปิดใหม่ได้ค่าตั้งต้นใหม่เสมอ */}
        <WidgetConfigBody
          key={rest.dataset.id}
          {...rest}
          isPending={isPending}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function WidgetConfigBody({
  dataset,
  initialParams,
  initialDisplay,
  initialTitle,
  widgetType,
  isPending,
  onSubmit,
  onCancel,
}: Omit<WidgetConfigDialogProps, "open" | "onOpenChange"> & {
  readonly onCancel: () => void;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const tc = useTranslations("common");
  const state = useWidgetConfigState({
    dataset,
    initialParams,
    initialDisplay,
    initialTitle,
  });

  return (
    <>
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle>{t("configureTitle")}</DialogTitle>
        <DialogDescription>
          {t("configureDescription", { name: dataset.name })}
        </DialogDescription>
      </DialogHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        <WidgetConfigFields
          dataset={dataset}
          state={state}
          widgetType={widgetType ?? defaultWidgetTypeFor(dataset)}
          disabled={isPending}
        />
      </div>

      <DialogFooter className="border-t px-6 py-4">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          disabled={isPending}
        >
          <X />
          {tc("cancel")}
        </Button>
        <Button
          type="button"
          onClick={() => onSubmit(state.values, state.display, state.titleI18n)}
          disabled={isPending || state.isTitleInvalid}
        >
          <Save />
          {tc("save")}
        </Button>
      </DialogFooter>
    </>
  );
}
