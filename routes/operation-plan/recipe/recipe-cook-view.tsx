import type { ReactNode } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import {
  AlertTriangle,
  ChefHat,
  Clock,
  Pencil,
  Refrigerator,
  Soup,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/share/back-button";
import { FormPageShell } from "@/components/share/form-page-shell";
import { ToolbarLabel } from "@/components/share/form-toolbar";
import { PrintDocumentButton } from "@/components/print-document-button";
import { useCan } from "@/hooks/use-can";
import { useListReturn } from "@/hooks/use-list-return";
import { useUnitById } from "@/hooks/use-unit";
import { PERMISSIONS } from "@/constant/permissions";
import { ALLERGEN_OPTIONS } from "@/constant/recipe";
import { cn } from "@/lib/utils";
import type { Recipe } from "@/types/recipe";
import { activeSteps } from "./recipe-steps-sync";
import { activeIngredients, formatQty } from "./recipe-ingredients-cost";
import { useRecipePrintTemplateId } from "./use-recipe-print-template";
import { useWakeLock } from "./use-wake-lock";
import { RecipeCookImages } from "./recipe-cook-images";
import { RecipeCookIngredients } from "./recipe-cook-ingredients";
import { RecipeCookStepStage } from "./recipe-cook-step-stage";
import { RecipeDifficultyPips } from "./recipe-difficulty-pips";
import { parseYoutubeVideoId } from "@/lib/youtube";

const LIST_PATH = "/operation-plan/recipe";
const ALLERGEN_LABEL = new Map<string, string>(
  ALLERGEN_OPTIONS.map((a) => [a.value, a.label]),
);

/**
 * หน้าดูสูตร (โหมดทำอาหาร) — อ่านอย่างเดียวสำหรับแท็บเล็ตในครัว ไม่มีช่องกรอกและไม่มีตัวเลขต้นทุน
 * (แก้สูตร/ตั้งราคาอยู่ที่ /:id/edit)
 *
 * จัดหน้าใหม่ 2026-11-17 (ผู้ใช้: "ใช้ยากบน tablet ไหม … อยากให้หน้าตาดูสวยขึ้น") — แบ่งตามความกว้างกล่องหน้า:
 * - ≥ 48rem (iPad แนวนอน / จอคอม): ขั้นตอนซ้าย (ตรึงไว้) · ขวา = ข้อมูลสูตร → วัตถุดิบ → การจัดจาน/เก็บรักษา
 *   (ผู้ใช้สั่ง 2026-11-16 ขั้นตอนซ้าย ข้อมูลขวา)
 * - 36–48rem (iPad แนวตั้ง / iPad mini): ข้อมูลสูตรเป็นแถบบน (รูปซ้าย ข้อมูลขวา) แล้ว **ขั้นตอนกับวัตถุดิบคู่กัน**
 *   — เปิดหน้ามาเห็นขั้นที่ 1 ในจอแรก ไม่ต้องเลื่อนผ่านวัตถุดิบทั้งรายการแล้วเลื่อนกลับไปมาระหว่างทำ
 * - < 36rem (มือถือ): เรียงข้อมูลสูตร → วัตถุดิบ → ขั้นตอน → การจัดจาน/เก็บรักษา
 *
 * จุดเด่นของหน้าคือเวทีขั้น (พื้นสีหลักอ่อน) ส่วนอื่นเป็นพื้นเรียบ ไม่มีเงา ไม่มีกรอบซ้อนกรอบ
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

  const allergens = recipe.allergens ?? [];
  // รูปเมนูกับวิดีโออยู่แกลเลอรีเดียวกัน (วิดีโอเป็นช่องสุดท้าย) — มีอย่างใดอย่างหนึ่งก็แบ่งคอลัมน์ให้แกลเลอรี
  const hasMedia =
    (recipe.images?.length ?? 0) > 0 || !!parseYoutubeVideoId(recipe.video_url);
  const difficultyKey = recipe.difficulty?.toLowerCase();

  // ตัวเลขสรุป = ไอคอน + ป้ายเล็ก + ค่าเข้ม เรียงในแถบพื้นอ่อนแถบเดียว (แสดงเฉพาะช่องที่มีค่า)
  // เวลาเตรียม + เวลาทำ มีทั้งคู่ = แสดงเวลารวมเป็นค่าหลัก แยกเตรียม/ทำเป็นบรรทัดรอง
  const facts: {
    key: string;
    icon: LucideIcon;
    label: string;
    value: ReactNode;
    sub?: string;
  }[] = [];
  const prep = recipe.prep_time > 0 ? recipe.prep_time : 0;
  const cook = recipe.cook_time > 0 ? recipe.cook_time : 0;
  if (prep > 0 && cook > 0)
    facts.push({
      key: "time",
      icon: Clock,
      label: tfl("totalTime"),
      value: t("cookMinutes", { min: prep + cook }),
      sub: t("cookTimeSplit", { prep, cook }),
    });
  else if (prep > 0 || cook > 0)
    facts.push({
      key: "time",
      icon: Clock,
      label: prep > 0 ? t("prepTime") : t("cookTime"),
      value: t("cookMinutes", { min: prep || cook }),
    });
  if (recipe.base_yield > 0)
    facts.push({
      key: "yield",
      icon: UtensilsCrossed,
      label: t("baseYield"),
      value: `${formatQty(recipe.base_yield)} ${yieldUnit?.name ?? ""}`.trim(),
    });
  if (
    difficultyKey === "easy" ||
    difficultyKey === "medium" ||
    difficultyKey === "hard"
  )
    facts.push({
      key: "difficulty",
      icon: ChefHat,
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

  const afterCooking = [
    {
      key: "plating",
      icon: Soup,
      title: t("cookPlating"),
      text: recipe.plating_instructions,
    },
    {
      key: "storage",
      icon: Refrigerator,
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
      <div className="@container/page">
        {/* พื้นที่ทั้ง 4 ของหน้าวางด้วย grid-template-areas ตามความกว้างกล่อง — DOM เรียงตามลำดับอ่านของมือถือ
            (ข้อมูลสูตร → วัตถุดิบ → ขั้นตอน → หลังทำเสร็จ) จอกว้างแค่ย้ายพื้นที่ ไม่ต้องมีโครงซ้ำสองชุด */}
        <div className="grid gap-6 [grid-template-areas:'info'_'ing'_'steps'_'after'] @xl:grid-cols-[minmax(0,1fr)_15rem] @xl:[grid-template-areas:'info_info'_'steps_ing'_'after_after'] @2xl:grid-cols-[minmax(0,1fr)_17rem] @3xl:grid-cols-[minmax(0,1fr)_20rem] @3xl:grid-rows-[auto_auto_1fr] @3xl:[grid-template-areas:'steps_info'_'steps_ing'_'steps_after'] @7xl:grid-cols-[minmax(0,1fr)_26rem]">
          {/* ข้อมูลสูตร — แกลเลอรี + คำอธิบาย + ตัวเลขสรุป + สารก่อภูมิแพ้ */}
          <div className="@container/info min-w-0 [grid-area:info]">
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
                // เต็มคอลัมน์เสมอ — query แบบไม่ระบุชื่อใต้ @container/info วัดกล่อง info ไม่ใช่กล่องหน้า
                className="w-full min-w-0"
              />
              <div className="min-w-0 space-y-3">
                {recipe.description && (
                  <p className="text-foreground text-base leading-relaxed break-words whitespace-pre-line">
                    {recipe.description}
                  </p>
                )}
                {facts.length > 0 && (
                  // flex-wrap ไม่ใช่กริดคอลัมน์ตายตัว — "●●○ ปานกลาง" กับ "30 นาที" กว้างไม่เท่ากัน
                  // คอลัมน์ขวา 20rem ของแนวนอนจึงได้ 3 ช่องแถวเดียวโดยไม่มีช่องไหนล้น
                  <dl className="bg-muted/60 flex flex-wrap gap-x-6 gap-y-3 rounded-xl px-4 py-3">
                    {facts.map((f) => (
                      <div key={f.key} className="min-w-0">
                        <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                          <f.icon
                            className="text-primary size-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          {f.label}
                        </dt>
                        <dd className="text-foreground mt-1 flex items-center gap-1.5 text-base font-semibold whitespace-nowrap">
                          {f.value}
                        </dd>
                        {f.sub && (
                          <dd className="text-muted-foreground text-xs whitespace-nowrap tabular-nums">
                            {f.sub}
                          </dd>
                        )}
                      </div>
                    ))}
                  </dl>
                )}
                {allergens.length > 0 && (
                  <div className="border-warning/40 bg-warning/10 flex items-start gap-2 rounded-xl border px-4 py-3">
                    <AlertTriangle
                      className="text-warning-ink mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <p className="text-foreground min-w-0 text-sm break-words">
                      <span className="text-warning-ink mr-1.5 font-semibold">
                        {t("cookAllergens")}
                      </span>
                      {allergens
                        .map((a) => ALLERGEN_LABEL.get(a.toLowerCase()) ?? a)
                        .join(" · ")}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {ingredients.length > 0 && (
            <div className="min-w-0 [grid-area:ing]">
              <RecipeCookIngredients
                lines={ingredients}
                subRecipePath={LIST_PATH}
              />
            </div>
          )}

          {/* ขั้นตอน — ตรึงไว้เมื่อมีคอลัมน์ข้าง เลื่อนดูวัตถุดิบแล้วขั้นที่ทำอยู่ไม่หลุดจอ */}
          <section
            aria-label={t("stepsSection")}
            className="@container/steps min-w-0 [grid-area:steps] @xl:sticky @xl:top-0 @xl:self-start"
          >
            <RecipeCookStepStage
              recipeId={recipe.id}
              steps={steps}
              emptyAction={canEdit ? editLink : undefined}
            />
          </section>

          {/* หลังทำเสร็จ — จอกว้างอยู่ใต้วัตถุดิบในคอลัมน์ขวา · จอแคบอยู่ท้ายหน้าต่อจากขั้นตอน (คู่กันเมื่อกว้างพอ) */}
          {afterCooking.length > 0 && (
            <div className="@container/after min-w-0 [grid-area:after]">
              <div className="grid gap-4 @xl/after:grid-cols-2">
                {afterCooking.map((s) => (
                  <section key={s.key} className="bg-muted/50 rounded-xl p-4">
                    <h2 className="text-foreground flex items-center gap-2 text-sm font-semibold">
                      <s.icon
                        className="text-primary size-4 shrink-0"
                        aria-hidden="true"
                      />
                      {s.title}
                    </h2>
                    <p className="text-foreground mt-1.5 text-base leading-relaxed break-words whitespace-pre-line">
                      {s.text}
                    </p>
                  </section>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </FormPageShell>
  );
}
