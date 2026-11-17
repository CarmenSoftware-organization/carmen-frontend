import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Pencil,
  RotateCcw,
  Thermometer,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { BackButton } from "@/components/share/back-button";
import { CompactSection } from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { ToolbarLabel } from "@/components/share/form-toolbar";
import { PrintDocumentButton } from "@/components/print-document-button";
import { EyeBrow } from "@/components/ui/eye-brow";
import { useCan } from "@/hooks/use-can";
import { useListReturn } from "@/hooks/use-list-return";
import { useUnitById } from "@/hooks/use-unit";
import { PERMISSIONS } from "@/constant/permissions";
import { ALLERGEN_OPTIONS } from "@/constant/recipe";
import { cn } from "@/lib/utils";
import type { Recipe, RecipePreparationStep } from "@/types/recipe";
import { activeSteps, normalizeEquipment } from "./recipe-steps-sync";
import {
  activeIngredients,
  decimalsFor,
  formatQty,
  formatQtyFixed,
} from "./recipe-ingredients-cost";
import { useRecipePrintTemplateId } from "./use-recipe-print-template";
import { useWakeLock } from "./use-wake-lock";
import { RecipeCookImages, type CookImage } from "./recipe-cook-images";
import { useRecipeStepImages } from "./use-recipe-step-images";
import { RecipeDifficultyPips } from "./recipe-difficulty-pips";
import { parseYoutubeVideoId } from "@/lib/youtube";

const LIST_PATH = "/operation-plan/recipe";
const ALLERGEN_LABEL = new Map<string, string>(
  ALLERGEN_OPTIONS.map((a) => [a.value, a.label]),
);
/** ปัดนิ้วแนวนอนเกินระยะนี้ (px) และเอียงไม่เกินที่กำหนด = เปลี่ยนขั้น — สั้นกว่านี้คือแตะ/เลื่อนหน้า */
const SWIPE_MIN_PX = 60;

/**
 * โหมดทำอาหาร — หน้าอ่านอย่างเดียวสำหรับแท็บเล็ตในครัว เปิดมาเจอขั้นตอนทำทีละขั้น
 * ไม่มีช่องกรอกและไม่มีตัวเลขต้นทุน (แก้สูตร/ตั้งราคาอยู่ที่ /:id/edit)
 *
 * จัดหน้าโดยคิดจาก iPad เป็นหลัก (ผู้ใช้สั่ง 2026-11-17 "หน้า view เละ ๆ … คิดในมุม iPad"):
 * - หัวหน้า = ชื่อสูตร + รหัส · หมวดหมู่ · ประเภทอาหาร (แบบหัวฟอร์มหน้าอื่นของแอป) ปุ่มพิมพ์/แก้ไขขวามือ
 * - แนวนอน (กล่องเนื้อหา ≥ 48rem): ขั้นตอนซ้าย (ปุ่มเลขขั้น → การ์ดขั้น → ถัดไป) ข้อมูลสูตร 20rem ขวา
 *   คอลัมน์ขั้นตอนตรึงไว้ (sticky) เลื่อนดูวัตถุดิบด้านขวาแล้วขั้นที่ทำอยู่ไม่หลุดจอ
 * - แนวตั้ง: ข้อมูลสูตร (รูปซ้าย · คำอธิบาย/เวลา/สารก่อภูมิแพ้ขวา) → วัตถุดิบสองคอลัมน์ → ขั้นตอน
 *   → การจัดจาน/การเก็บรักษา (ของหลังทำเสร็จ จึงอยู่ท้าย ไม่ขวางระหว่างวัตถุดิบกับขั้นตอน)
 * - รูปของขั้นอยู่ในการ์ดขั้นเดียวกัน: ขวาของข้อความเมื่อการ์ดกว้างพอ ไม่พอ = ใต้ข้อความ
 * - ปัดนิ้วซ้าย/ขวาบนการ์ดขั้น = ขั้นถัดไป/ก่อนหน้า (นอกจากปุ่มเลขและลูกศรคีย์บอร์ด)
 */
export function RecipeCookView({ recipe }: { readonly recipe: Recipe }) {
  const t = useTranslations("operationPlan.recipe");
  const tfl = useTranslations("field");
  const ts = useTranslations("status");
  const { can, canWrite } = useCan();
  const { toList, returnState } = useListReturn(LIST_PATH);
  const { data: yieldUnit } = useUnitById(recipe.base_yield_unit || undefined);
  const printTemplateId = useRecipePrintTemplateId();
  useWakeLock(true);

  const steps = activeSteps(recipe.preparation_steps);
  const [index, setIndex] = useState(0);
  const total = steps.length;
  // สัญญาหมดอายุ = เข้าฟอร์มได้แต่ Save ไม่ได้ อย่าชวนกดตั้งแต่หน้านี้
  const canEdit = canWrite && can(PERMISSIONS.operation_plan.recipe.update);
  const editLink = (
    <Button asChild variant="outline" size="sm" title={t("editRecipe")}>
      <Link to={`${LIST_PATH}/${recipe.id}/edit`} state={returnState}>
        <Pencil />
        <ToolbarLabel>{t("editRecipe")}</ToolbarLabel>
      </Link>
    </Button>
  );

  // refetch อาจได้ขั้นน้อยลง — ให้ index อยู่ในช่วงเสมอ (ไม่งั้นป้าย "ขั้นที่ 5 / 3")
  const step = total === 0 ? 0 : Math.min(index, total - 1);
  const goTo = (i: number) => {
    if (total === 0) return;
    setIndex(Math.max(0, Math.min(i, total - 1)));
  };

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
  // รูปของขั้นที่เปิดอยู่ — ดึงทีละขั้นตอนที่เปิด (recipe detail ไม่ส่งรูปของขั้นมาด้วย)
  const { data: stepImageRows } = useRecipeStepImages(recipe.id, current?.id);
  const stepImages: CookImage[] = (stepImageRows ?? []).flatMap((img) =>
    img.url ? [{ ...img, url: img.url }] : [],
  );

  // ปัดนิ้วบนการ์ดขั้น — จุดเริ่มเก็บใน ref (ไม่ต้อง re-render ระหว่างลากนิ้ว)
  const swipeStart = useRef<{ x: number; y: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    swipeStart.current =
      e.touches.length === 1 && touch
        ? { x: touch.clientX, y: touch.clientY }
        : null;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    const start = swipeStart.current;
    swipeStart.current = null;
    const touch = e.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    // ลากเฉียงลง = เลื่อนหน้า ไม่ใช่เปลี่ยนขั้น
    if (Math.abs(dx) < SWIPE_MIN_PX || Math.abs(dx) < Math.abs(dy) * 1.5)
      return;
    goTo(dx < 0 ? step + 1 : step - 1);
  };

  const allergens = recipe.allergens ?? [];
  // รูปเมนูกับวิดีโออยู่แกลเลอรีเดียวกัน (วิดีโอเป็นช่องสุดท้าย) — มีอย่างใดอย่างหนึ่งก็แบ่งคอลัมน์ให้แกลเลอรี
  const hasMedia =
    (recipe.images?.length ?? 0) > 0 || !!parseYoutubeVideoId(recipe.video_url);
  const difficultyKey = recipe.difficulty?.toLowerCase();
  // ตัวเลขสรุปข้างรูป — แสดงเฉพาะช่องที่มีค่า (view mode: label จาง + ค่าเข้ม ไม่มีกรอบ)
  // หมวดหมู่/ประเภทอาหารย้ายขึ้นบรรทัดรองใต้ชื่อสูตร ที่นี่เหลือเวลา ผลผลิต ความยาก
  const facts: { label: string; value: ReactNode }[] = [];
  if (recipe.prep_time > 0)
    facts.push({
      label: t("prepTime"),
      value: t("cookMinutes", { min: recipe.prep_time }),
    });
  if (recipe.cook_time > 0)
    facts.push({
      label: t("cookTime"),
      value: t("cookMinutes", { min: recipe.cook_time }),
    });
  if (recipe.prep_time > 0 && recipe.cook_time > 0)
    facts.push({
      label: tfl("totalTime"),
      value: t("cookMinutes", { min: recipe.prep_time + recipe.cook_time }),
    });
  if (recipe.base_yield > 0)
    facts.push({
      label: t("baseYield"),
      value: `${formatQty(recipe.base_yield)} ${yieldUnit?.name ?? ""}`.trim(),
    });
  if (
    difficultyKey === "easy" ||
    difficultyKey === "medium" ||
    difficultyKey === "hard"
  )
    facts.push({
      label: tfl("difficulty"),
      value: (
        <>
          <RecipeDifficultyPips difficulty={recipe.difficulty} />
          {ts(difficultyKey)}
        </>
      ),
    });
  const subtitle = [
    { key: "code", label: tfl("code"), value: recipe.code },
    { key: "category", label: tfl("category"), value: recipe.category?.name },
    { key: "cuisine", label: tfl("cuisine"), value: recipe.cuisine?.name },
  ].filter((s): s is typeof s & { value: string } => !!s.value);

  const ingredients = activeIngredients(recipe.ingredients);
  // ทศนิยมของจำนวนวัตถุดิบเท่ากันทุกแถว = ของแถวที่ละเอียดที่สุด
  const qtyDecimals = decimalsFor(ingredients.map((l) => l.qty));
  // ติ๊กแล้วเก็บแค่ในหน้านี้ — รีเฟรชแล้วเริ่มใหม่ (ครัวเช็กของต่อรอบที่ทำ)
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const checkedCount = ingredients.filter((l) => checked.has(l.id)).length;

  const afterCooking = [
    {
      key: "plating",
      title: t("cookPlating"),
      text: recipe.plating_instructions,
    },
    {
      key: "storage",
      title: t("cookStorage"),
      text: recipe.storage_instructions,
    },
  ].filter((s): s is typeof s & { text: string } => !!s.text);

  const header = (
    // @container/doc-header: ปุ่มบนหัวเหลือแต่ไอคอนเมื่อหัวแคบกว่า 576px (มือถือ) เหมือนหัวฟอร์มหน้าอื่น
    <header className="@container/doc-header flex items-start gap-2">
      <BackButton
        onClick={() => toList()}
        label={t("backToRecipes")}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight break-words @xl/doc-header:text-2xl">
          {recipe.name}
        </h1>
        {subtitle.length > 0 && (
          <p className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-2 text-sm">
            {subtitle.map((s, i) => (
              <span key={s.key} className="flex items-center gap-x-2">
                {i > 0 && <span aria-hidden="true">·</span>}
                <span
                  title={s.label}
                  className={cn(s.key === "code" && "tabular-nums")}
                >
                  {s.value}
                </span>
              </span>
            ))}
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {/* สูตรนี้สูตรเดียว ด้วย template ที่ BU เลือกใน Default Setting → แบบฟอร์มการพิมพ์ → Recipe
            PrintSingle: ใบเดียว micro-report ไม่พิมพ์บล็อกตัวกรองบนหัวรายงาน (หน้ารายการรายงานยังพิมพ์)
            RecordType/RecordId: QR มุมขวาบนที่สแกนแล้วกลับมาหน้าสูตรนี้ (/qr/recipe/<id>) */}
        {recipe.code && (
          <PrintDocumentButton
            documentType="RECIPE"
            templateId={printTemplateId}
            filters={{
              CategoryFrom: "ALL",
              CategoryTo: "ALL",
              RecipeFrom: recipe.code,
              RecipeTo: recipe.code,
              Status: "ALL",
              PrintSingle: true,
              RecordType: "recipe",
              RecordId: recipe.id,
            }}
          />
        )}
        {canEdit && editLink}
      </div>
    </header>
  );

  return (
    <FormPageShell width="wide" header={header}>
      <div className="@container">
        {/* จอกว้าง (ผู้ใช้สั่ง 2026-11-16 สลับข้าง): ซ้าย = ขั้นตอน (กินสองแถว) · ขวา = ข้อมูลสูตร (แถวบน)
            กับการจัดจาน/เก็บรักษา (แถวล่าง) · จอแคบเรียงตาม DOM: ข้อมูลสูตร → ขั้นตอน → การจัดจาน/เก็บรักษา */}
        {/* Full HD ขึ้นไป (กล่อง ≥ 80rem) คอลัมน์ขวากว้างขึ้นเป็น 26rem — 20rem บนจอนั้นเหลือขั้นตอนยาวโล่งเต็มจอ */}
        <div className="grid gap-6 @3xl:grid-cols-[minmax(0,1fr)_20rem] @3xl:grid-rows-[auto_1fr] @7xl:grid-cols-[minmax(0,1fr)_26rem]">
          {/* ข้อมูลสูตร */}
          <div className="@container/info min-w-0 space-y-6 @3xl:col-start-2 @3xl:row-start-1">
            <div
              className={cn(
                "grid gap-4 @lg/info:gap-6",
                hasMedia &&
                  "@lg/info:grid-cols-[15rem_minmax(0,1fr)] @2xl/info:grid-cols-[17rem_minmax(0,1fr)]",
              )}
            >
              <RecipeCookImages
                images={recipe.images}
                recipeName={recipe.name}
                videoUrl={recipe.video_url}
                videoTitle={t("videoTitle", { name: recipe.name })}
                // เต็มคอลัมน์เสมอ (มือถือ · คอลัมน์ขวาของแนวนอน · ช่องรูปของแนวตั้ง) — ไม่จำกัด max-w: query แบบไม่ระบุชื่อ
                // ใต้ @container/info วัดกล่อง info ไม่ใช่กล่องหน้า เคยทำให้รูปค้าง 20rem กลางคอลัมน์ 26rem ของ Full HD
                className="w-full min-w-0"
              />
              <div className="min-w-0 space-y-4">
                {recipe.description && (
                  <p className="text-foreground text-base leading-relaxed break-words whitespace-pre-line">
                    {recipe.description}
                  </p>
                )}
                {facts.length > 0 && (
                  // จำนวนคอลัมน์ตามความกว้างจริง ช่องละ ≥ 6rem ("●●○ ปานกลาง" กว้าง 94px ไม่ล้น ไม่ถูกตัดคำ):
                  // คอลัมน์ขวา 20rem ของแนวนอน = 3 · มือถือ = 2 · ข้างรูปของแนวตั้ง = 3
                  <dl className="grid grid-cols-[repeat(auto-fill,minmax(6rem,1fr))] gap-x-3 gap-y-3">
                    {facts.map((f) => (
                      <div key={f.label} className="min-w-0">
                        <dt className="text-muted-foreground text-xs">
                          {f.label}
                        </dt>
                        <dd className="text-foreground mt-0.5 flex items-center gap-1.5 text-base font-semibold whitespace-nowrap">
                          {f.value}
                        </dd>
                      </div>
                    ))}
                  </dl>
                )}
                {allergens.length > 0 && (
                  <div>
                    <EyeBrow className="mb-1.5">{t("cookAllergens")}</EyeBrow>
                    <div className="flex flex-wrap gap-1.5">
                      {allergens.map((a) => (
                        <Badge key={a} variant="warning-light">
                          {ALLERGEN_LABEL.get(a.toLowerCase()) ?? a}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {ingredients.length > 0 && (
              <CompactSection
                first
                title={t("cookIngredients")}
                count={ingredients.length}
                action={
                  checkedCount > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {t("cookChecked", {
                          n: checkedCount,
                          total: ingredients.length,
                        })}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setChecked(new Set())}
                      >
                        <RotateCcw />
                        {t("cookClearChecks")}
                      </Button>
                    </div>
                  )
                }
              >
                {/* กล่องกว้าง (แนวตั้ง) = สองคอลัมน์ ชื่อกับจำนวนไม่ห่างกันข้ามจอ · คอลัมน์ขวาของแนวนอน = คอลัมน์เดียว */}
                <div className="@container">
                  <ul className="-my-1 grid gap-x-6 @xl:grid-cols-2">
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
                        // เส้นคั่นใต้ทุกแถว ยกเว้นแถวล่างสุดของแต่ละคอลัมน์ (สองคอลัมน์ + จำนวนคู่ = สองแถวท้าย)
                        <li
                          key={line.id}
                          className="border-border/60 border-b last:border-b-0 @xl:[&:nth-last-child(2):nth-child(odd)]:border-b-0"
                        >
                          {/* checkbox กับลิงก์แยกกัน — ลิงก์ไปสูตรฐานต้องไม่ติ๊ก/ไม่ถูกติ๊กแทน */}
                          <div className="hover:bg-muted/60 relative -mx-2 flex min-h-12 items-start gap-3 rounded-md px-2 py-2.5">
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
                              onCheckedChange={(v) =>
                                toggle(line.id, v === true)
                              }
                              className="relative z-10 mt-0.5 size-5"
                            />
                            <div
                              className={cn(
                                "min-w-0 flex-1 text-base",
                                isChecked &&
                                  "text-muted-foreground line-through",
                              )}
                            >
                              <div className="flex flex-wrap items-baseline justify-between gap-x-3">
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
                                <span
                                  className={cn(
                                    "shrink-0 tabular-nums",
                                    !isChecked &&
                                      "text-foreground font-semibold",
                                  )}
                                >
                                  {formatQtyFixed(line.qty, qtyDecimals)}{" "}
                                  {line.ingredient_unit?.name ?? ""}
                                </span>
                              </div>
                              {line.note && (
                                <span className="text-muted-foreground mt-0.5 block text-sm">
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
              </CompactSection>
            )}
          </div>

          {/* ขั้นตอน — จอกว้างตรึงไว้ เลื่อนดูวัตถุดิบด้านขวาแล้วขั้นที่ทำอยู่ยังอยู่บนจอ */}
          <section
            aria-label={t("stepsSection")}
            className="@container/steps min-w-0 @3xl:sticky @3xl:top-0 @3xl:col-start-1 @3xl:row-span-2 @3xl:row-start-1 @3xl:self-start"
          >
            {total === 0 || !current ? (
              <div className="text-muted-foreground bg-card rounded-xl border border-dashed p-8 text-center text-sm">
                <p>{t("cookNoSteps")}</p>
                {canEdit && <div className="mt-3">{editLink}</div>}
              </div>
            ) : (
              <>
                {/* ตัวเลือกขั้นเหนือการ์ดขั้น แบบเลขหน้าของ Google (ผู้ใช้สั่ง 2026-11-16): ปุ่มวงกลมเลขขั้น
                    ครบทุกขั้น กดข้ามไปขั้นไหนก็ได้ · ลูกศรก่อนหน้า/ถัดไปอยู่หัวท้าย · ขั้นเยอะขึ้นบรรทัดใหม่
                    ปุ่ม 44px ให้นิ้วกดง่ายบนแท็บเล็ตในครัว · ลูกศรซ้าย/ขวาบนคีย์บอร์ดยังใช้ได้เหมือนเดิม */}
                <nav
                  aria-label={t("cookStepPager")}
                  className="mb-4 flex flex-wrap items-center justify-center gap-2"
                >
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 rounded-full"
                    aria-label={t("cookPrev")}
                    disabled={step === 0}
                    onClick={() => goTo(step - 1)}
                  >
                    <ChevronLeft />
                  </Button>
                  {steps.map((s, i) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={t("cookGoToStep", { n: i + 1 })}
                      aria-current={i === step ? "step" : undefined}
                      title={s.title || s.description || undefined}
                      className={cn(
                        "focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full border text-base font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                        i === step
                          ? "bg-primary border-primary text-primary-foreground"
                          : "bg-card text-foreground hover:bg-muted",
                      )}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="size-11 rounded-full"
                    aria-label={t("cookNext")}
                    disabled={step >= total - 1}
                    onClick={() => goTo(step + 1)}
                  >
                    <ChevronRight />
                  </Button>
                </nav>

                {/* การ์ดขั้นที่เปิดอยู่ — ข้อความกับรูปของขั้นอยู่การ์ดเดียวกัน (กดรูป = popup แบบรูปหลักของสูตร)
                    การ์ดกว้าง ≥ 42rem: รูปอยู่ขวาของข้อความ · แคบกว่านั้น: รูปลงมาใต้ข้อความ · ขั้นที่ไม่มีรูป = ข้อความเต็มการ์ด
                    ไม่ใส่ touch-action: การปัดอ่านจาก touch event เอง ส่วน pinch-zoom ของ iPad ยังต้องใช้ได้ */}
                <article
                  className="bg-card rounded-xl border p-4 shadow-sm @lg/steps:p-6"
                  onTouchStart={onTouchStart}
                  onTouchEnd={onTouchEnd}
                >
                  <div
                    className={cn(
                      "grid gap-5",
                      stepImages.length > 0 &&
                        "@2xl/steps:grid-cols-[minmax(0,1fr)_15rem] @2xl/steps:gap-6 @4xl/steps:grid-cols-[minmax(0,1fr)_18rem]",
                    )}
                  >
                    <CookStep step={current} n={step + 1} total={total} />
                    <RecipeCookImages
                      // ขั้นใหม่ = เริ่มที่รูปแรกของขั้นนั้น ไม่ค้างตำแหน่งรูปของขั้นก่อน
                      key={current.id}
                      images={stepImages}
                      recipeName={
                        current.title || t("cookStepOf", { n: step + 1, total })
                      }
                      label={t("cookStepImages", { n: step + 1 })}
                      className="w-full max-w-xs min-w-0 @2xl/steps:max-w-none"
                    />
                  </div>
                </article>

                {next && (
                  <button
                    type="button"
                    onClick={() => goTo(step + 1)}
                    className="bg-card/60 hover:bg-muted focus-visible:ring-ring mt-3 flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-muted-foreground block text-xs font-semibold tabular-nums">
                        {t("cookNextUp")} ·{" "}
                        {t("cookStepOf", { n: step + 2, total })}
                      </span>
                      <span className="text-foreground mt-0.5 line-clamp-2 block text-sm">
                        {next.title || next.description}
                      </span>
                    </span>
                    <ChevronRight
                      className="text-muted-foreground size-5 shrink-0"
                      aria-hidden="true"
                    />
                  </button>
                )}
              </>
            )}
          </section>

          {/* หลังทำเสร็จ — จอกว้างอยู่ใต้วัตถุดิบในคอลัมน์ขวา · จอแคบอยู่ท้ายหน้าต่อจากขั้นตอน (คู่กันเมื่อกว้างพอ) */}
          {afterCooking.length > 0 && (
            <div className="@container/after min-w-0 @3xl:col-start-2 @3xl:row-start-2">
              <div className="grid gap-5 @xl/after:grid-cols-2">
                {afterCooking.map((s) => (
                  <CompactSection key={s.key} first title={s.title}>
                    <p className="text-foreground text-base leading-relaxed break-words whitespace-pre-line">
                      {s.text}
                    </p>
                  </CompactSection>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </FormPageShell>
  );
}

function MetaChip({
  icon: Icon,
  children,
}: {
  readonly icon: LucideIcon;
  readonly children: ReactNode;
}) {
  return (
    <span className="bg-muted text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-sm">
      <Icon
        className="text-muted-foreground size-4 shrink-0"
        aria-hidden="true"
      />
      <span className="min-w-0 break-words tabular-nums">{children}</span>
    </span>
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

  return (
    // aria-live ที่ข้อความของขั้น ไม่ใช่ทั้งการ์ด — เปลี่ยนขั้นแล้วอ่านเฉพาะข้อความใหม่ ไม่อ่านปุ่มรูปซ้ำ
    <div className="min-w-0" aria-live="polite">
      <div className="flex flex-wrap items-center gap-2">
        <span className="bg-primary text-primary-foreground rounded-full px-3 py-1 text-sm font-semibold tabular-nums">
          {t("cookStepOf", { n, total })}
        </span>
        {step.duration ? (
          <MetaChip icon={Timer}>
            {t("cookMinutes", { min: step.duration })}
          </MetaChip>
        ) : null}
        {temperature !== null && Number.isFinite(temperature) && (
          <MetaChip icon={Thermometer}>
            {`${temperature}°${(step.temperature_unit ?? "c").toUpperCase()}`}
          </MetaChip>
        )}
        {equipment.length > 0 && (
          <MetaChip icon={CookingPot}>
            {equipment.map((e) => e.name).join(", ")}
          </MetaChip>
        )}
      </div>
      {step.title && (
        <h2 className="text-foreground mt-4 text-xl font-semibold break-words">
          {step.title}
        </h2>
      )}
      <p
        className={cn(
          "text-foreground text-xl leading-relaxed break-words whitespace-pre-line",
          step.title ? "mt-2" : "mt-4",
        )}
      >
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
    </div>
  );
}
