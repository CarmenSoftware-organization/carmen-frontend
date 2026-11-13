import { useTranslations } from "use-intl";
import { moduleList } from "@/constant/module-list";
import {
  useVisibleModules,
  type ModuleWithAccess,
} from "@/hooks/use-visible-modules";
import { LandingChapter } from "./landing-chapter";
import { LandingHero } from "./landing-hero";
import { CHAPTERS } from "./landing-types";

const SYSTEM_ADMIN_SUBS =
  moduleList.find((mod) => mod.path === "/system-admin")?.subModules ?? [];
const MENU_PATHS = new Set(SYSTEM_ADMIN_SUBS.map((sub) => sub.path));

/**
 * หน้า landing ของ System Admin — เต็มความกว้างจอ กะทัดรัด (skill `carmen-blue-ui-design`)
 *
 * chapter เรียงเป็นคอลัมน์แบบ multi-column (`columns: 20rem N`) ไม่ใช่แถบเต็มจอทีละ chapter:
 * เดิมแต่ละ chapter กินทั้งความกว้างแล้วแบ่งการ์ด 2–3 ใบ การ์ดจึงกว้างตามจอ (ใบละ 1800px ที่ 4K)
 * และหน้ายาว 5 จอ ตอนนี้จอกว้างขึ้นได้ chapter เคียงกันมากขึ้น การ์ดกว้าง 280–400px ทุกขนาดจอ
 * เลือก multi-column แทนกริดเพราะ chapter สูงไม่เท่ากัน — กริดจะเหลือช่องว่างใต้ chapter ที่เตี้ย
 * และแถวสุดท้ายเหลือช่องเปล่าเมื่อจำนวน chapter หารจำนวนคอลัมน์ไม่ลงตัว
 * `N` คือเพดานจำนวนคอลัมน์ = จำนวน chapter ที่แสดง (ไม่งั้นจอ 4K ได้คอลัมน์เปล่าครึ่งจอ)
 *
 * สิทธิ์ของการ์ดมาจาก `useVisibleModules` ตัวเดียวกับเมนูซ้าย — การ์ดกับเมนูจึงตอบตรงกันเสมอ:
 * หน้าที่ถูกซ่อน (license hidden) ไม่มีการ์ด · หน้าที่ล็อก/ไม่มีสิทธิ์มีการ์ดจาง กดแล้วบอกเหตุผล
 */
export default function SystemAdminLanding() {
  const t = useTranslations("systemAdmin.landing");
  const visible = useVisibleModules(SYSTEM_ADMIN_SUBS);
  const accessByPath = new Map<string, ModuleWithAccess>(
    visible.map((sub) => [sub.path, sub]),
  );

  const chapters = CHAPTERS.map((chapter) => ({
    chapter,
    // อยู่ในเมนูแต่ไม่อยู่ในรายการที่มองเห็น = ถูกซ่อน → ไม่แสดงการ์ด
    modules: chapter.modules.filter(
      (m) => !MENU_PATHS.has(m.href) || accessByPath.has(m.href),
    ),
  })).filter((c) => c.modules.length > 0);

  return (
    <div className="w-full">
      <LandingHero t={t} />
      <div
        className="gap-x-5"
        style={{ columns: `20rem ${Math.max(chapters.length, 1)}` }}
      >
        {chapters.map(({ chapter, modules }, index) => (
          <LandingChapter
            key={chapter.key}
            chapter={chapter}
            // เลขนับจาก chapter ที่แสดงจริง — chapter ที่ถูกซ่อนทั้งหมวดต้องไม่ทำให้เลขกระโดด
            num={String(index + 1).padStart(2, "0")}
            modules={modules}
            accessByPath={accessByPath}
            t={t}
          />
        ))}
      </div>
    </div>
  );
}
