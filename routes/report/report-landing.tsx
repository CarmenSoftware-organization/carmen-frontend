import type { ReactNode } from "react";
import { Calendar, Clock, Files, LockKeyhole } from "lucide-react";
import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import {
  LandingCard,
  type LucideIcon,
} from "@/components/share/landing/landing-card";
import { LandingHero } from "@/components/share/landing/landing-hero";
import { moduleList } from "@/constant/module-list";
import {
  useVisibleModules,
  type ModuleWithAccess,
} from "@/hooks/use-visible-modules";
import { useReportHistory } from "./history/use-report-history";
import {
  ReportHistoryViz,
  ReportListViz,
  ReportScheduleViz,
} from "./report-landing-visuals";
import { useReportSchedules } from "./schedules/use-report-schedule";
import { useReportTemplates } from "./shared/use-report";

const REPORT_SUBS =
  moduleList.find((mod) => mod.path === "/report")?.subModules ?? [];

/** ขอแค่ `paginate.total` — แถวเดียวพอ */
const COUNT_ONLY = { page: 1, perpage: 1 } as const;

type CardKey = "reportList" | "reportSchedule" | "reportHistory";

interface CardDef {
  readonly key: CardKey;
  readonly href: string;
  readonly icon: LucideIcon;
  readonly visual: ReactNode;
  /** namespace ของหน้านั้นเอง — คำอธิบายการ์ด = `<ns>.desc` บนหัวของหน้า */
  readonly descNs: "report" | "reportSchedule" | "reportHistory";
}

/** ทุกหน้าในเมนูซ้ายของ Report ต้องมีการ์ดที่นี่ (เทียบกับ `constant/module-list.ts`) */
const CARDS: readonly CardDef[] = [
  {
    key: "reportList",
    href: "/report/list",
    icon: Files,
    visual: <ReportListViz />,
    descNs: "report",
  },
  {
    key: "reportSchedule",
    href: "/report/schedules",
    icon: Calendar,
    visual: <ReportScheduleViz />,
    descNs: "reportSchedule",
  },
  {
    key: "reportHistory",
    href: "/report/history",
    icon: Clock,
    visual: <ReportHistoryViz />,
    descNs: "reportHistory",
  },
];

/**
 * หน้า landing ของ Report — แบบเดียวกับ System Admin (skill `carmen-blue-ui-design`
 * §Landing pages): หัวกะทัดรัด + การ์ดหนึ่งใบต่อหนึ่งหน้าในเมนูซ้าย
 *
 * ไม่มีหัว chapter: กลุ่มเดียว หัว chapter จะแค่ทวนชื่อหน้า · การ์ดไม่ยืดเต็มจอ
 * (`minmax(18rem,1fr)` แบบ auto-fill ได้การ์ดกว้าง ~280–400px) จอกว้างจึงมีที่ว่างหลังใบที่สาม —
 * ยืดให้เต็มได้การ์ดกว้าง 1100px ที่ 4K ซึ่งผิดกติกา "จอกว้างขึ้น = คอลัมน์เพิ่ม ไม่ใช่ช่องกว้างขึ้น"
 *
 * สิทธิ์จาก `useVisibleModules` ตัวเดียวกับเมนูซ้าย: ถูกซ่อน = ไม่มีการ์ด · ล็อก/ไม่มีสิทธิ์ =
 * การ์ดจาง และไม่ยิง API ของตัวเลข (ยิงแล้วได้ 403)
 */
export default function ReportLanding() {
  const t = useTranslations("report.landing");
  const tm = useTranslations("modules");
  const tp = useTranslations();
  const visible = useVisibleModules(REPORT_SUBS);
  const accessByPath = new Map<string, ModuleWithAccess>(
    visible.map((sub) => [sub.path, sub]),
  );
  const cards = CARDS.filter((c) => accessByPath.has(c.href));

  return (
    <div className="w-full">
      <LandingHero title={tm("report")} lede={t("lede")} />
      {cards.length === 0 ? (
        <EmptyComponent icon={LockKeyhole} title={t("noAccess")} />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,18rem),1fr))] gap-3">
          {cards.map((card) => {
            const access = accessByPath.get(card.href);
            const blocked = Boolean(access?.locked || access?.denied);
            return (
              <LandingCard
                key={card.key}
                href={card.href}
                title={tm(card.key)}
                description={tp(`${card.descNs}.desc`)}
                icon={card.icon}
                visual={card.visual}
                stat={<CardStat cardKey={card.key} enabled={!blocked} />}
                access={access}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * ตัวเลขบนการ์ดจาก API เท่านั้น — ระหว่างโหลดหรือ error คืน `null` (ไม่ใช่ 0 ที่ดูเหมือนข้อมูลจริง)
 * แต่ละการ์ดเรียก hook ของตัวเองเท่านั้น จึงแยกเป็นคอมโพเนนต์ต่อการ์ด
 */
function CardStat({
  cardKey,
  enabled,
}: {
  readonly cardKey: CardKey;
  readonly enabled: boolean;
}) {
  switch (cardKey) {
    case "reportList":
      return <TemplatesStat enabled={enabled} />;
    case "reportSchedule":
      return <SchedulesStat enabled={enabled} />;
    case "reportHistory":
      return <HistoryStat enabled={enabled} />;
  }
}

function TemplatesStat({ enabled }: { readonly enabled: boolean }) {
  const t = useTranslations("report.landing");
  const { data } = useReportTemplates(COUNT_ONLY, {
    // นับแบบเดียวกับหน้า list (ซ่อน template ที่ปิดทั้ง Run และ Export) เลขจะได้ตรงกัน
    actionable: true,
    enabled,
  });
  const total = data?.paginate?.total;
  return total == null ? null : <>{t("countReports", { count: total })}</>;
}

function SchedulesStat({ enabled }: { readonly enabled: boolean }) {
  const t = useTranslations("report.landing");
  const { data } = useReportSchedules({ enabled });
  return data == null ? null : (
    <>{t("countSchedules", { count: data.length })}</>
  );
}

function HistoryStat({ enabled }: { readonly enabled: boolean }) {
  const t = useTranslations("report.landing");
  const { data } = useReportHistory(COUNT_ONLY, { enabled });
  const total = data?.paginate?.total;
  return total == null ? null : <>{t("countRuns", { count: total })}</>;
}
