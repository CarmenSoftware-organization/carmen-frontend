import { useState } from "react";
import { Info } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";
import type { Audit, AuditEntry } from "@/types/audit";

/**
 * บันทึกของเอกสารในแถบท้ายหน้า เป็นตารางเล็กตารางเดียว สองแถว คอลัมน์ตรงกัน:
 * ```
 * | สร้างโดย:    | ชื่อ | วันเวลา |
 * | แก้ไขล่าสุด: | ชื่อ | วันเวลา |
 * ```
 *
 * ตัว 10px (text-micro-legal — ขั้นของ ladder สำหรับ inline meta) สีจาง ไม่แย่งความสนใจจากยอดรวมและปุ่ม Save/Submit
 * ใช้ `<table>` จริงให้คอลัมน์ชื่อ/วันเวลาของสองแถวตรงกันเอง · ไม่ใช้ truncate กับชื่อ
 * (overflow-hidden ที่ line-height 1.35 ตัดสระบนภาษาไทย) ชื่อยาวให้ขึ้นบรรทัดใหม่ในช่องแทน
 *
 * @param audit - `doc.audit` (ไม่มีทั้ง created และ updated = ไม่ render เช่นโหมดสร้างใบใหม่)
 * @example
 * <DocAuditLine audit={pr.audit} className="ms-auto" />
 */
export function DocAuditLine({
  audit,
  className,
}: {
  readonly audit?: Audit;
  readonly className?: string;
}) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  if (!audit?.created?.at && !audit?.updated?.at) return null;

  return (
    <table
      className={cn(
        "text-muted-foreground text-micro-legal border-border w-fit max-w-full border-separate border-spacing-0 overflow-hidden rounded-sm border",
        className,
      )}
    >
      <tbody>
        <AuditRow
          label={tfl("auditCreatedBy")}
          entry={audit.created}
          dateTimeFormat={dateTimeFormat}
        />
        <AuditRow
          label={tfl("auditUpdatedBy")}
          entry={audit.updated}
          dateTimeFormat={dateTimeFormat}
        />
      </tbody>
    </table>
  );
}

const CELL =
  "border-border px-1 py-px sm:px-1.5 sm:py-0.5 text-start align-top [tr+tr>&]:border-t";

function AuditRow({
  label,
  entry,
  dateTimeFormat,
}: {
  readonly label: string;
  readonly entry?: AuditEntry;
  readonly dateTimeFormat: string;
}) {
  if (!entry?.at && !entry?.name) return null;
  return (
    <tr>
      <th
        scope="row"
        className={`${CELL} bg-muted/60 font-normal whitespace-nowrap`}
      >
        {label}:
      </th>
      <td className={`${CELL} text-foreground/80 border-s break-words`}>
        {entry.name ?? "—"}
      </td>
      <td className={`${CELL} border-s whitespace-nowrap tabular-nums`}>
        {entry.at ? formatDate(entry.at, dateTimeFormat) : "—"}
      </td>
    </tr>
  );
}

/**
 * ทางเข้าแบบไอคอนของตาราง audit สำหรับจอแคบ — กดเปิด/ปิด (จอสัมผัส) และ hover เปิดเมื่อใช้เมาส์
 * ตารางเต็มที่วางในหัวเอกสารซ่อนบนมือถือ เพราะกินแถวเต็มใต้ Description
 *
 * @param audit - `doc.audit` (ไม่มีทั้ง created และ updated = ไม่ render)
 * @example
 * <DocAuditButton audit={pr.audit} className="sm:hidden" />
 */
export function DocAuditButton({
  audit,
  className,
}: {
  readonly audit?: Audit;
  readonly className?: string;
}) {
  const tfl = useTranslations("field");
  const [open, setOpen] = useState(false);

  if (!audit?.created?.at && !audit?.updated?.at) return null;

  // hover เฉพาะเมาส์ — นิ้วแตะยิง pointerenter ก่อน click แล้ว click จะ toggle ปิดทันที
  const onHover = (next: boolean) => (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={tfl("auditInfo")}
          className={cn("text-muted-foreground", className)}
          onPointerEnter={onHover(true)}
          onPointerLeave={onHover(false)}
        >
          <Info aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto max-w-[calc(100vw-2rem)] p-1.5"
        onPointerEnter={onHover(true)}
        onPointerLeave={onHover(false)}
      >
        <DocAuditLine audit={audit} />
      </PopoverContent>
    </Popover>
  );
}
