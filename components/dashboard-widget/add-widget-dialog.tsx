import { useState, type ReactNode } from "react";
import {
  ArrowLeft,
  DatabaseIcon,
  LayoutGrid,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ErrorState } from "@/components/ui/error-state";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useDashboardDatasets } from "@/hooks/use-dashboard-dataset";
import { cn } from "@/lib/utils";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import type {
  LocalizedTitle,
  WidgetDisplay,
  WidgetParams,
} from "@/types/dashboard-widget";
import { getShapeBadge } from "./shape-badge";
import { useDatasetLabel } from "./use-widget-title";
import { useWidgetConfigState } from "./use-widget-config-state";
import { WidgetConfigFields } from "./widget-config-form";
import { groupDatasetsByModule } from "./widget-module";
import { defaultWidgetTypeFor, SUPPORTED_SHAPES } from "./widget-shape";

type AddWidgetHandler = (
  dataset: DashboardDataset,
  params: WidgetParams,
  display: WidgetDisplay,
  titleI18n: LocalizedTitle | null,
) => void;

interface AddWidgetDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  /** รายการที่หน้าเว็บประกอบเอง (เช่น preset status group) — ขึ้นปนกับ catalogue ตามหมวด */
  readonly extraItems?: readonly DashboardDataset[];
  /** dataset ที่ไม่ให้เพิ่มซ้ำ — ซ่อนจากรายการ */
  readonly excludeIds?: ReadonlySet<string>;
  readonly isPending?: boolean;
  /**
   * preview ของรายการที่ไม่ใช่ dataset จริง (backend exec ไม่ได้) — คืน node = โชว์ node นั้น
   * แทนฟอร์มตั้งค่า แล้วเพิ่มด้วยค่าว่าง · คืน undefined = ฟอร์มปกติ
   */
  readonly renderPreview?: (dataset: DashboardDataset) => ReactNode | undefined;
  /** ผู้เรียกปิด pop up เองเมื่อบันทึกสำเร็จ */
  readonly onAdd: AddWidgetHandler;
}

/**
 * pop up เพิ่ม widget — ซ้าย: รายการ widget จัดตามโมดูล + ค้นหา · ขวา: ฟอร์มตั้งค่า
 * ชุดเดียวกับ `WidgetConfigDialog` พร้อม preview สด · จอแคบแสดงทีละฝั่ง
 */
export function AddWidgetDialog({
  open,
  onOpenChange,
  isPending,
  ...rest
}: AddWidgetDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => !isPending && onOpenChange(o)}>
      <DialogContent className="flex h-[min(90vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
        {/* อยู่ใต้ DialogContent ซึ่ง unmount ตอนปิด — เปิดใหม่ได้คำค้น/ตัวที่เลือกว่างเสมอ */}
        <AddWidgetBody
          {...rest}
          isPending={isPending}
          onCancel={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

function AddWidgetBody({
  extraItems,
  excludeIds,
  isPending,
  renderPreview,
  onAdd,
  onCancel,
}: Omit<AddWidgetDialogProps, "open" | "onOpenChange"> & {
  readonly onCancel: () => void;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const tm = useTranslations("dashboard.savedWidget.module");
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const locale = useLocale();
  const datasetLabel = useDatasetLabel();
  const { data, isLoading, isError, error, refetch } = useDashboardDatasets();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const shapes: readonly string[] = SUPPORTED_SHAPES;
  const datasets = [...(extraItems ?? []), ...(data?.items ?? [])].filter(
    (d) => !excludeIds?.has(d.id) && shapes.includes(d.shape),
  );
  const labelOf = (d: DashboardDataset) => datasetLabel(d.id, d.name);
  const moduleLabelOf = (module: string) =>
    tm.has(module) ? tm(module) : module;
  const groups = groupDatasetsByModule(datasets, {
    labelOf,
    moduleLabelOf,
    query,
    locale,
  });
  // หาจากทั้งหมด ไม่ใช่จากผลค้นหา — พิมพ์คำค้นใหม่แล้วตัวที่เลือกอยู่ไม่หลุดจากฝั่งขวา
  const selected = datasets.find((d) => d.id === selectedId);

  let list: ReactNode;
  if (isLoading) {
    list = (
      <div aria-busy="true" className="space-y-2 p-3">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  } else if (isError) {
    list = <ErrorState error={error} onRetry={() => void refetch()} />;
  } else if (groups.length === 0) {
    list = (
      <EmptyComponent
        icon={DatabaseIcon}
        title={tl("noFound", { entity: tfl("dataset") })}
        description={tl("noFoundDesc")}
      />
    );
  } else {
    list = groups.map((g) => (
      <section key={g.module} aria-label={moduleLabelOf(g.module)}>
        <h3 className="bg-background text-muted-foreground text-micro-legal sticky top-0 z-10 px-3 py-1.5 font-bold tracking-[0.16em] uppercase">
          {moduleLabelOf(g.module)}{" "}
          <span className="tabular-nums">· {g.items.length}</span>
        </h3>
        <ul className="space-y-0.5 px-1.5 pb-2">
          {g.items.map((d) => {
            const badge = getShapeBadge(d.shape);
            const isSelected = d.id === selectedId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "hover:bg-accent focus-visible:ring-ring flex w-full flex-col gap-0.5 rounded-md px-2 py-1.5 text-left outline-none focus-visible:ring-2",
                    isSelected && "bg-accent",
                  )}
                >
                  {/* badge อยู่บรรทัดล่าง — ชื่อ dataset ยาว ถ้าแบ่งบรรทัดกับ badge จะโดนตัดจนแยกตัวที่ชื่อคล้ายกันไม่ออก */}
                  <span className="line-clamp-2 text-sm">{labelOf(d)}</span>
                  <span className="flex min-w-0 items-center gap-1.5">
                    <Badge
                      variant={badge.variant}
                      size="xs"
                      className="shrink-0"
                    >
                      {badge.label}
                    </Badge>
                    {d.description && (
                      <span className="text-muted-foreground text-micro truncate">
                        {d.description}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    ));
  }

  return (
    <>
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle>{t("addTitle")}</DialogTitle>
        <DialogDescription>{t("addDescription")}</DialogDescription>
      </DialogHeader>

      <div className="flex min-h-0 flex-1">
        <div
          className={cn(
            "min-h-0 w-full flex-col md:flex md:w-72 md:shrink-0 md:border-r",
            selected ? "hidden" : "flex",
          )}
        >
          <div className="relative border-b p-3">
            <Search className="text-muted-foreground absolute top-1/2 left-5.5 size-3.5 -translate-y-1/2" />
            <Input
              size="sm"
              className="w-full pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("searchWidgets")}
              aria-label={t("searchWidgets")}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        </div>

        <div
          className={cn(
            "min-h-0 min-w-0 flex-1 flex-col md:flex",
            selected ? "flex" : "hidden",
          )}
        >
          {selected ? (
            <AddWidgetDetail
              key={selected.id}
              dataset={selected}
              label={labelOf(selected)}
              custom={renderPreview?.(selected)}
              isPending={isPending}
              onAdd={onAdd}
              onBack={() => setSelectedId(null)}
              onCancel={onCancel}
            />
          ) : (
            <>
              <div className="text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm">
                <LayoutGrid className="size-6" aria-hidden="true" />
                <p>{t("pickHint")}</p>
              </div>
              <AddWidgetFooter onCancel={onCancel} isPending={isPending} />
            </>
          )}
        </div>
      </div>
    </>
  );
}

/**
 * ฝั่งขวาของตัวที่เลือก — ถือ state ของฟอร์มเอง ผู้เรียกใส่ `key={dataset.id}`
 * สลับตัวแล้วจึงเริ่มจากค่าตั้งต้นของ dataset ใหม่ ไม่พกค่าของตัวก่อนมา
 */
function AddWidgetDetail({
  dataset,
  label,
  custom,
  isPending,
  onAdd,
  onBack,
  onCancel,
}: {
  readonly dataset: DashboardDataset;
  readonly label: string;
  readonly custom: ReactNode | undefined;
  readonly isPending?: boolean;
  readonly onAdd: AddWidgetHandler;
  readonly onBack: () => void;
  readonly onCancel: () => void;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const state = useWidgetConfigState({ dataset });
  const badge = getShapeBadge(dataset.shape);
  const isCustom = custom !== undefined;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="-ml-2 md:hidden"
          onClick={onBack}
        >
          <ArrowLeft />
          {t("backToList")}
        </Button>

        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-foreground text-base font-semibold">{label}</h3>
            <Badge variant={badge.variant} size="xs">
              {badge.label}
            </Badge>
          </div>
          {dataset.description && (
            <p className="text-muted-foreground text-sm">
              {dataset.description}
            </p>
          )}
        </div>

        {isCustom ? (
          <div className="space-y-1.5">
            <h3 className="text-muted-foreground text-micro-legal font-bold tracking-[0.16em] uppercase">
              {t("preview")}
            </h3>
            {custom}
          </div>
        ) : (
          <WidgetConfigFields
            dataset={dataset}
            state={state}
            widgetType={defaultWidgetTypeFor(dataset)}
            disabled={isPending}
          />
        )}
      </div>

      <AddWidgetFooter
        onCancel={onCancel}
        isPending={isPending}
        onSubmit={() =>
          isCustom
            ? onAdd(dataset, {}, {}, null)
            : onAdd(dataset, state.values, state.display, state.titleI18n)
        }
        isInvalid={!isCustom && state.isTitleInvalid}
      />
    </>
  );
}

function AddWidgetFooter({
  onCancel,
  onSubmit,
  isPending,
  isInvalid,
}: {
  readonly onCancel: () => void;
  /** ไม่ส่ง = ยังไม่ได้เลือก widget ปุ่มเพิ่มกดไม่ได้ */
  readonly onSubmit?: () => void;
  readonly isPending?: boolean;
  readonly isInvalid?: boolean;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const tc = useTranslations("common");
  return (
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
        onClick={onSubmit}
        disabled={!onSubmit || isPending || isInvalid}
      >
        <Plus />
        {t("addSubmit")}
      </Button>
    </DialogFooter>
  );
}
