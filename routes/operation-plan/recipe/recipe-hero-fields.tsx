import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Check, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { EyeBrow } from "@/components/ui/eye-brow";
import { formatCurrency } from "@/lib/currency-utils";
import { useUnitById } from "@/hooks/use-unit";
import { RecipeNameField } from "./recipe-name-field";
import { RecipeImageGallery } from "./recipe-image-gallery";
import { RecipeDifficultyPips } from "./recipe-difficulty-pips";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECIPE_DIFFICULTY_OPTIONS } from "@/constant/recipe";
import type { RecipeFormValues } from "./recipe-form-schema";
import type { RecipeComputed } from "./recipe-form";
import type { RecipeGalleryController } from "./use-recipe-gallery";

interface RecipeHeroFieldsProps {
  readonly form: UseFormReturn<RecipeFormValues>;
  readonly isDisabled: boolean;
  readonly computed: RecipeComputed;
  readonly gallery: RecipeGalleryController;
}

export function RecipeHeroFields({
  form,
  isDisabled,
  computed,
  gallery,
}: RecipeHeroFieldsProps) {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");

  const description = useWatch({ control: form.control, name: "description" });
  const difficulty = useWatch({ control: form.control, name: "difficulty" });
  const prepTime = useWatch({ control: form.control, name: "prep_time" });
  const cookTime = useWatch({ control: form.control, name: "cook_time" });
  const baseYield = useWatch({ control: form.control, name: "base_yield" });

  const yieldUnitId = useWatch({
    control: form.control,
    name: "base_yield_unit",
  });
  const target = useWatch({
    control: form.control,
    name: "target_food_cost_percentage",
  });
  const { data: yieldUnit } = useUnitById(yieldUnitId || undefined);

  const totalTime = (Number(prepTime) || 0) + (Number(cookTime) || 0);
  const targetPct = Number(target) || 0;
  const foodPct = computed.actualFoodCostPct;
  const overTarget = foodPct != null && targetPct > 0 && foodPct > targetPct;

  return (
    <section className="grid gap-4 md:grid-cols-[18rem_minmax(0,1fr)] lg:grid-cols-[22rem_minmax(0,1fr)]">
      {/* Image gallery — existing images from GET + pending uploads (desired state) */}
      <RecipeImageGallery disabled={isDisabled} gallery={gallery} />

      {/* Identity block */}
      <div className="flex min-w-0 flex-col gap-3">
        {/* Pill row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Controller
            control={form.control}
            name="difficulty"
            render={({ field }) => (
              <Select
                value={field.value}
                onValueChange={field.onChange}
                disabled={isDisabled}
              >
                <SelectTrigger
                  size="xs"
                  className="text-micro h-6 gap-1.5 rounded-md px-2 font-semibold tracking-wider"
                  aria-label={tfl("difficulty")}
                >
                  <RecipeDifficultyPips difficulty={difficulty} />
                  <SelectValue placeholder={t("selectDifficulty")} />
                </SelectTrigger>
                <SelectContent>
                  {RECIPE_DIFFICULTY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {ts(
                        opt.value.toLowerCase() as "easy" | "medium" | "hard",
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />

          <Controller
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <button
                type="button"
                onClick={() => !isDisabled && field.onChange(!field.value)}
                disabled={isDisabled}
                className={cn(
                  "text-micro inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-semibold transition-colors",
                  field.value
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground",
                  isDisabled && "cursor-not-allowed opacity-60",
                )}
                aria-pressed={field.value}
              >
                <Check
                  className={cn("size-2.5", field.value && "text-primary")}
                  aria-hidden="true"
                />
                {field.value ? t("active") : t("inactive")}
              </button>
            )}
          />

          <Controller
            control={form.control}
            name="deduct_from_stock"
            render={({ field }) => (
              <button
                type="button"
                onClick={() => !isDisabled && field.onChange(!field.value)}
                disabled={isDisabled}
                className={cn(
                  "text-micro inline-flex h-6 items-center gap-1.5 rounded-md border px-2 font-semibold transition-colors",
                  field.value
                    ? "border-primary/40 bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground",
                  isDisabled && "cursor-not-allowed opacity-60",
                )}
                aria-pressed={field.value}
              >
                <Truck
                  className={cn("size-2.5", field.value && "text-primary")}
                  aria-hidden="true"
                />
                {t("deductsStock")}
              </button>
            )}
          />
        </div>

        {/* Name input · PL-style hero field */}
        <Controller
          control={form.control}
          name="name"
          render={({ field }) => (
            <RecipeNameField
              value={field.value ?? ""}
              onChange={field.onChange}
              placeholder={t("namePlaceholder")}
              disabled={isDisabled}
              error={form.formState.errors.name?.message}
              labels={{
                nameLabel: t("nameLabel"),
                tapToEdit: t("tapToEdit"),
                pressEnterToSave: t("pressEnterToSave"),
                clickToRename: t("clickToRename"),
                requiredField: t("requiredField"),
              }}
            />
          )}
        />

        {/* Description preview */}
        <p
          className={cn(
            "max-w-2xl text-sm leading-relaxed",
            description ? "text-foreground" : "text-muted-foreground italic",
          )}
        >
          {description || tfl("description")}
        </p>

        {/* Quick stats — ตัวเลขชุดเดียวกับคอลัมน์หน้ารายการ: เวลา · ผลผลิต ·
            ต้นทุนต่อเสิร์ฟ · food cost เทียบเป้า (ช่องกรอกจริงอยู่ใน section ข้างล่าง) */}
        <div className="grid grid-cols-2 gap-3 border-t pt-3 md:grid-cols-4">
          <QuickStat
            label={t("total")}
            value={`${totalTime} ${t("minShort")}`}
            sub={`${t("prep")} ${prepTime || 0} · ${t("cook")} ${cookTime || 0}`}
          />
          <QuickStat
            label={t("yield")}
            value={`${baseYield || 0}`}
            sub={yieldUnit?.name}
          />
          <QuickStat
            label={t("costPerPortion")}
            value={`฿${formatCurrency(computed.costPerPortion)}`}
          />
          <QuickStat
            label={t("foodCost")}
            value={foodPct != null ? `${foodPct.toFixed(1)}%` : "—"}
            sub={
              targetPct > 0 ? `${t("targetFoodCost")} ${targetPct}%` : undefined
            }
            tone={overTarget ? "destructive" : undefined}
          />
        </div>
      </div>
    </section>
  );
}

function QuickStat({
  label,
  value,
  sub,
  tone,
}: {
  readonly label: string;
  readonly value: string;
  readonly sub?: React.ReactNode;
  readonly tone?: "destructive";
}) {
  return (
    <div className="min-w-0">
      <EyeBrow className="truncate">{label}</EyeBrow>
      <div
        className={cn(
          "mt-0.5 text-lg font-semibold tracking-tight tabular-nums",
          tone === "destructive" ? "text-destructive" : "text-foreground",
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="text-muted-foreground text-micro truncate tabular-nums">
          {sub}
        </div>
      )}
    </div>
  );
}
