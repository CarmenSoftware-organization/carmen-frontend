import { useMemo } from "react";
import { useTranslations } from "use-intl";
import { Skeleton } from "@/components/ui/skeleton";
import { useInViewport } from "@/hooks/use-in-viewport";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import { WidgetRouter } from "./dashboard-widget-grid";
import { useWidgetLabels } from "./widget-labels";
import { sampleWidget } from "./widget-sample-data";
import {
  defaultWidgetTypeFor,
  inferModuleName,
  inferSubTile,
} from "./widget-shape";

/**
 * รูปตัวอย่างของ widget บนการ์ดในแกลเลอรี — การ์ดจริง (`WidgetRouter`) วาดด้วยข้อมูลสมมติ
 * (`sampleWidget`) ไม่ยิง API · วาดเมื่อเลื่อนถึงเท่านั้น (117 ใบ วาด recharts ทั้งหมดตอนเปิด
 * pop up จะหน่วง) · หัวการ์ดถูกซ่อน เพราะชื่ออยู่บนการ์ดแกลเลอรีแล้ว
 *
 * เป็นภาพประกอบล้วน: `inert` + `aria-hidden` — ปุ่มที่กดคือการ์ดแกลเลอรีที่ห่ออยู่
 */
export function WidgetSampleThumb({
  dataset,
}: {
  readonly dataset: DashboardDataset;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const labels = useWidgetLabels();
  const { ref, inView } = useInViewport<HTMLDivElement>();
  const widgetType = defaultWidgetTypeFor(dataset);
  const sample = useMemo(
    () =>
      inView
        ? sampleWidget(dataset, (dimension, letter) =>
            dimension ? `${labels.dimension(dimension)} ${letter}` : letter,
          )
        : null,
    [inView, dataset, labels],
  );

  return (
    <div
      ref={ref}
      aria-hidden="true"
      inert
      data-testid="widget-sample-thumb"
      // pt-7 ของการ์ดด้านใน = เว้นแถบบนไว้ให้ป้าย "ตัวอย่าง" ไม่ทับหัวตาราง / legend
      className="bg-muted/30 pointer-events-none relative h-36 overflow-hidden rounded-md border select-none [&_[data-slot=card-header]]:hidden [&_[data-slot=card]]:border-0 [&_[data-slot=card]]:pt-7 [&_[data-slot=card]]:shadow-none"
    >
      {sample ? (
        <WidgetRouter
          widget={{
            id: `sample-${dataset.id}`,
            dataset_id: dataset.id,
            widget_type: widgetType,
            title: "",
            order_index: 0,
            params: {},
            meta: sample.meta,
            data: sample.data,
          }}
          moduleName={inferModuleName(dataset.id)}
          subTileFor={inferSubTile}
        />
      ) : (
        <Skeleton className="h-full w-full" />
      )}
      <span className="bg-background/90 text-muted-foreground text-micro-legal absolute top-1.5 right-1.5 rounded px-1.5 py-0.5 font-semibold tracking-wide uppercase">
        {t("sampleBadge")}
      </span>
    </div>
  );
}
