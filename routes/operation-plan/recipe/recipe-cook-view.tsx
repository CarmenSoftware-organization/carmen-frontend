import { useEffect, useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { AlertTriangle, ChevronLeft, ChevronRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BackButton } from "@/components/share/back-button";
import { EyeBrow } from "@/components/ui/eye-brow";
import { useCan } from "@/hooks/use-can";
import { useListReturn } from "@/hooks/use-list-return";
import { useUnitById } from "@/hooks/use-unit";
import { PERMISSIONS } from "@/constant/permissions";
import { ALLERGEN_OPTIONS } from "@/constant/recipe";
import { cn } from "@/lib/utils";
import type { Recipe, RecipePreparationStep } from "@/types/recipe";
import { activeSteps, normalizeEquipment } from "./recipe-steps-sync";
import { activeIngredients, formatQty } from "./recipe-ingredients-cost";
import { useWakeLock } from "./use-wake-lock";

const LIST_PATH = "/operation-plan/recipe";
const ALLERGEN_LABEL = new Map<string, string>(
  ALLERGEN_OPTIONS.map((a) => [a.value, a.label]),
);

/**
 * โหมดทำอาหาร — หน้าอ่านอย่างเดียวสำหรับแท็บเล็ตในครัว เปิดมาเจอขั้นตอนทำทีละขั้น
 * ไม่มีช่องกรอกและไม่มีตัวเลขต้นทุน (แก้สูตร/ตั้งราคาอยู่ที่ /:id/edit)
 */
export function RecipeCookView({ recipe }: { readonly recipe: Recipe }) {
  const t = useTranslations("operationPlan.recipe");
  const { can, canWrite } = useCan();
  const { toList, returnState } = useListReturn(LIST_PATH);
  const { data: yieldUnit } = useUnitById(recipe.base_yield_unit || undefined);
  useWakeLock(true);

  const steps = activeSteps(recipe.preparation_steps);
  const [index, setIndex] = useState(0);
  const total = steps.length;
  // สัญญาหมดอายุ = เข้าฟอร์มได้แต่ Save ไม่ได้ อย่าชวนกดตั้งแต่หน้านี้
  const canEdit = canWrite && can(PERMISSIONS.operation_plan.recipe.update);
  const editLink = (
    <Button asChild variant="outline" size="sm">
      <Link to={`${LIST_PATH}/${recipe.id}/edit`} state={returnState}>
        <Pencil />
        {t("editRecipe")}
      </Link>
    </Button>
  );

  // refetch อาจได้ขั้นน้อยลง — ให้ index อยู่ในช่วงเสมอ (ไม่งั้นป้าย "ขั้นที่ 5 / 3")
  const step = total === 0 ? 0 : Math.min(index, total - 1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const el = e.target;
      if (
        el instanceof HTMLElement &&
        (el.isContentEditable || el.closest("input, textarea, select"))
      )
        return;
      if (total === 0) return;
      if (e.key === "ArrowRight")
        setIndex((i) => Math.min(Math.min(i, total - 1) + 1, total - 1));
      if (e.key === "ArrowLeft")
        setIndex((i) => Math.max(Math.min(i, total - 1) - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [total]);
  const current = steps[step];
  const next = steps[step + 1];

  const totalTime = (recipe.prep_time ?? 0) + (recipe.cook_time ?? 0);
  const allergens = recipe.allergens ?? [];
  const ingredients = activeIngredients(recipe.ingredients);
  // ติ๊กแล้วเก็บแค่ในหน้านี้ — รีเฟรชแล้วเริ่มใหม่ (ครัวเช็กของต่อรอบที่ทำ)
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 md:px-6">
      {/* หัว — ชื่อ + ข้อมูลที่ครัวต้องรู้ก่อนลงมือ */}
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b pb-4">
        <div className="flex min-w-0 items-start gap-2">
          <BackButton onClick={() => toList()} label={t("backToRecipes")} />
          <div className="min-w-0">
            <h1 className="text-foreground text-2xl font-semibold tracking-tight break-words">
              {recipe.name}
            </h1>
            <div className="text-muted-foreground mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="tabular-nums">{recipe.code}</span>
              {recipe.base_yield > 0 && (
                <span>
                  {t("cookYield", {
                    qty: recipe.base_yield,
                    unit: yieldUnit?.name ?? "",
                  })}
                </span>
              )}
              {totalTime > 0 && (
                <span>{t("cookTotalTime", { min: totalTime })}</span>
              )}
            </div>
          </div>
        </div>
        {canEdit && editLink}
      </header>

      <div className="grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {/* ขั้นตอน */}
        <section aria-label={t("stepsSection")} className="min-w-0">
          {total === 0 || !current ? (
            <div className="text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
              <p>{t("cookNoSteps")}</p>
              {canEdit && <div className="mt-3">{editLink}</div>}
            </div>
          ) : (
            <>
              <CookStep step={current} n={step + 1} total={total} />

              {next && (
                <button
                  type="button"
                  onClick={() => setIndex(step + 1)}
                  className="text-muted-foreground hover:bg-muted mt-3 w-full rounded-lg border p-3 text-left text-sm transition-colors"
                >
                  <span className="text-micro font-semibold tracking-wider uppercase">
                    {t("cookNextUp")}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block">
                    {next.title || next.description}
                  </span>
                </button>
              )}

              <div className="mt-4 grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12 text-base"
                  disabled={step === 0}
                  onClick={() => setIndex(step - 1)}
                >
                  <ChevronLeft />
                  {t("cookPrev")}
                </Button>
                <Button
                  type="button"
                  className="h-12 text-base"
                  disabled={step >= total - 1}
                  onClick={() => setIndex(step + 1)}
                >
                  {t("cookNext")}
                  <ChevronRight />
                </Button>
              </div>

              <ol className="mt-6 space-y-1" aria-label={t("cookAllSteps")}>
                {steps.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      aria-current={i === step ? "step" : undefined}
                      onClick={() => setIndex(i)}
                      className={cn(
                        "flex min-h-11 w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                        i === step
                          ? "bg-muted text-foreground font-semibold"
                          : "text-muted-foreground hover:bg-muted/60",
                      )}
                    >
                      <span className="w-6 shrink-0 text-right tabular-nums">
                        {i + 1}
                      </span>
                      <span className="line-clamp-1">
                        {s.title || s.description}
                      </span>
                      {s.duration ? (
                        <span className="ml-auto shrink-0 text-xs tabular-nums">
                          {t("cookMinutes", { min: s.duration })}
                        </span>
                      ) : null}
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        {/* ข้าง — เช็กลิสต์วัตถุดิบ · จัดจาน · เก็บรักษา · allergens (ไม่มีตัวเลขเงิน) */}
        <aside className="space-y-5 md:border-l md:pl-6">
          {ingredients.length > 0 && (
            <div>
              <EyeBrow className="mb-1.5">{t("cookIngredients")}</EyeBrow>
              <ul className="space-y-0.5">
                {ingredients.map((line) => {
                  const id = `cook-ingredient-${line.id}`;
                  const isChecked = checked.has(line.id);
                  const isRecipe = line.ingredient_type === "recipe";
                  const name =
                    line.sub_recipe?.name ??
                    line.product?.name ??
                    line.product?.code ??
                    "—";
                  return (
                    <li key={line.id}>
                      {/* checkbox กับลิงก์แยกกัน — ลิงก์ไปสูตรฐานต้องไม่ติ๊ก/ไม่ถูกติ๊กแทน */}
                      <div className="hover:bg-muted/60 relative flex min-h-11 items-start gap-3 rounded-md px-2 py-2">
                        {/* label ขยายเต็มแถว — แตะตรงไหนก็ติ๊กได้ (ลิงก์ z-10 อยู่เหนือ) */}
                        <label
                          htmlFor={id}
                          aria-hidden="true"
                          className="absolute inset-0 cursor-pointer rounded-md"
                        />
                        <Checkbox
                          id={id}
                          aria-label={name}
                          checked={isChecked}
                          onCheckedChange={(v) => toggle(line.id, v === true)}
                          className="relative z-10 mt-0.5 size-5"
                        />
                        <div
                          className={cn(
                            "min-w-0 flex-1 text-sm",
                            isChecked && "text-muted-foreground line-through",
                          )}
                        >
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2">
                            <span
                              className={cn(
                                "font-medium break-words",
                                !isChecked && "text-foreground",
                              )}
                            >
                              {isRecipe && line.sub_recipe_id ? (
                                <>
                                  <Badge
                                    variant="info-light"
                                    size="xs"
                                    className="mr-1.5"
                                  >
                                    {t("subRecipeBadge")}
                                  </Badge>
                                  <Link
                                    to={`${LIST_PATH}/${line.sub_recipe_id}`}
                                    className="relative z-10 underline underline-offset-2"
                                  >
                                    {name}
                                  </Link>
                                </>
                              ) : (
                                name
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {formatQty(line.qty)}{" "}
                              {line.ingredient_unit?.name ?? ""}
                            </span>
                          </div>
                          {line.note && (
                            <span className="text-muted-foreground mt-0.5 block text-xs">
                              {line.note}
                            </span>
                          )}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {recipe.plating_instructions && (
            <div>
              <EyeBrow className="mb-1.5">{t("cookPlating")}</EyeBrow>
              <p className="text-foreground text-sm whitespace-pre-line">
                {recipe.plating_instructions}
              </p>
            </div>
          )}
          {recipe.storage_instructions && (
            <div>
              <EyeBrow className="mb-1.5">{t("cookStorage")}</EyeBrow>
              <p className="text-foreground text-sm whitespace-pre-line">
                {recipe.storage_instructions}
              </p>
            </div>
          )}
          {allergens.length > 0 && (
            <div>
              <EyeBrow className="mb-1.5">{t("cookAllergens")}</EyeBrow>
              <div className="flex flex-wrap gap-1.5">
                {allergens.map((a) => (
                  <Badge key={a} variant="secondary">
                    {ALLERGEN_LABEL.get(a.toLowerCase()) ?? a}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function CookStep({
  step,
  n,
  total,
}: {
  readonly step: RecipePreparationStep;
  readonly n: number;
  readonly total: number;
}) {
  const t = useTranslations("operationPlan.recipe");
  const equipment = normalizeEquipment(step.equipment);
  const temperature =
    step.temperature === null || step.temperature === ""
      ? null
      : Number(step.temperature);
  const meta = [
    step.duration ? t("cookMinutes", { min: step.duration }) : null,
    temperature !== null && Number.isFinite(temperature)
      ? `${temperature}°${(step.temperature_unit ?? "c").toUpperCase()}`
      : null,
    equipment.length > 0 ? equipment.map((e) => e.name).join(", ") : null,
  ].filter(Boolean);

  return (
    <article
      className="border-primary rounded-lg border-2 p-4 md:p-5"
      aria-live="polite"
    >
      <div className="text-muted-foreground flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
        <span className="text-foreground font-semibold">
          {t("cookStepOf", { n, total })}
        </span>
        {meta.map((m) => (
          <span key={m} className="tabular-nums">
            {m}
          </span>
        ))}
      </div>
      {step.title && (
        <h2 className="text-foreground mt-2 text-lg font-semibold break-words">
          {step.title}
        </h2>
      )}
      <p className="text-foreground mt-2 text-xl leading-relaxed break-words whitespace-pre-line">
        {step.description}
      </p>
      {step.safety_warnings && (
        <div className="border-warning/50 bg-warning/10 text-warning-ink mt-4 flex gap-2 rounded-md border p-3 text-sm">
          <AlertTriangle
            className="mt-0.5 size-4 shrink-0"
            aria-hidden="true"
          />
          <div>
            <span className="sr-only">{t("cookSafety")}: </span>
            <span className="whitespace-pre-line">{step.safety_warnings}</span>
          </div>
        </div>
      )}
      {step.chef_notes && (
        <p className="text-muted-foreground mt-3 text-sm whitespace-pre-line">
          <span className="font-semibold">{t("cookChefNotes")}: </span>
          {step.chef_notes}
        </p>
      )}
    </article>
  );
}
