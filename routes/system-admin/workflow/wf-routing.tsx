import { useState, type ReactNode } from "react";
import {
  Controller,
  useWatch,
  type UseFormReturn,
  type UseFieldArrayReturn,
} from "react-hook-form";
import {
  ArrowRight,
  CornerDownRight,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
  Waypoints,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { useDepartment } from "@/hooks/use-department";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { PagedChecklist } from "@/components/lookup/paged-checklist";
import type { Department } from "@/types/department";
import type { Product } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { cn } from "@/lib/utils";
import {
  conditionFieldKeys,
  conditionFieldValues,
  operatorKeys,
  operatorValues,
} from "./wf-routing-constants";
import {
  routingActionType,
  routingRuleIssue,
  routingSkippedStages,
  routingTargetOptions,
  ROUTING_ISSUE_KEY,
} from "./wf-routing-utils";
import { CategoryCheckboxList } from "./wf-routing-category-list";
import { WfStructureAddButton } from "./wf-structure-lock-notice";

type RoutingRule = WorkflowCreateModel["data"]["routing_rules"][number];

// ช่องค้นหากฎโผล่เมื่อรายการยาวจนไล่ตาไม่ไหว — workflow ส่วนใหญ่มีกฎแค่ 1–5 ข้อ
const SEARCH_THRESHOLD = 6;

const DIRTY = { shouldDirty: true } as const;

const OPERATOR_SYMBOL: Record<string, string> = {
  eq: "=",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
};

interface WfRoutingProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly fieldArray: UseFieldArrayReturn<
    WorkflowCreateModel,
    "data.routing_rules"
  >;
  readonly allProducts: Product[];
  readonly isDisabled: boolean;
  /** โครงถูกล็อกเพราะมีเอกสารค้าง — ปุ่มเพิ่มแสดงเป็นสีเทาพร้อมเหตุผลนี้แทนการหายไป */
  readonly lockedReason?: string;
}

export function WfRouting({
  form,
  fieldArray,
  allProducts,
  isDisabled,
  lockedReason,
}: WfRoutingProps) {
  const { fields, append, remove } = fieldArray;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations("systemAdmin.workflow");
  const tc = useTranslations("common");
  const formatAmount = useAmountFormatter();

  // ชื่อขั้นอ่านจากค่าสดของฟอร์ม — `fields` ของ field array ค้างชื่อตอนเพิ่มขั้น
  // เปลี่ยนชื่อขั้นแล้ว dropdown จะยังโชว์ชื่อเดิม
  const watchedStages = useWatch({
    control: form.control,
    name: "data.stages",
  });
  const stageNames = (watchedStages ?? []).map((s) => s.name);

  const watchedRules = useWatch({
    control: form.control,
    name: "data.routing_rules",
  });

  const safeIndex =
    selectedIndex >= fields.length
      ? Math.max(0, fields.length - 1)
      : selectedIndex;

  const handleAddRule = () => {
    const trigger = stageNames[0] ?? "";
    const target = stageNames[stageNames.length - 1] ?? "";
    append({
      name: t("newRule", { n: fields.length + 1 }),
      description: "",
      trigger_stage: trigger,
      condition: { field: "", operator: "eq", value: [] },
      action: {
        type: routingActionType(stageNames, trigger, target),
        parameters: { target_stage: target },
      },
    });
    setSelectedIndex(fields.length);
  };

  const handleRemoveRule = (idx: number) => {
    remove(idx);
    if (safeIndex >= fields.length - 1) {
      setSelectedIndex(Math.max(0, fields.length - 2));
    }
  };

  const summarize = (rule: RoutingRule | undefined): string | null => {
    const cond = rule?.condition;
    if (!cond?.field) return null;
    const label = t(conditionFieldKeys[cond.field]);
    const amount = (v: string | undefined) => {
      const n = Number(v);
      return v && !Number.isNaN(n) ? formatAmount(n) : "…";
    };
    if (cond.field === "total_amount") {
      return cond.operator === "between"
        ? `${label} ${amount(cond.min_value)}–${amount(cond.max_value)}`
        : `${label} ${OPERATOR_SYMBOL[cond.operator] ?? ""} ${amount(cond.value?.[0])}`;
    }
    const values = cond.value ?? [];
    if (values.length === 0) return `${label}: …`;
    const more = values.length > 2 ? ` +${values.length - 2}` : "";
    return `${label}: ${values.slice(0, 2).join(", ")}${more}`;
  };

  // ยังไม่มีกฎเลย = ไม่ต้องแบ่งซ้าย/ขวา (เดิมได้ "No data" กับ "Select or add…" สองก้อนคู่กัน)
  // ก้อนเดียวที่บอกว่า routing ทำอะไร พร้อมปุ่มเพิ่มเมื่ออยู่ในโหมดแก้
  if (fields.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
        <Waypoints
          className="text-muted-foreground/40 mb-3 size-10"
          aria-hidden="true"
        />
        <p className="text-foreground text-sm font-medium">
          {t("routingEmptyTitle")}
        </p>
        <p className="text-muted-foreground mt-1 max-w-sm text-sm">
          {t("routingEmptyDesc")}
        </p>
        <WfStructureAddButton
          label={tc("add")}
          onClick={handleAddRule}
          isDisabled={isDisabled}
          lockedReason={lockedReason}
          className="mt-4"
        />
      </div>
    );
  }

  // จัดกลุ่มตามขั้นที่กฎทำงาน เรียงตามลำดับขั้น — backend ตรวจกฎของขั้นเดียวกันจากบนลงล่าง
  // แล้วใช้ข้อแรกที่ตรง เลขหน้ากฎจึงเป็นลำดับภายในกลุ่ม ไม่ใช่ลำดับรวม
  const query = searchQuery.trim().toLowerCase();
  const groups = new Map<string, number[]>();
  fields.forEach((f, idx) => {
    const rule = watchedRules?.[idx];
    const name = rule?.name ?? f.name;
    if (query && !name.toLowerCase().includes(query)) return;
    const key = rule?.trigger_stage ?? f.trigger_stage;
    groups.set(key, [...(groups.get(key) ?? []), idx]);
  });
  const stagePosition = (name: string) => {
    const i = stageNames.indexOf(name);
    return i < 0 ? Number.MAX_SAFE_INTEGER : i;
  };
  const orderedGroups = [...groups.entries()].sort(
    ([a], [b]) => stagePosition(a) - stagePosition(b),
  );

  return (
    <div className="flex flex-col gap-6 pt-4 lg:flex-row">
      {/* Left: rules grouped by trigger stage */}
      <div className="w-full shrink-0 space-y-3 lg:w-64">
        <div className="flex items-center justify-between px-1">
          <span className="text-foreground text-sm font-semibold">
            {t("rules")}
          </span>
          <WfStructureAddButton
            label={tc("add")}
            onClick={handleAddRule}
            isDisabled={isDisabled}
            lockedReason={lockedReason}
          />
        </div>

        {fields.length > SEARCH_THRESHOLD && (
          <div className="relative px-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              placeholder={tc("search")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              size="sm"
              className="pl-8"
            />
          </div>
        )}

        {orderedGroups.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">
            {tc("noData")}
          </p>
        ) : (
          <div className="space-y-4">
            {orderedGroups.map(([trigger, indexes]) => (
              <div key={trigger} className="space-y-1">
                <p className="text-muted-foreground flex items-baseline gap-1.5 px-1 text-xs">
                  <span className="text-foreground truncate font-medium">
                    {stageNames.includes(trigger)
                      ? trigger
                      : t("routingUnknownStage")}
                  </span>
                  {indexes.length > 1 && (
                    <span className="shrink-0">· {t("routingFirstMatch")}</span>
                  )}
                </p>
                {indexes.map((idx, order) => {
                  const rule = watchedRules?.[idx];
                  const isSelected = safeIndex === idx;
                  const hasIssue = !!routingRuleIssue(rule, stageNames);
                  return (
                    <div
                      key={fields[idx].id}
                      className={cn(
                        "group relative flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors",
                        isSelected
                          ? "border-primary/50 bg-primary/5"
                          : "hover:bg-muted/50 border-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-px flex size-5 shrink-0 items-center justify-center rounded-full text-xs tabular-nums",
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground",
                        )}
                      >
                        {order + 1}
                      </span>
                      {/* after: ขยายพื้นที่กดให้เต็มแถว โดยไม่ซ้อนปุ่มลบไว้ในปุ่มเลือก */}
                      <button
                        type="button"
                        aria-current={isSelected || undefined}
                        className="min-w-0 flex-1 text-left after:absolute after:inset-0 after:content-['']"
                        onClick={() => setSelectedIndex(idx)}
                      >
                        <span className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              "text-foreground truncate text-sm",
                              isSelected ? "font-semibold" : "font-medium",
                            )}
                          >
                            {rule?.name || t("newRule", { n: idx + 1 })}
                          </span>
                          {hasIssue && (
                            <TriangleAlert
                              className="text-warning-ink size-3.5 shrink-0"
                              aria-label={t("routingNeedsAttention")}
                            />
                          )}
                        </span>
                        <span className="text-muted-foreground mt-0.5 block truncate text-xs">
                          {summarize(rule) ?? t("routingNoCondition")}
                        </span>
                        <span className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
                          <ArrowRight className="size-3 shrink-0" />
                          <span className="truncate">
                            {rule?.action.parameters.target_stage || "—"}
                          </span>
                        </span>
                      </button>
                      {!isDisabled && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          className={cn(
                            "text-muted-foreground hover:text-destructive hover:bg-destructive/10 relative z-10 shrink-0",
                            !isSelected &&
                              "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                          )}
                          onClick={() => handleRemoveRule(idx)}
                          aria-label={tc("delete")}
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: the selected rule read as WHEN / IF / THEN */}
      <div className="@container min-w-0 flex-1">
        <RuleDetail
          key={fields[safeIndex].id}
          form={form}
          index={safeIndex}
          stageNames={stageNames}
          allProducts={allProducts}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  );
}

interface SentenceRowProps {
  readonly label: string;
  readonly children: ReactNode;
}

function SentenceRow({ label, children }: SentenceRowProps) {
  return (
    <div className="grid grid-cols-1 gap-2 @sm:grid-cols-[3.5rem_1fr] @sm:gap-4">
      <span className="text-muted-foreground text-xs font-semibold tracking-wide uppercase @sm:pt-2">
        {label}
      </span>
      <div className="min-w-0 space-y-3">{children}</div>
    </div>
  );
}

interface RuleDetailProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly index: number;
  readonly stageNames: string[];
  readonly allProducts: Product[];
  readonly isDisabled: boolean;
}

/** กฎที่เลือก — ผูก key กับ field id เพื่อให้ state ของช่องคำอธิบาย/ช่องค้นแผนกเริ่มใหม่ทุกครั้งที่สลับกฎ */
function RuleDetail({
  form,
  index,
  stageNames,
  allProducts,
  isDisabled,
}: RuleDetailProps) {
  const t = useTranslations("systemAdmin.workflow");
  const tfl = useTranslations("field");
  const tl = useTranslations("lookup");

  const rule = useWatch({
    control: form.control,
    name: `data.routing_rules.${index}`,
  });
  const [showDescription, setShowDescription] = useState(!!rule?.description);

  const path = `data.routing_rules.${index}` as const;
  const trigger = rule?.trigger_stage ?? "";
  const target = rule?.action.parameters.target_stage ?? "";
  const field = rule?.condition.field;
  const operator = rule?.condition.operator;
  const conditionValue = rule?.condition.value;

  // ขั้นสุดท้าย (Completed) ไม่มีขั้นถัดไปให้ส่งต่อ จึงเป็นจุดเริ่มของกฎไม่ได้
  const triggerOptions = stageNames.slice(0, -1);
  const targetOptions = routingTargetOptions(stageNames, trigger);
  const skipped = routingSkippedStages(stageNames, trigger, target);
  const issue = routingRuleIssue(rule, stageNames);

  const applyRoute = (nextTrigger: string, nextTarget: string) => {
    // ปลายทางเดิมไม่อยู่หลังขั้นใหม่ = จะวนกลับ จึงเลื่อนไปขั้นสุดท้ายแทน (ค่าเดียวกับกฎใหม่)
    const options = routingTargetOptions(stageNames, nextTrigger);
    const resolved = options.includes(nextTarget)
      ? nextTarget
      : (options[options.length - 1] ?? nextTarget);
    form.setValue(`${path}.trigger_stage`, nextTrigger, DIRTY);
    form.setValue(`${path}.action.parameters.target_stage`, resolved, DIRTY);
    form.setValue(
      `${path}.action.type`,
      routingActionType(stageNames, nextTrigger, resolved),
      DIRTY,
    );
  };

  const handleFieldChange = (value: string) => {
    form.setValue(`${path}.condition.field`, value, DIRTY);
    form.setValue(`${path}.condition.operator`, "eq", DIRTY);
    form.setValue(`${path}.condition.value`, [], DIRTY);
    form.setValue(`${path}.condition.min_value`, undefined, DIRTY);
    form.setValue(`${path}.condition.max_value`, undefined, DIRTY);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Field>
          <FieldLabel className="sr-only">{t("ruleName")}</FieldLabel>
          <Input
            disabled={isDisabled}
            placeholder={t("ruleName")}
            className="font-semibold"
            {...form.register(`${path}.name`)}
          />
        </Field>
        {showDescription ? (
          <Field>
            <FieldLabel className="sr-only">{tfl("description")}</FieldLabel>
            <Textarea
              className="min-h-[64px]"
              disabled={isDisabled}
              placeholder={tfl("description")}
              maxLength={256}
              {...form.register(`${path}.description`)}
            />
          </Field>
        ) : (
          !isDisabled && (
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-muted-foreground -ml-2"
              onClick={() => setShowDescription(true)}
            >
              <Plus />
              {t("routingAddDescription")}
            </Button>
          )
        )}
      </div>

      <div className="space-y-5 border-t pt-5">
        <SentenceRow label={t("routingWhen")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {t("routingLeaves")}
            </span>
            <Select
              value={trigger}
              onValueChange={(v) => applyRoute(v, target)}
              disabled={isDisabled}
            >
              <SelectTrigger
                className="w-full @sm:w-56"
                aria-label={t("triggerStage")}
              >
                <SelectValue placeholder={t("triggerStage")} />
              </SelectTrigger>
              <SelectContent>
                {triggerOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </SentenceRow>

        <SentenceRow label={t("routingIf")}>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={field ?? ""}
              onValueChange={handleFieldChange}
              disabled={isDisabled}
            >
              <SelectTrigger
                className="w-full @sm:w-44"
                aria-label={tfl("field")}
              >
                <SelectValue placeholder={t("selectField")} />
              </SelectTrigger>
              <SelectContent>
                {conditionFieldValues.map((value) => (
                  <SelectItem key={value} value={value}>
                    {t(conditionFieldKeys[value])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {field === "total_amount" && (
              <>
                <Controller
                  control={form.control}
                  name={`${path}.condition.operator`}
                  render={({ field: f }) => (
                    <Select
                      value={f.value}
                      onValueChange={f.onChange}
                      disabled={isDisabled}
                    >
                      <SelectTrigger
                        className="w-full @sm:w-40"
                        aria-label={t("operator")}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {operatorValues.map((value) => (
                          <SelectItem key={value} value={value}>
                            {t(operatorKeys[value])}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {operator === "between" ? (
                  <div className="flex w-full items-center gap-2 @sm:w-auto">
                    <Input
                      type="number"
                      size="sm"
                      className="@sm:w-28"
                      aria-label={t("minValue")}
                      placeholder={t("minValue")}
                      disabled={isDisabled}
                      {...form.register(`${path}.condition.min_value`)}
                    />
                    <span className="text-muted-foreground text-sm">–</span>
                    <Input
                      type="number"
                      size="sm"
                      className="@sm:w-28"
                      aria-label={t("maxValue")}
                      placeholder={t("maxValue")}
                      disabled={isDisabled}
                      {...form.register(`${path}.condition.max_value`)}
                    />
                  </div>
                ) : (
                  <Input
                    type="number"
                    size="sm"
                    className="w-full @sm:w-36"
                    aria-label={t("value")}
                    placeholder={t("value")}
                    disabled={isDisabled}
                    value={conditionValue?.[0] ?? ""}
                    onChange={(e) =>
                      form.setValue(
                        `${path}.condition.value`,
                        e.target.value ? [e.target.value] : [],
                        DIRTY,
                      )
                    }
                  />
                )}
              </>
            )}
          </div>

          {/* ค่าของเงื่อนไขคือ "ชื่อแผนก" ไม่ใช่ id — ดึงชื่อที่เลือกด้วย name|string:
              แผนกที่เปลี่ยนชื่อหลังบันทึก rule จะขึ้นเป็นชื่อเดิมดิบและเอาออกได้ */}
          {field === "department" && (
            <PagedChecklist<Department>
              useListHook={useDepartment}
              getId={(d) => d.name}
              getLabel={(d) => d.name}
              idFilterKey="name"
              value={conditionValue ?? []}
              onChange={(val) =>
                form.setValue(`${path}.condition.value`, val, DIRTY)
              }
              disabled={isDisabled}
              maxHeight={160}
              searchPlaceholder={tl("search", { entity: tfl("department") })}
              emptyMessage={
                <span className="text-muted-foreground text-xs">
                  {t("noDepartments")}
                </span>
              }
            />
          )}

          {field === "category" && (
            <CategoryCheckboxList
              form={form}
              allProducts={allProducts}
              ruleIndex={index}
              isDisabled={isDisabled}
            />
          )}
        </SentenceRow>

        <SentenceRow label={t("routingThen")}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {t("routingGoTo")}
            </span>
            <Select
              value={targetOptions.includes(target) ? target : ""}
              onValueChange={(v) => applyRoute(trigger, v)}
              disabled={isDisabled || targetOptions.length === 0}
            >
              <SelectTrigger
                className="w-full @sm:w-56"
                aria-label={t("targetStage")}
              >
                <SelectValue placeholder={t("targetStage")} />
              </SelectTrigger>
              <SelectContent>
                {targetOptions.map((name) => (
                  <SelectItem key={name} value={name}>
                    {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {targetOptions.includes(target) && (
            <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
              <CornerDownRight className="mt-px size-3.5 shrink-0" />
              {skipped.length > 0
                ? t("routingSkips", { stages: skipped.join(" · ") })
                : t("routingNoSkip")}
            </p>
          )}
        </SentenceRow>
      </div>

      {issue && (
        <p
          role="status"
          className="border-warning/40 bg-warning/10 text-warning-ink flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {t(ROUTING_ISSUE_KEY[issue])}
        </p>
      )}
    </div>
  );
}
