import { createContext, useContext, useMemo, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { formatDate } from "@/lib/date-utils";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";

const MARKER_CLASS = {
  current: "bg-primary",
  default: "bg-border",
  origin: "bg-background border-2 border-border",
} as const;

export type HistoryTimelineMarker = keyof typeof MARKER_CLASS;

interface HistoryTimelineContextValue {
  readonly dateFormat: string;
  readonly hasTime: boolean;
  readonly groupByDay: boolean;
}

const HistoryTimelineContext = createContext<
  HistoryTimelineContextValue | undefined
>(undefined);

/**
 * Hook อ่าน dateFormat/hasTime จาก HistoryTimelineContext
 *
 * Throw error ถ้าถูกเรียกนอก `<HistoryTimeline>` แทนที่จะเงียบแล้วเรนเดอร์
 * รางวันที่ว่างเปล่า — บอกที่ผิดตั้งแต่ตอนพัฒนา ดีกว่าปล่อยให้ UI ดูเหมือน
 * ข้อมูลหาย
 *
 * @returns ค่า context `{ dateFormat, hasTime }`
 */
function useHistoryTimelineContext() {
  const context = useContext(HistoryTimelineContext);
  if (!context) {
    throw new Error(
      "HistoryTimelineItem must be used within a HistoryTimeline",
    );
  }
  return context;
}

interface HistoryTimelineProps {
  readonly children: ReactNode;
  readonly groupByDay?: boolean;
}

/**
 * รายการไทม์ไลน์ประวัติแบบคอลัมน์เดียว — ราง "วันที่/เวลา" ซ้าย · เส้นกับจุด · เนื้อหาขวา
 *
 * `<ol>` ถือ grid 2 คอลัมน์ไว้เอง แล้ว `<li>` แต่ละตัวใช้ `grid-cols-subgrid`
 * เพื่อให้คอลัมน์วันที่กว้างเท่ากันทุกแถวโดยไม่ต้อง fix ความกว้าง — จำเป็นเพราะ
 * `date_format` มาจาก config ของ BU จะยาวแค่ไหนก็ได้ (`DD/MM/YYYY` หรือ
 * `DD MMMM YYYY`) และ subgrid ยังทำให้ `<li>` เป็น list item จริงในสายตา
 * screen reader ต่างจาก `display: contents`
 *
 * @param props.children - `HistoryTimelineItem` เรียงตามลำดับที่จะแสดง
 * @returns React element ของรายการไทม์ไลน์
 * @example
 * <HistoryTimeline>
 *   <HistoryTimelineItem at={entry.at} marker="current" title={entry.user.name} />
 * </HistoryTimeline>
 */
export function HistoryTimeline({
  children,
  groupByDay = false,
}: HistoryTimelineProps) {
  // เรียก useProfile() ที่นี่เพียงครั้งเดียวต่อ sheet — ไม่ใช่ในทุกแถวของ
  // HistoryTimelineItem จะได้ไม่มี query observer 20 ตัวต่อประวัติ 20 แถว
  const { dateFormat } = useProfile();

  // `date_format` ของ BU ใส่ token เวลามาเองได้ (เช่น "DD/MM/YYYY HH:mm") — ต่อ
  // "HH:mm" ทับลงไปอีกจะได้เวลาซ้ำสองที่ในรางเดียว คำนวณ hasTime ครั้งเดียวที่นี่
  // แล้วส่งลงไปทุกแถวผ่าน context แทนที่จะคำนวณซ้ำทุกแถว (ค่าเดียวกันทั้งไทม์ไลน์)
  const hasTime = dateFormat.includes("HH") || dateFormat.includes("hh");

  const contextValue = useMemo<HistoryTimelineContextValue>(
    () => ({ dateFormat, hasTime, groupByDay }),
    [dateFormat, hasTime, groupByDay],
  );

  return (
    <HistoryTimelineContext.Provider value={contextValue}>
      <ol role="list" className="grid grid-cols-[auto_1fr] gap-x-3">
        {children}
      </ol>
    </HistoryTimelineContext.Provider>
  );
}

interface HistoryTimelineDayProps {
  readonly children: ReactNode;
}

/**
 * หัวข้อคั่นวัน — พิมพ์วันที่ครั้งเดียวต่อวัน แทนที่จะซ้ำทุกแถว
 *
 * workflow ที่จบภายในวันเดียวเคยพิมพ์วันที่เดิมซ้ำ 6 ครั้งในราง ซึ่งกินพื้นที่
 * ให้กับสิ่งที่ไม่เปลี่ยน หัวข้อคั่นทำให้รางเหลือแต่เวลา และวันที่ยังอ่านได้
 * ครบเมื่อ workflow ข้ามวัน
 *
 * @param props.children - ข้อความวันที่ที่ format แล้ว
 * @returns React element ของแถวคั่นวัน (กินเต็มความกว้างทั้งสองคอลัมน์)
 */
export function HistoryTimelineDay({ children }: HistoryTimelineDayProps) {
  return (
    <li className="col-span-2 flex items-center gap-2 pt-2 pb-3 first:pt-0">
      <span className="text-micro text-muted-foreground font-medium">
        {children}
      </span>
      <span aria-hidden="true" className="bg-border h-px flex-1" />
    </li>
  );
}

export interface HistoryTimelineItemProps {
  readonly at: string;
  readonly marker?: HistoryTimelineMarker;
  readonly tone?: "default" | "alert";
  readonly badge?: ReactNode;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly elapsed?: ReactNode;
  /**
   * เนื้อหาที่กางออก — ส่งมาเมื่อไหร่ แถวจะกลายเป็น accordion
   *
   * เนื้อหาถูกวางในคอลัมน์เดียวกับหัวข้อ เส้นราง (`border-l` ของคอลัมน์นั้น)
   * จึงยืดคลุมเองโดยไม่ต้องวัดความสูง
   */
  readonly expandable?: ReactNode;
  /**
   * สถานะกาง — controlled ล้วน ผู้เรียกต้องถือ state เอง
   *
   * ตั้งใจไม่มีโหมด uncontrolled เพราะผู้ใช้จริงทุกรายต้องการ "เปิดได้ทีละแถว"
   * ซึ่งทำไม่ได้ถ้าแต่ละแถวถือ state ของตัวเอง
   */
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

/**
 * หนึ่งก้าวของไทม์ไลน์ — วันที่/เวลาในรางซ้าย จุด marker บนเส้น แล้วเนื้อหาทางขวา
 *
 * เส้นรางวาดด้วย `border-l` ของคอลัมน์เนื้อหา (ไม่ใช่ element absolute แยก) จึง
 * ต่อกันสนิทเสมอไม่ว่าเนื้อหาจะสูงเท่าไร และ `group-last/hist` ทำให้ก้าวสุดท้าย
 * ไม่มีเส้นห้อยลงมา
 *
 * @param props.at - ISO datetime ของก้าวนี้ (ว่างได้ รางจะว่างแทนที่จะพัง)
 * @param props.marker - ชนิดจุด marker
 * @param props.tone - `alert` สำหรับก้าวที่ผิดจากทางปกติ
 * @param props.badge - Badge สถานะ (ส่งเฉพาะก้าวผิดปกติ)
 * @param props.title - หัวข้อของก้าว
 * @param props.children - บรรทัดรองใต้หัวข้อ
 * @param props.elapsed - ระยะเวลาที่ค้างก่อนถึงก้าวนี้
 * @param props.expandable - เนื้อหาที่กางออก (ส่งมาแล้วแถวจะกลายเป็น accordion)
 * @param props.open - สถานะกาง (controlled)
 * @param props.onOpenChange - callback เมื่อกด trigger
 * @returns React element ของหนึ่งก้าว
 */
export function HistoryTimelineItem({
  at,
  marker = "default",
  tone = "default",
  badge,
  title,
  children,
  elapsed,
  expandable,
  open,
  onOpenChange,
}: HistoryTimelineItemProps) {
  const { dateFormat, hasTime, groupByDay } = useHistoryTimelineContext();

  // เมื่อจัดกลุ่มตามวัน วันที่ย้ายไปอยู่หัวข้อคั่นแล้ว รางเหลือแต่เวลา — ใช้
  // "HH:mm" ตรง ๆ ไม่ต้องแยกส่วนเวลาออกจาก dateFormat ซึ่งทำไม่ได้เสมอไป
  const dateLine = groupByDay
    ? formatDate(at, "HH:mm")
    : formatDate(at, dateFormat);
  const timeLine = groupByDay || hasTime ? "" : formatDate(at, "HH:mm");
  // dateLine ว่างแปลว่า `at` parse เป็นวันที่ไม่ได้ (ดู formatDate) — attribute
  // `dateTime` ต้องไม่ใส่ค่าที่ไม่ valid ไปด้วย ปล่อยเป็น undefined แทน
  const dateTimeAttr = dateLine ? at : undefined;

  // หัวข้อ + บรรทัดรอง ใช้ร่วมกันทั้งแถวที่กางได้และกางไม่ได้ — แถวที่กางได้เอา
  // ทั้งก้อนไปใส่ใน trigger เพื่อให้คลิกที่หัวข้อก็เปิด ไม่ใช่ต้องเล็งลูกศรเล็ก ๆ
  const headline = (
    <>
      {/* หัวข้อกับ badge อยู่แถวเดียวกันได้ เพราะ badge ถูกสงวนไว้ให้ก้าวที่
          ผิดปกติเท่านั้น — แถวส่วนใหญ่จึงมีแค่หัวข้อ ไม่แย่งที่กัน */}
      {(title || badge) && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {title && <span className="block text-xs font-medium">{title}</span>}
          {badge}
        </div>
      )}
      {/* div ไม่ใช่ p — แถวที่กางได้เอาก้อนนี้ไปไว้ในปุ่ม ซึ่งซ้อนใน <p> ไม่ได้ */}
      {children && (
        <div className="text-muted-foreground text-xs">{children}</div>
      )}
    </>
  );

  return (
    <li className="group/hist col-span-2 grid grid-cols-subgrid">
      <time
        dateTime={dateTimeAttr}
        className="text-micro text-muted-foreground pt-0.5 text-right leading-tight whitespace-nowrap tabular-nums"
      >
        <span className="block">{dateLine}</span>
        {timeLine && <span className="block">{timeLine}</span>}
      </time>
      <div className="relative min-w-0 border-l pb-5 pl-4 group-last/hist:border-transparent group-last/hist:pb-0">
        <span
          aria-hidden="true"
          className={cn(
            "ring-background absolute top-1.5 left-0 size-2 -translate-x-1/2 rounded-full ring-4",
            tone === "alert" ? "bg-destructive" : MARKER_CLASS[marker],
          )}
        />
        {expandable ? (
          <Collapsible open={open} onOpenChange={onOpenChange}>
            <CollapsibleTrigger className="hover:bg-muted/50 focus-visible:ring-ring flex w-full cursor-pointer items-start gap-2 rounded-md py-0.5 pr-1 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none">
              <div className="min-w-0 flex-1">{headline}</div>
              <ChevronRight
                aria-hidden="true"
                className={cn(
                  "text-muted-foreground mt-1 size-3.5 shrink-0 transition-transform",
                  open && "rotate-90",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>{expandable}</CollapsibleContent>
          </Collapsible>
        ) : (
          headline
        )}
        {/* elapsed อยู่นอก Collapsible เสมอ — ความหมายของมันคือช่องว่างที่ติดกับ
            แถวที่เก่ากว่าซึ่งอยู่ข้างล่าง ต้องเห็นได้ทั้งตอนกางและตอนหุบ */}
        {/* ไม่ลดความทึบของสี — `text-muted-foreground/70` วัดได้ 2.97:1 บนพื้นมืด
            และ 3.25:1 บนพื้นสว่าง ซึ่งต่ำกว่าเกณฑ์ AA (4.5:1) ที่ docs/DESIGN.md
            กำหนดไว้ ยิ่งข้อความนี้เป็น text-micro-legal (10px) ยิ่งต้องผ่านเกณฑ์
            ลำดับสายตายังคงอยู่เพราะมันเล็กกว่าบรรทัดอื่นและอยู่ท้ายสุดของแถว */}
        {elapsed && (
          <p className="text-muted-foreground text-micro-legal mt-2">
            {elapsed}
          </p>
        )}
      </div>
    </li>
  );
}
