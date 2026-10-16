import {
  Controller,
  useFieldArray,
  useFormState,
  type UseFormReturn,
} from "react-hook-form";
import { useTranslations } from "use-intl";
import { ArrowDown, ArrowUp, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Field,
  FieldError,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SettingSection } from "@/components/ui/setting-section";
import { LookupRecipeEquipment } from "@/components/lookup/lookup-recipe-equipment";
import {
  nullableNumberInput,
  type RecipeFormValues,
} from "./recipe-form-schema";
import type { StepDraft } from "./recipe-steps-sync";

interface RecipeStepsFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  /** สูตรที่ยังไม่บันทึก — ยังไม่มี recipe_id ให้ผูกขั้นตอน */
  readonly isNew: boolean;
}

const EMPTY_STEP: StepDraft = {
  step_id: null,
  doc_version: null,
  title: "",
  description: "",
  duration: null,
  temperature: null,
  temperature_unit: "c",
  equipment: [],
  chef_notes: "",
  safety_warnings: "",
};

/** ขั้นตอนทำ — บันทึกพร้อมปุ่ม Save ของฟอร์ม (sync หลังหัวสูตรบันทึกสำเร็จ) */
export function RecipeStepsFields({
  form,
  isDisabled,
  isNew,
}: RecipeStepsFieldsProps) {
  const t = useTranslations("operationPlan.recipe");
  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "preparation_steps",
    keyName: "key",
  });
  // อ่าน error ผ่าน useFormState — อ่าน form.formState ตรง ๆ แล้ว error ไม่ re-render
  const { errors } = useFormState({
    control: form.control,
    name: "preparation_steps",
  });

  return (
    <SettingSection
      plain
      title={t("stepsSection")}
      description={t("stepsSectionDesc")}
    >
      {isNew ? (
        <p className="text-muted-foreground text-sm">{t("stepsAfterSave")}</p>
      ) : (
        <div className="space-y-3">
          {fields.length === 0 && (
            <p className="text-muted-foreground text-sm">{t("noSteps")}</p>
          )}
          {fields.map((field, i) => {
            const stepErrors = errors.preparation_steps?.[i];
            return (
              <div key={field.key} className="rounded-md border p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="bg-muted text-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <FieldInput
                    aria-label={t("stepTitle")}
                    placeholder={t("stepTitle")}
                    size="sm"
                    disabled={isDisabled}
                    maxLength={500}
                    className="min-w-0 flex-1"
                    {...form.register(`preparation_steps.${i}.title`)}
                  />
                  {!isDisabled && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("moveUp")}
                        disabled={i === 0}
                        onClick={() => move(i, i - 1)}
                      >
                        <ArrowUp />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("moveDown")}
                        disabled={i === fields.length - 1}
                        onClick={() => move(i, i + 1)}
                      >
                        <ArrowDown />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("removeStep")}
                        onClick={() => remove(i)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  )}
                </div>

                <Field>
                  <FieldLabel htmlFor={`recipe-step-${i}-description`}>
                    {t("stepDescription")}
                  </FieldLabel>
                  <Textarea
                    id={`recipe-step-${i}-description`}
                    rows={2}
                    disabled={isDisabled}
                    aria-invalid={!!stepErrors?.description}
                    {...form.register(`preparation_steps.${i}.description`)}
                  />
                  <FieldError errors={[stepErrors?.description]} />
                </Field>

                <div className="mt-3 grid gap-3 sm:grid-cols-[8rem_12rem_minmax(0,1fr)]">
                  <Field>
                    <FieldLabel htmlFor={`recipe-step-${i}-duration`}>
                      {t("stepDuration")}
                    </FieldLabel>
                    <FieldInput
                      id={`recipe-step-${i}-duration`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      size="sm"
                      disabled={isDisabled}
                      className="tabular-nums"
                      error={stepErrors?.duration?.message}
                      {...form.register(
                        `preparation_steps.${i}.duration`,
                        nullableNumberInput,
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`recipe-step-${i}-temperature`}>
                      {t("stepTemperature")}
                    </FieldLabel>
                    <div className="flex gap-1.5">
                      <FieldInput
                        id={`recipe-step-${i}-temperature`}
                        type="number"
                        inputMode="decimal"
                        size="sm"
                        disabled={isDisabled}
                        className="min-w-0 flex-1 tabular-nums"
                        error={stepErrors?.temperature?.message}
                        {...form.register(
                          `preparation_steps.${i}.temperature`,
                          nullableNumberInput,
                        )}
                      />
                      <Controller
                        control={form.control}
                        name={`preparation_steps.${i}.temperature_unit`}
                        render={({ field: unit }) => (
                          <Select
                            value={unit.value}
                            onValueChange={unit.onChange}
                            disabled={isDisabled}
                          >
                            <SelectTrigger
                              size="sm"
                              className="w-16"
                              aria-label={t("stepTemperatureUnit")}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="c">°C</SelectItem>
                              <SelectItem value="f">°F</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                      />
                    </div>
                  </Field>
                  <Field>
                    <FieldLabel>{t("stepEquipment")}</FieldLabel>
                    <Controller
                      control={form.control}
                      name={`preparation_steps.${i}.equipment`}
                      render={({ field: eq }) => (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {eq.value.map((item, j) => (
                            <Badge
                              key={`${item.id ?? item.name}-${j}`}
                              variant="secondary"
                              className="gap-1"
                            >
                              {item.name}
                              {!isDisabled && (
                                <button
                                  type="button"
                                  className="hover:bg-foreground/10 focus-visible:ring-ring -mr-1 inline-flex size-5 items-center justify-center rounded-sm outline-none focus-visible:ring-2"
                                  aria-label={t("removeEquipment", {
                                    name: item.name,
                                  })}
                                  onClick={() =>
                                    eq.onChange(
                                      eq.value.filter((_, k) => k !== j),
                                    )
                                  }
                                >
                                  <X />
                                </button>
                              )}
                            </Badge>
                          ))}
                          {!isDisabled && (
                            <LookupRecipeEquipment
                              size="xs"
                              className="w-40"
                              excludeIds={
                                new Set(
                                  eq.value.flatMap((e) => (e.id ? [e.id] : [])),
                                )
                              }
                              onSelect={(picked) => {
                                const name = picked.name ?? picked.code;
                                if (!name) return;
                                eq.onChange([
                                  ...eq.value,
                                  { id: picked.id, name },
                                ]);
                              }}
                            />
                          )}
                          {isDisabled && eq.value.length === 0 && (
                            <span className="text-muted-foreground text-xs">
                              —
                            </span>
                          )}
                        </div>
                      )}
                    />
                  </Field>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor={`recipe-step-${i}-safety`}>
                      {t("stepSafety")}
                    </FieldLabel>
                    <Textarea
                      id={`recipe-step-${i}-safety`}
                      rows={2}
                      maxLength={1000}
                      disabled={isDisabled}
                      {...form.register(
                        `preparation_steps.${i}.safety_warnings`,
                      )}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor={`recipe-step-${i}-chef-notes`}>
                      {t("stepChefNotes")}
                    </FieldLabel>
                    <Textarea
                      id={`recipe-step-${i}-chef-notes`}
                      rows={2}
                      maxLength={1000}
                      disabled={isDisabled}
                      {...form.register(`preparation_steps.${i}.chef_notes`)}
                    />
                  </Field>
                </div>
              </div>
            );
          })}

          {!isDisabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ ...EMPTY_STEP })}
            >
              <Plus />
              {t("addStep")}
            </Button>
          )}
        </div>
      )}
    </SettingSection>
  );
}
