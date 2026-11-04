import { useCallback, useMemo, useRef, useState } from "react";
import {
  closestCorners,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { WidgetSkeletonCards } from "@/components/dashboard-widget/dashboard-widget-grid";
import { SortableWidgetItem } from "@/components/dashboard-widget/sortable-widget-item";
import { AddWidgetDialog } from "@/components/dashboard-widget/add-widget-dialog";
import { WidgetConfigDialog } from "@/components/dashboard-widget/widget-config-dialog";
import { defaultWidgetTypeFor } from "@/components/dashboard-widget/widget-shape";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { cn } from "@/lib/utils";
import { PERMISSIONS } from "@/constant/permissions";
import { QUERY_KEYS } from "@/constant/query-keys";
import { useBuCode } from "@/hooks/use-bu-code";
import {
  buDashboardWidgetDataQueryOptions,
  useCreateBuDashboardWidget,
  useDeleteBuDashboardWidget,
  useBuDashboardWidgets,
  useReorderBuDashboardWidgets,
  useUpdateBuDashboardWidget,
} from "@/hooks/use-bu-dashboard-widgets";
import { useCan } from "@/hooks/use-can";
import { useWidgetTitle } from "./use-widget-title";
import { customWidgetTitle } from "./widget-title";
import { useDashboardDatasets } from "@/hooks/use-dashboard-dataset";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import type {
  BuDashboardWidget,
  BuDashboardWidgetListResponse,
  LocalizedTitle,
  WidgetDisplay,
  WidgetParams,
  WidgetType,
} from "@/types/dashboard-widget";

interface BuWidgetSectionProps {
  /** "main" = หน้า /dashboard หลัก หรือชื่อ module dashboard */
  readonly module: string;
  readonly title: string;
  /** class ของ <section> — ใส่ระยะห่างที่นี่ เพื่อให้ตอนซ่อนส่วนนี้ไม่เหลือช่องว่าง */
  readonly className?: string;
}

/**
 * ส่วน BU widget ที่ทุกคนใน BU เห็น — ใช้ร่วมทั้ง /dashboard และ module dashboard
 * ซ่อนทั้งก้อนเมื่อ backend ยังไม่พร้อม หรือ BU ไม่มี widget และผู้ใช้เพิ่มไม่ได้
 */
export function BuWidgetSection({
  module,
  title,
  className,
}: BuWidgetSectionProps) {
  const t = useTranslations("dashboard.buWidget");
  const tt = useTranslations("toast");
  const queryClient = useQueryClient();
  const buCode = useBuCode();
  const { can } = useCan();
  const canEdit = can(PERMISSIONS.dashboard.bu_widget.update);
  const canCreate = can(PERMISSIONS.dashboard.bu_widget.create);

  const { data, isLoading, isError } = useBuDashboardWidgets(module);
  const items = useMemo(
    () =>
      [...(data?.items ?? [])].sort((a, b) => a.order_index - b.order_index),
    [data?.items],
  );
  const ids = useMemo(() => items.map((w) => w.id), [items]);

  const [pendingDelete, setPendingDelete] = useState<BuDashboardWidget | null>(
    null,
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const titleOf = useWidgetTitle();
  const [pendingConfig, setPendingConfig] = useState<BuDashboardWidget | null>(
    null,
  );
  // id ของ widget ที่เลื่อนถึงแล้ว — เพิ่มอย่างเดียว ไม่ถอดออกตอน scroll ผ่านไป
  const [visibleIds, setVisibleIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const markVisible = useCallback((id: string) => {
    setVisibleIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  const { data: catalogue } = useDashboardDatasets();
  const datasetsById = useMemo(
    () => new Map((catalogue?.items ?? []).map((d) => [d.id, d] as const)),
    [catalogue?.items],
  );
  const createWidget = useCreateBuDashboardWidget();
  const updateWidget = useUpdateBuDashboardWidget();
  const deleteWidget = useDeleteBuDashboardWidget();
  const reorder = useReorderBuDashboardWidgets();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const dataQueries = useQueries({
    queries: items.map((w) =>
      buDashboardWidgetDataQueryOptions(buCode, w.id, visibleIds.has(w.id)),
    ),
  });

  // เตือนครั้งเดียวต่อการโหลดหน้า: การบันทึกครั้งแรกทำให้ BU หลุดจาก default ของ platform
  const warnedRef = useRef(false);
  const customizedAt = data?.deploy_state?.customized_at ?? null;
  const warnOnce = useCallback(() => {
    if (warnedRef.current || customizedAt) return;
    warnedRef.current = true;
    toast.warning(t("customizeWarning"));
  }, [customizedAt, t]);

  const wireModule = module === "main" ? null : module;
  const nextOrder = useMemo(
    () => (items.at(-1)?.order_index ?? 0) + 10,
    [items],
  );

  // backend ยังไม่ deploy / ล่ม → ซ่อนเงียบ ๆ (refetch พังตอนมีข้อมูลแล้ว ยังโชว์ของเดิม)
  if (isError && !data) return null;
  // คนเพิ่มไม่ได้: ไม่โชว์หัว/skeleton ระหว่างโหลด จนกว่าจะรู้ว่ามี widget จริง
  if (items.length === 0 && !canCreate) return null;

  const handleAdd = (
    ds: DashboardDataset,
    params: WidgetParams,
    display: WidgetDisplay,
    titleI18n: LocalizedTitle | null,
  ) => {
    createWidget.mutate(
      {
        dataset_id: ds.id,
        widget_type: defaultWidgetTypeFor(ds),
        // title คู่กับ title_i18n เป็น fallback ของ backend รุ่นเก่า (backend ใหม่ใช้ title_i18n เป็นหลัก)
        ...(titleI18n ? { title: titleI18n.en, title_i18n: titleI18n } : {}),
        params,
        display,
        module: wireModule,
        order_index: nextOrder,
      },
      {
        onSuccess: () => {
          warnOnce();
          toast.success(tt("createSuccess", { entity: t("entity") }));
          setPickerOpen(false);
        },
      },
    );
  };

  const handleConfigure = (
    params: WidgetParams,
    display: WidgetDisplay,
    titleI18n: LocalizedTitle | null,
  ) => {
    if (!pendingConfig) return;
    const target = pendingConfig;
    updateWidget.mutate(
      {
        id: target.id,
        params,
        display,
        title: titleI18n?.en ?? null,
        title_i18n: titleI18n,
      },
      {
        onSuccess: () => {
          warnOnce();
          toast.success(tt("updateSuccess", { entity: t("entity") }));
          // เจาะจงตัวเดียว — invalidate ทั้งก้อนจะทำให้ทุก widget refetch พร้อมกัน
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.BU_DASHBOARD_WIDGET_DATA, buCode, target.id],
          });
          setPendingConfig(null);
        },
      },
    );
  };

  const handleChangeType = (w: BuDashboardWidget, widgetType: WidgetType) => {
    updateWidget.mutate(
      { id: w.id, widget_type: widgetType },
      { onSuccess: warnOnce },
    );
  };

  const handleConfirmDelete = () => {
    if (!pendingDelete) return;
    deleteWidget.mutate(pendingDelete.id, {
      onSuccess: () => {
        warnOnce();
        toast.success(tt("deleteSuccess", { entity: t("entity") }));
        setPendingDelete(null);
      },
    });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((w) => w.id === active.id);
    const newIndex = items.findIndex((w) => w.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(items, oldIndex, newIndex).map((w, i) => ({
      ...w,
      order_index: (i + 1) * 10,
    }));
    // optimistic — key ต้องตรงกับ useBuDashboardWidgets ไม่งั้นเขียนไม่ลง
    queryClient.setQueryData<BuDashboardWidgetListResponse>(
      [QUERY_KEYS.BU_DASHBOARD_WIDGETS, buCode, module],
      (old) => (old ? { ...old, items: reordered } : old),
    );
    reorder.mutate(
      { items: reordered.map(({ id, order_index }) => ({ id, order_index })) },
      {
        onSuccess: warnOnce,
        onError: () =>
          queryClient.invalidateQueries({
            queryKey: [QUERY_KEYS.BU_DASHBOARD_WIDGETS],
          }),
      },
    );
  };

  const deleteTitleText = pendingDelete
    ? titleOf(pendingDelete, datasetsById.get(pendingDelete.dataset_id)?.name)
    : "";
  const configDataset = pendingConfig
    ? datasetsById.get(pendingConfig.dataset_id)
    : undefined;

  return (
    <section className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-muted-foreground text-micro-legal font-bold tracking-[0.16em] uppercase">
          {title}
        </h2>
        {canCreate && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={createWidget.isPending}
          >
            <Plus aria-hidden="true" />
            {t("add")}
          </Button>
        )}
      </div>

      {isLoading && (
        <div
          aria-busy="true"
          aria-live="polite"
          className="grid auto-rows-[4rem] grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12"
        >
          <WidgetSkeletonCards />
        </div>
      )}

      {!isLoading && items.length === 0 && canCreate && (
        <p className="text-muted-foreground text-sm">{t("empty")}</p>
      )}

      {items.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={canEdit ? handleDragEnd : undefined}
        >
          <SortableContext items={ids} strategy={rectSortingStrategy}>
            <ul className="grid auto-rows-[4rem] grid-cols-1 gap-3 md:grid-cols-6 lg:grid-cols-12">
              {items.map((w, i) => (
                <SortableWidgetItem
                  key={w.id}
                  widget={w}
                  dataset={datasetsById.get(w.dataset_id)}
                  detail={dataQueries[i]?.data}
                  isLoading={dataQueries[i]?.isLoading ?? true}
                  editable={canEdit}
                  onDelete={() => setPendingDelete(w)}
                  onConfigure={() => setPendingConfig(w)}
                  onVisible={markVisible}
                  onChangeType={(type) => handleChangeType(w, type)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      <DeleteDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={t("deleteTitle")}
        description={t("deleteConfirm", { title: deleteTitleText })}
        onConfirm={handleConfirmDelete}
        isPending={deleteWidget.isPending}
      />

      {canCreate && (
        <AddWidgetDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          isPending={createWidget.isPending}
          onAdd={handleAdd}
        />
      )}

      {pendingConfig && configDataset && (
        <WidgetConfigDialog
          open
          onOpenChange={(o) => !o && setPendingConfig(null)}
          dataset={configDataset}
          initialParams={pendingConfig.params}
          initialDisplay={pendingConfig.display}
          initialTitle={customWidgetTitle(pendingConfig, configDataset.name)}
          widgetType={pendingConfig.widget_type}
          isPending={updateWidget.isPending}
          onSubmit={handleConfigure}
        />
      )}
    </section>
  );
}
