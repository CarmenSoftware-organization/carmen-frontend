import { EyeBrow } from "@/components/ui/eye-brow";
import type { TFn } from "./landing-types";

/**
 * หัวหน้าแบบกะทัดรัด — ชื่อหน้ากับคำโปรย
 *
 * เดิมเป็น hero สูงครึ่งจอ (ตัวอักษร 60px, padding 96px) ตามด้วยสารบัญ chapter 5 ช่อง — สารบัญ
 * ตัดออกเพราะทุก chapter เห็นพร้อมกันในจอเดียวแล้ว มันจึงแค่ทวนหัวข้อที่อยู่ข้างล่าง · แถว meta
 * (เลขเวอร์ชันกับจำนวนเครื่องมือ) ตัดออกด้วย: เป็นตัวเลขตายตัวในไฟล์แปลที่ไม่ตรงกับของจริง
 */
export function LandingHero({ t }: { readonly t: TFn }) {
  return (
    <section className="mb-4">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-foreground text-xl font-semibold tracking-tight">
          {t("title")}
        </h1>
        <EyeBrow>{t("kicker")}</EyeBrow>
      </div>
      {/* max-w-3xl เป็นความยาวบรรทัดของข้อความ ไม่ใช่เพดานของเนื้อหา */}
      <p className="text-muted-foreground mt-1 max-w-3xl text-xs leading-relaxed">
        {t("lede")}
      </p>
    </section>
  );
}
