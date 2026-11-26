import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { PartKind, PreviewSegment } from "./running-code-config";
import { typeLabelKey } from "./running-code-labels";

/**
 * สีของแต่ละชิ้นในเลขตัวอย่าง — ให้เห็นโครงของเลข (ตัวนำหน้า · วันที่ · เลขรัน ·
 * ค่าจากข้อมูล) ในแวบเดียวโดยไม่ต้องเปิด dialog · เลขรันเป็นชิ้นที่ขยับจริงทุกใบ
 * จึงเป็นชิ้นเดียวที่ได้สีเด่น (`text-primary` อ่านออกทั้งสองธีม — DESIGN.md)
 */
const SEGMENT_CLASS: Record<PartKind, string> = {
  text: "text-foreground",
  date: "text-muted-foreground",
  running: "text-primary font-semibold",
  token: "text-muted-foreground italic",
};

export function RunningCodeExample({
  segments,
}: {
  readonly segments: PreviewSegment[] | null;
}) {
  if (!segments) return <span className="text-muted-foreground/60">—</span>;
  const full = segments.map((s) => s.text).join("");
  return (
    <span className="block truncate font-mono" title={full}>
      {segments.map((s, i) => (
        // ลำดับชิ้นคือ identity — ชิ้นซ้ำชนิดกันได้ ไม่มี id อื่น
        <span key={i} className={SEGMENT_CLASS[s.kind]}>
          {s.text}
        </span>
      ))}
    </span>
  );
}

/** ชื่อเอกสารแบบคนอ่าน — type ที่ไม่รู้จักคืน `null` (ผู้เรียกโชว์ key ดิบ) */
export function useRunningCodeTypeLabel() {
  const t = useTranslations("systemAdmin.runningCode.typeLabel");
  return (type: string) => {
    const key = typeLabelKey(type);
    return key ? t(key) : null;
  };
}

/**
 * หัวแถว: ชื่อคนอ่านเป็นบรรทัดหลัก key ดิบเป็นบรรทัดรอง (ไว้เทียบกับ log/API)
 * ทั้งคู่บรรทัดเดียว ยาวเกินตัดท้ายพร้อม `title` — เดิมตัดคำสองบรรทัดและ AR ยาว ๆ
 * ถูกตัดจนอ่านไม่ครบ
 */
export function RunningCodeTypeText({
  type,
  label,
  className,
}: {
  readonly type: string;
  readonly label: string | null;
  readonly className?: string;
}) {
  return (
    <span className={cn("flex min-w-0 flex-col", className)}>
      <span className="truncate" title={label ?? type}>
        {label ?? type}
      </span>
      {label && (
        <span
          className="text-muted-foreground text-micro truncate font-mono font-normal tracking-tight"
          title={type}
        >
          {type}
        </span>
      )}
    </span>
  );
}
