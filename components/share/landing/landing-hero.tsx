import { EyeBrow } from "@/components/ui/eye-brow";

/**
 * หัวหน้า landing แบบกะทัดรัด — ชื่อหน้ากับคำโปรย
 *
 * ไม่มี hero ครึ่งจอ สารบัญ หรือแถว meta (เลขเวอร์ชัน/จำนวนเครื่องมือ) — skill
 * `carmen-blue-ui-design` §Landing pages ข้อ 1 และ 8: ตัวเลขตายตัวในไฟล์แปลดูเหมือนข้อมูลจริง
 * และสารบัญแค่ทวนหัวข้อที่เห็นอยู่ข้างล่างในจอเดียวกัน
 */
export function LandingHero({
  title,
  kicker,
  lede,
}: {
  readonly title: string;
  readonly kicker?: string;
  readonly lede: string;
}) {
  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          {title}
        </h1>
        {kicker && <EyeBrow>{kicker}</EyeBrow>}
      </div>
      {/* max-w-3xl เป็นความยาวบรรทัดของข้อความ ไม่ใช่เพดานของเนื้อหา */}
      <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed">
        {lede}
      </p>
    </section>
  );
}
