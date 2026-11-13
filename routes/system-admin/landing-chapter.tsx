import type { ModuleWithAccess } from "@/hooks/use-visible-modules";
import type { ChapterDef, ModuleDef, TFn } from "./landing-types";
import { LandingModuleCard } from "./landing-module-card";

/**
 * หนึ่ง chapter = หัวข้อ + การ์ดของเครื่องมือในหมวด เป็นก้อนเดียวที่ไม่ถูกตัดข้ามคอลัมน์
 * (`break-inside-avoid`) การ์ดเรียงลงมาทีละใบ และแตกเป็น 2 คอลัมน์เมื่อ chapter เองกว้างพอ
 * (`@xl` = 576px — เกิดที่จอช่วง 700–1000px ซึ่งมีคอลัมน์เดียว และที่ 4K ซึ่งแต่ละคอลัมน์กว้าง ~600px)
 */
export function LandingChapter({
  chapter,
  num,
  modules,
  accessByPath,
  t,
}: {
  readonly chapter: ChapterDef;
  /** เลขลำดับที่แสดง ("01") — นับจาก chapter ที่มองเห็น ไม่ใช่ตำแหน่งใน `CHAPTERS` */
  readonly num: string;
  /** การ์ดที่ผู้ใช้มองเห็น — กรองหน้าที่ถูกซ่อนออกแล้ว */
  readonly modules: readonly ModuleDef[];
  readonly accessByPath: ReadonlyMap<string, ModuleWithAccess>;
  readonly t: TFn;
}) {
  return (
    <section className="@container mb-5 break-inside-avoid">
      {/* เลข chapter + kicker เป็นของประดับ ไม่ใช่ของกด — DESIGN.md สงวน
          primary ไว้ให้ interactive เท่านั้น ("and nothing else") ลำดับชั้น
          มาจากขนาดกับความจาง ไม่ใช่จากสี */}
      <div className="mb-2">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-foreground/25 text-sm font-semibold tabular-nums">
            {num}
          </span>
          <h2 className="text-foreground m-0 text-sm font-semibold tracking-tight">
            {t(`chapters.${chapter.key}.title`)}
          </h2>
          <span className="text-muted-foreground text-micro-eyebrow font-semibold tracking-[0.14em] uppercase">
            {t(`chapters.${chapter.key}.kicker`)}
          </span>
        </div>
        <p className="text-muted-foreground mt-0.5 mb-0 text-xs leading-snug">
          {t(`chapters.${chapter.key}.lede`)}
        </p>
      </div>

      <div className="grid gap-3 @xl:grid-cols-2">
        {modules.map((m) => (
          <LandingModuleCard
            key={m.key}
            mod={m}
            access={accessByPath.get(m.href)}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}
