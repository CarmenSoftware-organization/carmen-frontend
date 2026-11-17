import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useTranslations } from "use-intl";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CookingPot,
  Hand,
  Thermometer,
  Timer,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RecipePreparationStep } from "@/types/recipe";
import { normalizeEquipment } from "./recipe-steps-sync";
import { RecipeCookImages, type CookImage } from "./recipe-cook-images";
import { useRecipeStepImages } from "./use-recipe-step-images";

/** ปัดนิ้วแนวนอนเกินระยะนี้ (px) และเอียงไม่เกินที่กำหนด = เปลี่ยนขั้น — สั้นกว่านี้คือแตะ/เลื่อนหน้า */
const SWIPE_MIN_PX = 60;
/** กล่องเลื่อนหน้าของแอป (routes/root-layout.tsx) — แถบสถานะอยู่นอกกล่องนี้ แถบเลขที่ลอยก้นจอจึงไม่ไปซ้อนกับมัน */
const SCROLLER_ID = "main-content";
/** เว้นใต้การ์ดตอนคอลัมน์ขั้นตอนตรึงอยู่บนสุด — การ์ดไม่ชนขอบล่างของกล่องเลื่อนพอดีเป๊ะ */
const STAGE_GAP_PX = 8;

/**
 * ความสูงที่มองเห็นได้ของกล่องเลื่อนหน้า (px) — ใช้จำกัดความสูงการ์ดขั้นให้ไม่เกินจอ
 * วัดจริงแทนเขียน calc(100dvh - …) เพราะแบนเนอร์ของแอป (ออฟไลน์ ใบอนุญาตหมด โควตาเต็ม ฯลฯ) ขึ้น/หายแล้วกล่องสูงเปลี่ยน
 */
function useScrollerHeight(): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const el = document.getElementById(SCROLLER_ID);
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setHeight(el.clientHeight);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return height;
}

/**
 * เวทีขั้นตอนของหน้าดูสูตร — จุดเด่นของหน้า (ผู้ใช้ 2026-11-17: "ใช้ยากบน tablet ไหม … อยากให้สวยขึ้น")
 *
 * - การ์ดขั้น: พื้นสีหลักอ่อน ไม่มีเงา (กฎ flat ของ DESIGN.md) — ข้อความซ้าย รูปของขั้นขวาเมื่อการ์ดกว้าง ≥ 32rem
 *   (ผู้ใช้สั่ง 2026-11-16 "ขั้นตอนซ้าย รูปขวา") แคบกว่านั้นรูปเต็มความกว้างการ์ดใต้ข้อความ
 * - **แถบเลือกขั้นลอยอยู่ก้นการ์ด** (ผู้ใช้เสนอ 2026-11-17 "เอาปุ่มขั้นตอนที่เป็นตัวเลขลงไปข้างล่าง แล้วให้มันลอยไว้
 *   ไม่ว่าขั้นตอนจะยาวแค่ไหนก็จะไม่เจอปัญหาปุ่มตก"): ‹ ①─②─③ › แถวเดียว + ชื่อขั้นถัดไปบรรทัดเล็กเหนือแถว
 *   - `sticky bottom-0` ภายในการ์ด = การ์ดยาวกว่าจอเมื่อไร แถบติดก้นจอ · การ์ดเห็นทั้งใบ = แถบอยู่ท้ายการ์ดตามปกติ
 *     การ์ดจึงต้องเป็น overflow-clip (ไม่ใช่ hidden — hidden ทำให้การ์ดเป็นกล่องเลื่อนเอง sticky จะไม่เกาะจอ)
 *   - หน้าที่มีคอลัมน์ข้าง (≥ 36rem คอลัมน์ขั้นตอนตรึงบนสุด) = การ์ดสูงไม่เกินกล่องเลื่อนของแอป ข้อความยาวเลื่อนในการ์ด
 *     ไม่งั้นท้ายการ์ดที่ยาวกว่าจอจะมองไม่เห็นจนกว่าจะเลื่อนสุดหน้า (คอลัมน์ตรึงด้านบนไว้)
 *   - ขั้นเยอะจนวงกลมล้นแถว = แถวเลื่อนแนวนอนได้ และเลื่อนให้ขั้นที่เปิดอยู่มาอยู่กลางเอง (ไม่ขึ้นสองบรรทัด แถบไม่สูงเกิน)
 *   - วงกลม: ขั้นที่ผ่าน = พื้นอ่อน · ขั้นที่เปิด = พื้นสีหลัก · ยังไม่ถึง = ขอบ · กดข้ามขั้นได้อิสระแบบเลขหน้า Google
 *     (ผู้ใช้สั่ง 2026-11-16) · › = ปุ่มหลักสีเต็ม (กดบ่อยสุดในครัว)
 * - ปัดนิ้วซ้าย/ขวาบนการ์ด = ขั้นถัดไป/ก่อนหน้า · มีบรรทัดบอกใต้การ์ดเฉพาะจอสัมผัส
 */
export function RecipeCookStepStage({
  recipeId,
  steps,
  emptyAction,
}: {
  readonly recipeId: string;
  readonly steps: readonly RecipePreparationStep[];
  /** ปุ่มแก้สูตรของหน้า — โชว์ในกล่องว่างเมื่อสูตรยังไม่มีขั้นตอน */
  readonly emptyAction?: ReactNode;
}) {
  const t = useTranslations("operationPlan.recipe");
  const [index, setIndex] = useState(0);
  const total = steps.length;
  // refetch อาจได้ขั้นน้อยลง — ให้ index อยู่ในช่วงเสมอ (ไม่งั้นป้าย "ขั้นที่ 5 / 3")
  const step = total === 0 ? 0 : Math.min(index, total - 1);
  const goTo = (i: number) => {
    if (total === 0) return;
    setIndex(Math.max(0, Math.min(i, total - 1)));
  };
  const scrollerHeight = useScrollerHeight();

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

  // เปลี่ยนขั้น = เนื้อหาในการ์ดกลับไปบนสุด + เลื่อนแถวเลขให้ขั้นที่เปิดอยู่ตรงกลาง
  // (เลื่อนเฉพาะแนวนอนของแถวเอง — scrollIntoView จะลากทั้งหน้าเลื่อนตามด้วย)
  const bodyRef = useRef<HTMLDivElement>(null);
  const rowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bodyRef.current?.scrollTo?.({ top: 0 });
    const row = rowRef.current;
    const btn = row?.querySelector<HTMLElement>('[aria-current="step"]');
    if (!row || !btn) return;
    row.scrollTo?.({
      left: btn.offsetLeft - row.clientWidth / 2 + btn.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [step]);

  const current = steps[step];
  const next = steps[step + 1];
  // รูปของขั้นที่เปิดอยู่ — ดึงทีละขั้นตอนที่เปิด (recipe detail ไม่ส่งรูปของขั้นมาด้วย)
  const { data: stepImageRows } = useRecipeStepImages(recipeId, current?.id);
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

  if (total === 0 || !current) {
    return (
      <div className="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
        <p>{t("cookNoSteps")}</p>
        {emptyAction && <div className="mt-3">{emptyAction}</div>}
      </div>
    );
  }

  const hasImages = stepImages.length > 0;
  const stageStyle =
    scrollerHeight === null
      ? undefined
      : ({
          "--cook-stage-max-h": `${scrollerHeight - STAGE_GAP_PX}px`,
        } as CSSProperties);

  return (
    <>
      {/* ไม่ใส่ touch-action: การปัดอ่านจาก touch event เอง ส่วน pinch-zoom ของ iPad ยังต้องใช้ได้ */}
      <article
        data-cook-stage
        style={stageStyle}
        className="border-primary/20 bg-primary/5 flex flex-col overflow-clip rounded-2xl border @xl/page:max-h-(--cook-stage-max-h)"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto">
          <div
            className={cn(
              "grid gap-5 p-5 @lg/steps:p-6",
              hasImages &&
                "@lg/steps:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] @lg/steps:gap-6 @4xl/steps:grid-cols-[minmax(0,1fr)_26rem]",
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
              variant="step"
              className="w-full min-w-0"
            />
          </div>
        </div>

        {/* แถบเลือกขั้นลอยก้นการ์ด/ก้นจอ — พื้นทึบเกือบเต็มให้ข้อความที่เลื่อนผ่านข้างใต้ไม่ตีกับเลข */}
        <div className="border-primary/15 bg-card/95 sticky bottom-0 z-10 border-t px-3 pt-2 pb-3 backdrop-blur">
          {/* บรรทัดเหนือแถวเลขมีทุกขั้น (ขั้นสุดท้าย = "ขั้นสุดท้ายแล้ว") แถบจึงสูงเท่าเดิม ไม่กระตุกตอนเปลี่ยนขั้น */}
          {next ? (
            <button
              type="button"
              onClick={() => goTo(step + 1)}
              className="text-muted-foreground hover:text-foreground mb-1.5 block w-full truncate text-center text-xs font-medium"
            >
              {t("cookNextStep", {
                title:
                  next.title ||
                  next.description ||
                  t("cookStepOf", { n: step + 2, total }),
              })}
            </button>
          ) : (
            <p className="text-success-ink mb-1.5 truncate text-center text-xs font-semibold">
              {t("cookLastStep")}
            </p>
          )}
          <nav
            aria-label={t("cookStepPager")}
            className="flex items-center gap-2"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-12 shrink-0 rounded-full"
              aria-label={t("cookPrev")}
              disabled={step === 0}
              onClick={() => goTo(step - 1)}
            >
              <ChevronLeft className="size-5" />
            </Button>
            <div
              ref={rowRef}
              className="flex min-w-0 flex-1 items-center overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {steps.map((s, i) => (
                <Fragment key={s.id}>
                  {/* เส้นหดได้ถึง 0 — คอลัมน์แคบ (iPad mini 344px) วงกลม 5 วง + ลูกศรยังพอดีแถวโดยไม่ต้องเลื่อน
                      เส้นแค่หายไปเอง · ขั้นเยอะกว่าที่วงกลมใส่ได้ แถวค่อยเลื่อนแนวนอน */}
                  {i > 0 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-0.5 min-w-0 flex-1 rounded-full transition-colors",
                        i <= step ? "bg-primary" : "bg-border",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => goTo(i)}
                    aria-label={t("cookGoToStep", { n: i + 1 })}
                    aria-current={i === step ? "step" : undefined}
                    title={s.title || s.description || undefined}
                    className={cn(
                      "focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-full border-2 text-base font-semibold tabular-nums transition-colors focus-visible:ring-2 focus-visible:outline-none",
                      i === step &&
                        "bg-primary border-primary text-primary-foreground ring-primary/20 ring-2 ring-offset-1",
                      i < step &&
                        "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15",
                      i > step && "bg-card text-foreground hover:bg-muted",
                    )}
                  >
                    {i + 1}
                  </button>
                </Fragment>
              ))}
            </div>
            <Button
              type="button"
              size="icon"
              className="size-12 shrink-0 rounded-full"
              aria-label={t("cookNext")}
              disabled={step >= total - 1}
              onClick={() => goTo(step + 1)}
            >
              <ChevronRight className="size-5" />
            </Button>
          </nav>
        </div>
      </article>
      <p className="text-muted-foreground mt-2 hidden items-center justify-center gap-1.5 text-xs pointer-coarse:flex">
        <Hand className="size-3.5" aria-hidden="true" />
        {t("cookSwipeHint")}
      </p>
    </>
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
    <span className="bg-card text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1 text-sm">
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
      <p className="text-primary text-sm font-semibold tracking-wide tabular-nums">
        {t("cookStepOf", { n, total })}
      </p>
      {step.title && (
        <h2 className="text-foreground mt-1 text-2xl font-semibold tracking-tight break-words">
          {step.title}
        </h2>
      )}
      {(step.duration ||
        (temperature !== null && Number.isFinite(temperature)) ||
        equipment.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
      )}
      <p className="text-foreground mt-4 text-xl leading-relaxed break-words whitespace-pre-line">
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
