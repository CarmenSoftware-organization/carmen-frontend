import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  DatabaseIcon,
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
  WidgetType,
} from "@/types/dashboard-widget";
import { availableRenders } from "./render-support";
import { getShapeBadge } from "./shape-badge";
import { useDatasetLabel } from "./use-widget-title";
import { useWidgetConfigState } from "./use-widget-config-state";
import { WidgetConfigFields } from "./widget-config-form";
import { groupDatasetsByModule } from "./widget-module";
import { WidgetSampleThumb } from "./widget-sample-thumb";
import { defaultWidgetTypeFor, SUPPORTED_SHAPES } from "./widget-shape";

type AddWidgetHandler = (
  dataset: DashboardDataset,
  params: WidgetParams,
  display: WidgetDisplay,
  titleI18n: LocalizedTitle | null,
  widgetType: WidgetType,
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
 * pop up เพิ่ม widget — 2 หน้า
 *
 * 1. **เลือก** — แกลเลอรีการ์ดจัดตามโมดูล + ค้นหา การ์ดทุกใบมีรูปตัวอย่างจากข้อมูลสมมติ
 *    (`WidgetSampleThumb` — ไม่ยิง API) เลือกแล้วกด "ถัดไป" (ดับเบิลคลิก / Enter = ไปเลย)
 *    หมวดพับ/กางได้: เปิดมาพับทุกหมวด (เห็นแค่ชื่อหมวด + จำนวน) · ค้นหาแล้วกางทุกหมวดที่เจอ
 * 2. **ปรับแต่ง** — ตัวอย่างจริงจากข้อมูลของ BU อยู่บนสุด ฟอร์มตั้งค่าชุดเดียวกับ
 *    `WidgetConfigDialog` อยู่ข้างล่าง · "ย้อนกลับ" กลับแกลเลอรีที่เดิม (คำค้น ตัวที่เลือก ตำแหน่ง scroll)
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
  const tc = useTranslations("common");
  const tm = useTranslations("dashboard.savedWidget.module");
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const locale = useLocale();
  const datasetLabel = useDatasetLabel();
  const { data, isLoading, isError, error, refetch } = useDashboardDatasets();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [step, setStep] = useState<"pick" | "customize">("pick");
  // พับ/กางหมวด แยกสองชุด — ตอนเลื่อนดู เริ่มพับทุกหมวด (12 หมวดเต็มไปด้วยการ์ดมันลายตา)
  // ตอนค้นหา เริ่มกางทุกหมวดที่เจอ และเริ่มใหม่ทุกครั้งที่คำค้นเปลี่ยน · ล้างคำค้นแล้ว
  // หมวดที่ผู้ใช้กางไว้เองก่อนค้นยังกางอยู่เหมือนเดิม
  const [browseOpen, setBrowseOpen] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [searchClosed, setSearchClosed] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const panelIdPrefix = useId();
  const isSearching = query.trim() !== "";
  const isModuleOpen = (module: string) =>
    isSearching ? !searchClosed.has(module) : browseOpen.has(module);
  const toggleModule = (module: string) => {
    const flip = (prev: ReadonlySet<string>) => {
      const next = new Set(prev);
      if (next.has(module)) next.delete(module);
      else next.add(module);
      return next;
    };
    if (isSearching) setSearchClosed(flip);
    else setBrowseOpen(flip);
  };

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
  // หาจากทั้งหมด ไม่ใช่จากผลค้นหา — พิมพ์คำค้นใหม่แล้วตัวที่เลือกอยู่ไม่หลุด
  const selected = datasets.find((d) => d.id === selectedId);
  const customizing = step === "customize" && !!selected;

  const openCustomize = (id: string) => {
    setSelectedId(id);
    setStep("customize");
  };
  const onCardKeyDown = (e: KeyboardEvent<HTMLButtonElement>, id: string) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    openCustomize(id);
  };

  let list: ReactNode;
  if (isLoading) {
    list = (
      <div
        aria-busy="true"
        className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-52 w-full" />
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
    list = groups.map((g) => {
      const label = moduleLabelOf(g.module);
      const isOpen = isModuleOpen(g.module);
      const panelId = `${panelIdPrefix}-${g.module}`;
      return (
        <section
          key={g.module}
          aria-label={label}
          className="border-b last:border-b-0"
        >
          <h3 className="bg-background sticky top-0 z-10">
            <button
              type="button"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggleModule(g.module)}
              className="text-muted-foreground hover:text-foreground focus-visible:ring-ring text-micro-legal flex w-full items-center gap-1.5 px-3 py-2 text-left font-bold tracking-[0.16em] uppercase outline-none focus-visible:ring-2 focus-visible:ring-inset"
            >
              <ChevronRight
                aria-hidden
                className={cn(
                  "size-3.5 shrink-0 transition-transform",
                  isOpen && "rotate-90",
                )}
              />
              {label} <span className="tabular-nums">· {g.items.length}</span>
            </button>
          </h3>
          {/* พับด้วย attribute `hidden` ไม่ unmount — กางกลับมาแล้วรูปตัวอย่างที่วาดไว้ยังอยู่
              (หมวดที่ไม่เคยกาง รูปไม่ถูกวาดเพราะไม่เคยเข้า viewport) */}
          <ul
            id={panelId}
            hidden={!isOpen}
            className="grid grid-cols-1 gap-3 px-3 pt-1 pb-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {g.items.map((d) => {
              const badge = getShapeBadge(d.shape);
              const isSelected = d.id === selectedId;
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedId(d.id)}
                    onDoubleClick={() => openCustomize(d.id)}
                    onKeyDown={(e) => onCardKeyDown(e, d.id)}
                    className={cn(
                      "hover:border-primary/60 focus-visible:ring-ring flex h-full w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-2",
                      isSelected &&
                        "border-primary ring-primary bg-accent/40 ring-1",
                    )}
                  >
                    <span className="line-clamp-2 text-sm font-medium">
                      {labelOf(d)}
                    </span>
                    {/* badge อยู่บรรทัดของมันเอง — ชื่อยาว ถ้าแบ่งบรรทัดกับ badge จะโดนตัดจนแยกตัวที่ชื่อคล้ายกันไม่ออก */}
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
                    <WidgetSampleThumb dataset={d} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      );
    });
  }

  return (
    <>
      <DialogHeader className="border-b px-6 pt-6 pb-4">
        <DialogTitle>{t("addTitle")}</DialogTitle>
        <DialogDescription>
          {customizing ? t("customizeDescription") : t("addDescription")}
        </DialogDescription>
      </DialogHeader>

      {/* แกลเลอรีซ่อนไว้ ไม่ unmount ตอนอยู่หน้าปรับแต่ง — ย้อนกลับมาแล้ว scroll / รูปที่วาดแล้วยังอยู่
          (attribute `hidden` — preflight ของ Tailwind บังคับ display:none ชนะ class `flex`) */}
      <div hidden={customizing} className="flex min-h-0 flex-1 flex-col">
        <div className="relative border-b p-3">
          <Search className="text-muted-foreground absolute top-1/2 left-5.5 size-3.5 -translate-y-1/2" />
          <Input
            size="sm"
            className="w-full pl-8"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchClosed(new Set());
            }}
            placeholder={t("searchWidgets")}
            aria-label={t("searchWidgets")}
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{list}</div>
        <DialogFooter className="border-t px-6 py-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            <X />
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            disabled={!selected}
            onClick={() => selected && openCustomize(selected.id)}
          >
            {tc("next")}
            <ArrowRight />
          </Button>
        </DialogFooter>
      </div>

      {customizing && (
        <AddWidgetDetail
          key={selected.id}
          dataset={selected}
          label={labelOf(selected)}
          custom={renderPreview?.(selected)}
          isPending={isPending}
          onAdd={onAdd}
          onBack={() => setStep("pick")}
        />
      )}
    </>
  );
}

/**
 * หน้าปรับแต่งของตัวที่เลือก — ถือ state ของฟอร์มเอง ผู้เรียกใส่ `key={dataset.id}`
 * กลับไปเลือกตัวอื่นแล้วจึงเริ่มจากค่าตั้งต้นของ dataset ใหม่ ไม่พกค่าของตัวก่อนมา
 */
function AddWidgetDetail({
  dataset,
  label,
  custom,
  isPending,
  onAdd,
  onBack,
}: {
  readonly dataset: DashboardDataset;
  readonly label: string;
  readonly custom: ReactNode | undefined;
  readonly isPending?: boolean;
  readonly onAdd: AddWidgetHandler;
  readonly onBack: () => void;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const state = useWidgetConfigState({ dataset });
  // เริ่มที่ชนิดตั้งต้นของ dataset แล้วให้ผู้ใช้เปลี่ยนได้ในส่วนการแสดงผล — จบในที่เดียว ไม่ต้องไปกดบนการ์ดทีหลัง
  const [widgetType, setWidgetType] = useState<WidgetType>(() =>
    defaultWidgetTypeFor(dataset),
  );
  const widgetTypes = availableRenders(
    dataset.shape,
    dataset.supported_renders,
    dataset.dimension,
  );
  const badge = getShapeBadge(dataset.shape);
  const isCustom = custom !== undefined;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
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
              {t("livePreview")}
            </h3>
            {custom}
          </div>
        ) : (
          <WidgetConfigFields
            dataset={dataset}
            state={state}
            widgetType={widgetType}
            widgetTypes={widgetTypes}
            onWidgetTypeChange={setWidgetType}
            disabled={isPending}
          />
        )}
      </div>

      <AddWidgetFooter
        onBack={onBack}
        isPending={isPending}
        onSubmit={() =>
          isCustom
            ? onAdd(dataset, {}, {}, null, widgetType)
            : onAdd(
                dataset,
                state.values,
                state.display,
                state.titleI18n,
                widgetType,
              )
        }
        isInvalid={!isCustom && state.isTitleInvalid}
      />
    </>
  );
}

function AddWidgetFooter({
  onBack,
  onSubmit,
  isPending,
  isInvalid,
}: {
  readonly onBack: () => void;
  readonly onSubmit: () => void;
  readonly isPending?: boolean;
  readonly isInvalid?: boolean;
}) {
  const t = useTranslations("dashboard.savedWidget");
  const tc = useTranslations("common");
  // ดับเบิลคลิกปุ่มเพิ่ม = คลิกที่สองมาถึงก่อน isPending ของ mutation จะปิดปุ่ม ได้ widget ซ้ำสองใบ
  // (เจอบนเว็บจริง 2026-11-04) — กันด้วย ref แล้วปลดเมื่อ pending จบ บันทึกไม่ผ่านก็กดใหม่ได้
  const isSubmittingRef = useRef(false);
  useEffect(() => {
    if (!isPending) isSubmittingRef.current = false;
  }, [isPending]);
  const submitOnce = () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    onSubmit();
  };
  return (
    <DialogFooter className="border-t px-6 py-4">
      <Button
        type="button"
        variant="outline"
        onClick={onBack}
        disabled={isPending}
      >
        <ArrowLeft />
        {tc("back")}
      </Button>
      <Button
        type="button"
        onClick={submitOnce}
        disabled={isPending || isInvalid}
      >
        <Plus />
        {t("addSubmit")}
      </Button>
    </DialogFooter>
  );
}
