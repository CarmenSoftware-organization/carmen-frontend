import { useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  DragOverlay,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { useTranslations } from "use-intl";
import {
  CheckCircle2,
  Clock,
  GripVertical,
  Plus,
  Search,
  Stamp,
  Waypoints,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  useWatch,
  type UseFormReturn,
  type UseFieldArrayReturn,
} from "react-hook-form";
import type { Role, RoutingRule, Stage } from "@/types/workflows";
import { cn } from "@/lib/utils";
import { makeRecipients, type WorkflowCreateModel } from "./wf-form-schema";
import SortableStageItem, { type StageRouteHint } from "./wf-sort-table-item";
import { computeWorkflowInsights } from "./wf-insights-utils";
import { formatCycleTime } from "./wf-sla-utils";

interface WfStageListProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly fieldArray: UseFieldArrayReturn<WorkflowCreateModel, "data.stages">;
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
  readonly isDisabled: boolean;
  /** ไฮไลต์ขั้นที่เลือกเฉพาะตอนแท็บ Stages เปิดอยู่ — แท็บอื่นไม่ได้ "อยู่ที่" ขั้นไหน */
  readonly showSelection?: boolean;
  readonly routingRules?: RoutingRule[];
  /** ไม่มี issue จาก validateWorkflow — แสดงเป็นเครื่องหมายเล็กแทนแบนเนอร์เต็มแถว */
  readonly isValid?: boolean;
  readonly className?: string;
}

/** เกินจำนวนนี้ถึงจะมีช่องค้นหา — รางสั้น ๆ มองเห็นครบอยู่แล้ว */
const SEARCH_THRESHOLD = 8;

const formatSla = (
  stage: (Pick<Stage, "sla"> & { sla_unit?: string }) | undefined,
): string =>
  stage?.sla && stage.sla !== "0"
    ? `${stage.sla}${stage.sla_unit?.[0] ?? "h"}`
    : "";

const buildNewStage = (
  existingNames: string[],
  newStageName: (n: number) => string,
): Stage => {
  let n = 1;
  let name = newStageName(n);
  while (existingNames.includes(name)) {
    n++;
    name = newStageName(n);
  }

  return {
    name,
    description: "",
    sla: "24",
    sla_unit: "hours",
    role: "approve",
    available_actions: {
      submit: {
        is_active: false,
        recipients: makeRecipients(false, false, false),
      },
      approve: {
        is_active: true,
        recipients: makeRecipients(true, false, true),
      },
      reject: {
        is_active: true,
        recipients: makeRecipients(true, false, false),
      },
      sendback: {
        is_active: true,
        recipients: makeRecipients(true, false, false),
      },
    },
    hide_fields: { price_per_unit: false, total_price: false },
    is_show_signature: false,
    assigned_users: [],
    is_hod: false,
  };
};

export function WfStageList({
  form,
  fieldArray,
  selectedIndex,
  onSelect,
  isDisabled,
  showSelection = true,
  routingRules = [],
  isValid = false,
  className,
}: WfStageListProps) {
  const { fields, move, insert } = fieldArray;
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [stageToDelete, setStageToDelete] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations("systemAdmin.workflow");
  const tc = useTranslations("common");

  const watchedStages = useWatch({
    control: form.control,
    name: "data.stages",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const stageIds = fields.map((f) => f.id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stageIds.indexOf(active.id as string);
    const newIndex = stageIds.indexOf(over.id as string);

    if (oldIndex === 0 || oldIndex === fields.length - 1) return;
    if (newIndex === 0 || newIndex === fields.length - 1) return;

    move(oldIndex, newIndex);
    if (selectedIndex === oldIndex) onSelect(newIndex);
  };

  const handleAddStage = () => {
    const names = fields.map((f) => f.name);
    const newStage = buildNewStage(names, (n) => t("newStage", { n }));
    insert(fields.length - 1, newStage);
    onSelect(fields.length - 1);
  };

  const confirmDelete = () => {
    if (stageToDelete === null) return;
    const { remove } = fieldArray;
    remove(stageToDelete);
    if (selectedIndex === stageToDelete) {
      onSelect(Math.max(0, stageToDelete - 1));
    } else if (selectedIndex > stageToDelete) {
      onSelect(selectedIndex - 1);
    }
    setStageToDelete(null);
  };

  const activeDragIndex = activeDragId ? stageIds.indexOf(activeDragId) : -1;

  const filteredFields = fields
    .map((f, i) => ({ ...f, originalIndex: i }))
    .filter((f) => {
      if (!searchQuery) return true;
      const stageName = watchedStages?.[f.originalIndex]?.name ?? f.name;
      return stageName.toLowerCase().includes(searchQuery.toLowerCase());
    });

  const filteredIds = filteredFields.map((f) => f.id);

  // ตัวเลขชุดเดียวกับแท็บ Insights — เดิมผังนับ "ขั้นกลางทั้งหมด" เป็นผู้อนุมัติ
  // (รวมขั้น Purchase) ทำให้สองจุดในหน้าเดียวกันบอกคนละเลข
  const insights = computeWorkflowInsights((watchedStages ?? []) as Stage[]);
  const approverCount = insights.stats.approverStages;
  const cycleTime = formatCycleTime(insights.totalCycleMinutes);

  const routesByStage = new Map<string, StageRouteHint[]>();
  for (const rule of routingRules) {
    const from = rule.trigger_stage;
    const target = rule.action?.parameters?.target_stage;
    if (!from || !target) continue;
    const list = routesByStage.get(from) ?? [];
    list.push({ name: rule.name, target });
    routesByStage.set(from, list);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
          {t("stages")}
          <Badge variant="secondary" size="xs" className="tabular-nums">
            {fields.length}
          </Badge>
        </h2>
        {!isDisabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddStage}
            className="hover:bg-muted/50"
          >
            <Plus className="mr-1.5 size-3.5" />
            {t("addStage")}
          </Button>
        )}
      </div>

      <div className="text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {approverCount > 0 && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Stamp className="size-3" aria-hidden="true" />
            {approverCount}{" "}
            {approverCount === 1 ? t("approver") : t("approvers")}
          </span>
        )}
        {cycleTime && (
          <span className="inline-flex items-center gap-1 tabular-nums">
            <Clock className="size-3" aria-hidden="true" />
            {t("cycleTime")}{" "}
            <span className="text-foreground font-medium">{cycleTime}</span>
          </span>
        )}
        {isValid && (
          <span className="text-success-ink inline-flex items-center gap-1">
            <CheckCircle2 className="size-3" aria-hidden="true" />
            {t("validationReadyShort")}
          </span>
        )}
      </div>

      {(fields.length > SEARCH_THRESHOLD || searchQuery) && (
        <div className="relative">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            placeholder={tc("search") || "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="sm"
            className="pl-8"
          />
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={filteredIds}
          strategy={verticalListSortingStrategy}
        >
          <ol className="relative space-y-1">
            {filteredFields.length > 1 && (
              <span
                aria-hidden="true"
                className="bg-border absolute top-5 bottom-4 left-3 w-px"
              />
            )}
            {filteredFields.length === 0 ? (
              <li className="animate-in fade-in zoom-in-95 flex flex-col items-center justify-center py-10 text-center duration-200">
                <Waypoints className="text-muted-foreground/30 mb-3 size-10" />
                <p className="text-foreground text-sm font-medium">
                  {tc("noData") || "No stages found"}
                </p>
                {!isDisabled && !searchQuery && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddStage}
                    className="mt-4"
                  >
                    <Plus className="mr-1.5 size-3.5" />
                    {t("addStage")}
                  </Button>
                )}
              </li>
            ) : (
              filteredFields.map((field) => {
                const index = field.originalIndex;
                const stage = watchedStages?.[index];
                const isFirst = index === 0;
                const isLast = index === fields.length - 1;
                const isHod = stage?.is_hod ?? false;
                const userCount = stage?.assigned_users?.length ?? 0;
                const hasWarning =
                  !isFirst && !isLast && !isHod && userCount === 0;
                const stageName = stage?.name ?? field.name;
                return (
                  <SortableStageItem
                    key={field.id}
                    id={field.id}
                    index={index}
                    name={stageName}
                    role={stage?.role as Role | undefined}
                    slaLabel={formatSla(stage)}
                    routes={routesByStage.get(stageName)}
                    isSelected={showSelection && selectedIndex === index}
                    isFirst={isFirst}
                    isLast={isLast}
                    userCount={userCount}
                    isHod={isHod}
                    hasWarning={hasWarning}
                    dragDisabled={isDisabled || searchQuery.length > 0}
                    onClick={() => onSelect(index)}
                    onDelete={
                      !isDisabled && !isFirst && !isLast
                        ? () => setStageToDelete(index)
                        : undefined
                    }
                  />
                );
              })
            )}
          </ol>
        </SortableContext>

        <DragOverlay>
          {activeDragIndex >= 0 ? (
            <div className="bg-background ring-border flex scale-[1.02] items-center gap-3 rounded-lg border px-3 py-2 text-sm opacity-90 shadow-xl ring-1">
              <GripVertical className="text-muted-foreground/50 size-4" />
              <span className="font-medium">
                {watchedStages?.[activeDragIndex]?.name ??
                  fields[activeDragIndex]?.name}
              </span>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <DeleteDialog
        open={stageToDelete !== null}
        onOpenChange={(open) => !open && setStageToDelete(null)}
        title={t("deleteTitle")}
        description={
          stageToDelete !== null
            ? t("deleteConfirm", {
                name:
                  watchedStages?.[stageToDelete]?.name ??
                  fields[stageToDelete]?.name ??
                  "",
              })
            : ""
        }
        onConfirm={confirmDelete}
      />
    </div>
  );
}
