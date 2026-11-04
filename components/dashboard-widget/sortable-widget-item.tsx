import { useEffect } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Check,
  CircleAlert,
  GripVertical,
  Settings2,
  Trash2,
} from "lucide-react";
import { useTranslations } from "use-intl";
import {
  WidgetRouter,
  WidgetSkeleton,
  type ResolvedWidget,
} from "@/components/dashboard-widget/dashboard-widget-grid";
import { availableRenders } from "@/components/dashboard-widget/render-support";
import { gridClasses } from "@/components/dashboard-widget/widget-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useInViewport } from "@/hooks/use-in-viewport";
import { RenderIcon } from "./render-icon";
import { useWidgetTitle } from "./use-widget-title";
import { cn } from "@/lib/utils";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import type {
  DashboardDatasetDetail,
  DatasetData,
  DatasetMeta,
  DatasetShape,
  MyDashboardWidget,
  WidgetType,
} from "@/types/dashboard-widget";
import {
  inferModuleName,
  inferSubTile,
  SUPPORTED_SHAPES,
} from "./widget-shape";

interface SortableWidgetItemProps {
  readonly widget: MyDashboardWidget;
  /**
   * ข้อมูลที่ resolve แล้วของ widget นี้ — parent เป็นคน fetch (ดู
   * `SavedWidgetsSection`) โดยยิงตาม widget id เพื่อให้ backend ใช้ `params`
   * ที่เก็บไว้บน widget เอง
   */
  readonly detail: DashboardDatasetDetail | undefined;
  readonly isLoading: boolean;
  readonly onDelete: () => void;
  readonly dataset?: DashboardDataset;
  readonly onConfigure?: () => void;
  readonly onVisible: (widgetId: string) => void;
  readonly onChangeType?: (widgetType: WidgetType) => void;
  /** false = อ่านอย่างเดียว: ไม่มีปุ่มลาก ลบ ตั้งค่า และเปลี่ยนชนิดกราฟ (BU widget สำหรับผู้ไม่มีสิทธิ์แก้) */
  readonly editable?: boolean;
}

export function SortableWidgetItem({
  widget,
  detail,
  isLoading,
  onDelete,
  dataset,
  onConfigure,
  onVisible,
  onChangeType,
  editable = true,
}: SortableWidgetItemProps) {
  const t = useTranslations("dashboard.savedWidget");
  const titleOf = useWidgetTitle();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: widget.id, disabled: !editable });
  const { ref: viewRef, inView } = useInViewport<HTMLLIElement>();

  useEffect(() => {
    if (inView) onVisible(widget.id);
  }, [inView, onVisible, widget.id]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayTitle = titleOf(widget, dataset?.name ?? detail?.meta.name);
  const moduleName = inferModuleName(widget.dataset_id);
  const gridClass = gridClasses(widget.widget_type, widget.display);
  // shape มาจาก catalogue ก่อน (รู้ตั้งแต่ยังไม่โหลดข้อมูล) แล้วค่อย fallback ไป meta
  // ของ payload สำหรับ widget ที่ dataset ไม่อยู่ใน catalogue
  const renders = availableRenders(
    dataset?.shape ?? detail?.meta.shape,
    dataset?.supported_renders,
  );

  return (
    <li
      // dnd-kit ถือ ref ของ node นี้อยู่แล้ว — ผูก observer เพิ่มโดยไม่แย่งกัน
      ref={(node) => {
        setNodeRef(node);
        viewRef.current = node;
      }}
      style={style}
      className={cn(
        gridClass,
        "group/sortable relative h-full",
        isDragging && "z-10 opacity-50",
      )}
    >
      {editable && (
        <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 transition-opacity group-hover/sortable:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label="Drag to reorder"
            className="text-muted-foreground hover:text-foreground hover:bg-muted/60 inline-flex size-6 cursor-grab touch-none items-center justify-center rounded-md"
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>
          {renders.length > 1 && onChangeType && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label={t("chartTypeAria", { title: displayTitle })}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <RenderIcon type={widget.widget_type} className="size-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-36">
                <DropdownMenuLabel>{t("chartType.label")}</DropdownMenuLabel>
                {renders.map((r) => (
                  <DropdownMenuItem
                    key={r}
                    onSelect={() => onChangeType(r)}
                    className="gap-2"
                  >
                    <RenderIcon type={r} className="size-3.5" />
                    <span className="flex-1">{t(`chartType.${r}`)}</span>
                    {r === widget.widget_type && (
                      <Check className="size-3.5" aria-hidden="true" />
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {/* เฟืองโผล่ทุกใบแล้ว — dialog คุมทั้ง param และการแสดงผล ซึ่งตั้งได้แม้
              dataset จะไม่มี param เลย */}
          {!!dataset && onConfigure && (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              onClick={onConfigure}
              aria-label={t("configureAria", { title: displayTitle })}
              className="text-muted-foreground hover:text-foreground"
            >
              <Settings2 className="size-3.5" aria-hidden="true" />
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            onClick={onDelete}
            aria-label={t("deleteAria", { title: displayTitle })}
            className="text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </Button>
        </div>
      )}

      {isLoading || !detail ? (
        <WidgetSkeleton />
      ) : SUPPORTED_SHAPES.includes(
          detail.meta.shape as (typeof SUPPORTED_SHAPES)[number],
        ) ? (
        <WidgetRouter
          widget={buildFullWidget(
            widget,
            detail.meta,
            detail.data,
            displayTitle,
          )}
          moduleName={moduleName}
          subTileFor={inferSubTile}
        />
      ) : (
        <UnsupportedCard title={displayTitle} shape={detail.meta.shape} />
      )}
    </li>
  );
}

function UnsupportedCard({
  title,
  shape,
}: {
  readonly title: string;
  readonly shape: string;
}) {
  const t = useTranslations("dashboard.savedWidget");
  return (
    <Card className="border-warning/30 bg-warning/5 gap-2 py-4">
      <CardContent className="flex items-start gap-3 px-4">
        <span className="bg-warning/15 text-warning-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-lg">
          <CircleAlert className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <p className="truncate text-sm leading-snug font-semibold">{title}</p>
          <p className="text-muted-foreground text-micro font-semibold tracking-wide uppercase">
            {t("unsupportedTitle")}
          </p>
          <p className="text-muted-foreground text-micro leading-snug">
            {t("unsupportedDescription", { shape })}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

function buildFullWidget(
  saved: MyDashboardWidget,
  meta: DatasetMeta,
  data: DatasetData<DatasetShape>,
  title: string,
): ResolvedWidget {
  return {
    id: saved.id,
    display: saved.display,
    dataset_id: saved.dataset_id,
    widget_type: saved.widget_type,
    title,
    order_index: saved.order_index,
    params: saved.params,
    meta,
    data,
  };
}
