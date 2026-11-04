import { useLocale, useTranslations } from "use-intl";
import {
  WidgetRouter,
  WidgetSkeleton,
} from "@/components/dashboard-widget/dashboard-widget-grid";
import {
  fitDisplayToType,
  gridSize,
} from "@/components/dashboard-widget/widget-display";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDashboardDatasetPreview } from "@/hooks/use-dashboard-dataset";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import type { WidgetType } from "@/types/dashboard-widget";
import type { WidgetConfigState } from "./use-widget-config-state";
import { useDatasetLabel } from "./use-widget-title";
import { resolveWidgetTitle } from "./widget-title";
import { WidgetDisplayFields } from "./widget-display-fields";
import { WidgetParamFields } from "./widget-param-fields";
import { inferModuleName, inferSubTile } from "./widget-shape";
import { WidgetTypeField } from "./widget-type-field";

interface WidgetConfigFieldsProps {
  readonly dataset: DashboardDataset;
  readonly state: WidgetConfigState;
  /** ชนิดกราฟที่ใช้ — คุมทั้ง preview และฟิลด์ที่โผล่ (min/max เฉพาะ gauge) */
  readonly widgetType: WidgetType;
  /**
   * ส่งมา = ให้เลือกชนิดกราฟในส่วนการแสดงผล (โผล่เมื่อ `widgetTypes` มีมากกว่า 1 แบบ)
   * ไม่ส่ง = ชนิดตายตัวตาม `widgetType` (dialog แก้ widget — เปลี่ยนชนิดที่ปุ่มบนการ์ด)
   */
  readonly onWidgetTypeChange?: (widgetType: WidgetType) => void;
  readonly widgetTypes?: readonly WidgetType[];
  readonly disabled?: boolean;
  /** ส่ง false เพื่อหยุดยิง preview เช่นตอน dialog กำลังปิด */
  readonly previewEnabled?: boolean;
}

/** ฟิลด์ตั้งค่า widget (ชื่อ en/th · param · การแสดงผล) + preview สดตามค่าที่กรอก */
export function WidgetConfigFields({
  dataset,
  state,
  widgetType,
  onWidgetTypeChange,
  widgetTypes = [],
  disabled,
  previewEnabled = true,
}: WidgetConfigFieldsProps) {
  const t = useTranslations("dashboard.savedWidget");
  const locale = useLocale();
  const datasetLabel = useDatasetLabel();
  const {
    values,
    setParam,
    display,
    setDisplay,
    titleEn,
    setTitleEn,
    titleTh,
    setTitleTh,
    titleI18n,
    isTitleInvalid,
  } = state;
  // 1 แถว = 4rem (64px) + gap 0.75rem (12px) ระหว่างแถว — ตรงกับ auto-rows ของกริดจริง
  const previewRows = gridSize(widgetType, display).height;
  const previewHeight = previewRows * 64 + (previewRows - 1) * 12;

  const {
    data: preview,
    isLoading,
    isError,
    error,
  } = useDashboardDatasetPreview(dataset.id, values, previewEnabled);

  const defaultTitle = datasetLabel(dataset.id, dataset.name);
  const previewTitle = resolveWidgetTitle(
    { dataset_id: dataset.id, title_i18n: titleI18n },
    { locale, datasetName: dataset.name, translatedDatasetName: defaultTitle },
  );

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h3 className="text-muted-foreground text-micro-legal font-bold tracking-[0.16em] uppercase">
          {t("titleSection")}
        </h3>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="widget-title-en">{t("titleEn")}</Label>
            <Input
              id="widget-title-en"
              value={titleEn}
              onChange={(e) => setTitleEn(e.target.value)}
              placeholder={dataset.name}
              maxLength={255}
              disabled={disabled}
              aria-invalid={isTitleInvalid}
              aria-describedby={
                isTitleInvalid ? "widget-title-en-error" : undefined
              }
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="widget-title-th">{t("titleTh")}</Label>
            <Input
              id="widget-title-th"
              value={titleTh}
              onChange={(e) => setTitleTh(e.target.value)}
              placeholder={locale === "th" ? defaultTitle : undefined}
              maxLength={255}
              disabled={disabled}
            />
          </div>
        </div>
        {isTitleInvalid && (
          <p
            id="widget-title-en-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {t("titleEnRequired")}
          </p>
        )}
      </div>

      <WidgetParamFields
        params={dataset.params ?? []}
        values={values}
        onChange={setParam}
        disabled={disabled}
      />

      <div className="space-y-1.5">
        <h3 className="text-muted-foreground text-micro-legal font-bold tracking-[0.16em] uppercase">
          {t("display.section")}
        </h3>
        <div className="space-y-3">
          {onWidgetTypeChange && widgetTypes.length > 1 && (
            <WidgetTypeField
              options={widgetTypes}
              value={widgetType}
              onChange={(next) => {
                // ขนาดที่เลือกไว้อาจไม่อยู่ในตัวเลือกของชนิดใหม่ — ล้างให้กลับไปขนาดตั้งต้นของมัน
                setDisplay(fitDisplayToType(display, next));
                onWidgetTypeChange(next);
              }}
              disabled={disabled}
            />
          )}
          <WidgetDisplayFields
            widgetType={widgetType}
            value={display}
            onChange={setDisplay}
            disabled={disabled}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <h3 className="text-muted-foreground text-micro-legal font-bold tracking-[0.16em] uppercase">
          {t("preview")}
        </h3>
        {/* การ์ดกิน 100% ของช่องกริด — ใน dialog ไม่มีกริด ต้องกำหนดความสูงให้
            ตามขนาดที่เลือก ไม่งั้นพื้นที่กราฟยุบเป็น 0 แล้ว preview ว่างเปล่า */}
        {isError ? (
          <p role="alert" className="text-destructive text-sm">
            {t("previewError", {
              message: error?.message ?? "Unknown error",
            })}
          </p>
        ) : isLoading || !preview ? (
          <div style={{ height: previewHeight }}>
            <WidgetSkeleton />
          </div>
        ) : (
          <div style={{ height: previewHeight }}>
            <WidgetRouter
              widget={{
                id: "preview",
                dataset_id: dataset.id,
                widget_type: widgetType,
                title: previewTitle,
                order_index: 0,
                params: values,
                display,
                meta: preview.meta,
                data: preview.data,
              }}
              moduleName={inferModuleName(dataset.id)}
              subTileFor={inferSubTile}
            />
          </div>
        )}
      </div>
    </div>
  );
}
