import { useState } from "react";
import {
  Controller,
  useWatch,
  type UseFormReturn,
  type UseFieldArrayReturn,
} from "react-hook-form";
import { Plus, Trash2, Search, Waypoints } from "lucide-react";
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
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { useDepartment } from "@/hooks/use-department";
import { PagedChecklist } from "@/components/lookup/paged-checklist";
import type { Department } from "@/types/department";
import type { Product } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { cn } from "@/lib/utils";
import {
  actionTypeKeys,
  actionTypeValues,
  conditionFieldKeys,
  conditionFieldValues,
  operatorKeys,
  operatorValues,
} from "./wf-routing-constants";
import { CategoryCheckboxList } from "./wf-routing-category-list";

interface WfRoutingProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly fieldArray: UseFieldArrayReturn<
    WorkflowCreateModel,
    "data.routing_rules"
  >;
  readonly stages: { id: string; name: string }[];
  readonly allProducts: Product[];
  readonly isDisabled: boolean;
}

export function WfRouting({
  form,
  fieldArray,
  stages,
  allProducts,
  isDisabled,
}: WfRoutingProps) {
  const { fields, append, remove } = fieldArray;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const t = useTranslations("systemAdmin.workflow");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tl = useTranslations("lookup");

  const stageNames = stages.map((s) => s.name);

  const safeIndex =
    selectedIndex >= fields.length
      ? Math.max(0, fields.length - 1)
      : selectedIndex;

  const handleAddRule = () => {
    append({
      name: t("newRule", { n: fields.length + 1 }),
      description: "",
      trigger_stage: stageNames[0] ?? "",
      condition: { field: "", operator: "eq", value: [] },
      action: {
        type: "NEXT_STAGE",
        parameters: { target_stage: stageNames[stageNames.length - 1] ?? "" },
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

  const watchedRules = useWatch({
    control: form.control,
    name: "data.routing_rules",
  });
  const currentRule = watchedRules?.[safeIndex];
  const watchedField = currentRule?.condition?.field;
  const watchedOperator = currentRule?.condition?.operator;
  const watchedConditionValue = currentRule?.condition?.value;

  const handleFieldChange = (value: string) => {
    form.setValue(`data.routing_rules.${safeIndex}.condition.field`, value);
    form.setValue(`data.routing_rules.${safeIndex}.condition.operator`, "eq");
    form.setValue(`data.routing_rules.${safeIndex}.condition.value`, []);
    form.setValue(
      `data.routing_rules.${safeIndex}.condition.min_value`,
      undefined,
    );
    form.setValue(
      `data.routing_rules.${safeIndex}.condition.max_value`,
      undefined,
    );
  };

  const filteredFields = fields
    .map((f, i) => ({ ...f, originalIndex: i }))
    .filter((f) => {
      if (!searchQuery) return true;
      const ruleName = watchedRules?.[f.originalIndex]?.name ?? f.name;
      return ruleName.toLowerCase().includes(searchQuery.toLowerCase());
    });

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
        {!isDisabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddRule}
            className="mt-4"
          >
            <Plus className="mr-1.5 size-3.5" />
            {tc("add")}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 pt-4 lg:flex-row">
      {/* Left: Rule list */}
      <div className="w-full shrink-0 space-y-3 lg:w-64">
        <div className="flex items-center justify-between px-1">
          <span className="text-foreground text-sm font-semibold">
            {t("rules")}
          </span>
          {!isDisabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddRule}
              className="hover:bg-muted/50"
            >
              <Plus className="mr-1.5 size-3.5" />
              {tc("add")}
            </Button>
          )}
        </div>

        <div className="relative px-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            placeholder={tc("search") || "Search..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="sm"
            className="pl-8"
          />
        </div>

        {filteredFields.length === 0 ? (
          <div className="animate-in fade-in zoom-in-95 flex flex-col items-center justify-center py-10 text-center duration-200">
            <Waypoints className="text-muted-foreground/30 mb-3 size-10" />
            <p className="text-foreground text-sm font-medium">
              {tc("noData") || "No routing rules found"}
            </p>
            {!isDisabled && !searchQuery && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddRule}
                className="mt-4"
              >
                <Plus className="mr-1.5 size-3.5" />
                {tc("add")}
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filteredFields.map((field) => {
              const idx = field.originalIndex;
              return (
                <div
                  key={field.id}
                  className={cn(
                    "group animate-in fade-in slide-in-from-left-2 flex items-center justify-between gap-2 rounded-xl border p-1 pl-4 transition-all duration-200 duration-300",
                    safeIndex === idx
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-border/80 hover:bg-muted/40",
                  )}
                >
                  <button
                    type="button"
                    className={cn(
                      "flex-1 truncate text-left text-sm transition-colors",
                      safeIndex === idx
                        ? "text-primary font-semibold"
                        : "text-foreground font-medium",
                    )}
                    onClick={() => setSelectedIndex(idx)}
                  >
                    {watchedRules?.[idx]?.name || `Rule ${idx + 1}`}
                  </button>
                  {!isDisabled && (
                    <button
                      type="button"
                      className={cn(
                        "flex shrink-0 cursor-pointer items-center justify-center rounded p-1.5 transition-all duration-200",
                        safeIndex === idx
                          ? "text-destructive hover:bg-destructive/10"
                          : "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
                      )}
                      onClick={() => handleRemoveRule(idx)}
                      aria-label={tc("delete")}
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Rule detail */}
      <div className="@container min-w-0 flex-1">
        {fields.length === 0 ? (
          <p className="text-muted-foreground py-10 text-center text-sm">
            {t("selectOrAddRule")}
          </p>
        ) : (
          <div className="space-y-8">
            <FieldGroup className="gap-4">
              <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                <Field>
                  <FieldLabel>{t("ruleName")}</FieldLabel>
                  <Input
                    size="sm"
                    disabled={isDisabled}
                    {...form.register(`data.routing_rules.${safeIndex}.name`)}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("triggerStage")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name={`data.routing_rules.${safeIndex}.trigger_stage`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isDisabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stageNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>

              <Field>
                <FieldLabel>{tfl("description")}</FieldLabel>
                <Textarea
                  className="min-h-[80px]"
                  disabled={isDisabled}
                  placeholder={tfl("optional")}
                  maxLength={256}
                  {...form.register(
                    `data.routing_rules.${safeIndex}.description`,
                  )}
                />
              </Field>
            </FieldGroup>

            {/* Condition section */}
            <div className="space-y-4">
              <span className="text-foreground block border-b pb-3 text-sm font-semibold">
                {t("condition")}
              </span>

              <FieldGroup className="gap-4 pt-4">
                <div
                  className={cn(
                    "grid gap-4",
                    watchedField === "total_amount"
                      ? "grid-cols-1 @md:grid-cols-2"
                      : "grid-cols-1",
                  )}
                >
                  <Field>
                    <FieldLabel>{tfl("field")}</FieldLabel>
                    <Select
                      value={watchedField ?? ""}
                      onValueChange={handleFieldChange}
                      disabled={isDisabled}
                    >
                      <SelectTrigger>
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
                  </Field>

                  {watchedField === "total_amount" && (
                    <Field>
                      <FieldLabel>{t("operator")}</FieldLabel>
                      <Controller
                        control={form.control}
                        name={`data.routing_rules.${safeIndex}.condition.operator`}
                        render={({ field }) => (
                          <Select
                            value={field.value}
                            onValueChange={field.onChange}
                            disabled={isDisabled}
                          >
                            <SelectTrigger>
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
                    </Field>
                  )}
                </div>

                {watchedField === "total_amount" &&
                  watchedOperator !== "between" && (
                    <Field>
                      <FieldLabel>{t("value")}</FieldLabel>
                      <Input
                        type="number"
                        size="sm"
                        disabled={isDisabled}
                        value={watchedConditionValue?.[0] ?? ""}
                        onChange={(e) =>
                          form.setValue(
                            `data.routing_rules.${safeIndex}.condition.value`,
                            e.target.value ? [e.target.value] : [],
                          )
                        }
                      />
                    </Field>
                  )}

                {watchedField === "total_amount" &&
                  watchedOperator === "between" && (
                    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
                      <Field>
                        <FieldLabel>{t("minValue")}</FieldLabel>
                        <Input
                          type="number"
                          size="sm"
                          disabled={isDisabled}
                          {...form.register(
                            `data.routing_rules.${safeIndex}.condition.min_value`,
                          )}
                        />
                      </Field>
                      <Field>
                        <FieldLabel>{t("maxValue")}</FieldLabel>
                        <Input
                          type="number"
                          size="sm"
                          disabled={isDisabled}
                          {...form.register(
                            `data.routing_rules.${safeIndex}.condition.max_value`,
                          )}
                        />
                      </Field>
                    </div>
                  )}

                {watchedField === "department" && (
                  <Field>
                    <FieldLabel>{t("departments")}</FieldLabel>
                    {/* ค่าของเงื่อนไขคือ "ชื่อแผนก" ไม่ใช่ id — ดึงชื่อที่เลือกด้วย name|string:
                        แผนกที่เปลี่ยนชื่อหลังบันทึก rule จะขึ้นเป็นชื่อเดิมดิบและเอาออกได้
                        key={safeIndex}: สลับ rule แล้วช่องค้นเริ่มใหม่ ไม่ค้างคำค้นของ rule ก่อน */}
                    <PagedChecklist<Department>
                      key={safeIndex}
                      useListHook={useDepartment}
                      getId={(d) => d.name}
                      getLabel={(d) => d.name}
                      idFilterKey="name"
                      value={watchedConditionValue ?? []}
                      onChange={(val) =>
                        form.setValue(
                          `data.routing_rules.${safeIndex}.condition.value`,
                          val,
                        )
                      }
                      disabled={isDisabled}
                      maxHeight={128}
                      searchPlaceholder={tl("search", {
                        entity: tfl("department"),
                      })}
                      emptyMessage={
                        <span className="text-muted-foreground text-xs">
                          {t("noDepartments")}
                        </span>
                      }
                    />
                  </Field>
                )}

                {watchedField === "category" && (
                  <CategoryCheckboxList
                    form={form}
                    allProducts={allProducts}
                    ruleIndex={safeIndex}
                    isDisabled={isDisabled}
                  />
                )}
              </FieldGroup>
            </div>

            {/* Action section */}
            <div className="space-y-4">
              <span className="text-foreground block border-b pb-3 text-sm font-semibold">
                {t("actionLabel")}
              </span>

              <div className="grid grid-cols-1 gap-4 pt-4 @md:grid-cols-2">
                <Field>
                  <FieldLabel>{tfl("type")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name={`data.routing_rules.${safeIndex}.action.type`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isDisabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {actionTypeValues.map((value) => (
                            <SelectItem key={value} value={value}>
                              {t(actionTypeKeys[value])}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>

                <Field>
                  <FieldLabel>{t("targetStage")}</FieldLabel>
                  <Controller
                    control={form.control}
                    name={`data.routing_rules.${safeIndex}.action.parameters.target_stage`}
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                        disabled={isDisabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {stageNames.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </Field>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
