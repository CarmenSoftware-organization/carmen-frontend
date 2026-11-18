import { type ReactNode, useState } from "react";
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
 * บันทึกของเอกสารในการ์ดหัวเอกสาร เป็นตารางเล็กตารางเดียว สองแถว คอลัมน์ตรงกัน:
 * ```
 * | สร้างโดย:    | ชื่อ | วันเวลา |        |
 * | แก้ไขล่าสุด: | ชื่อ | วันเวลา | rev. 2 |   ← ช่องรุ่นสูงเต็มทุกแถว (rowSpan)
 * ```
 *
 * ตัว 11px (text-micro — ผู้ใช้ลองดู 10px แล้วสั่งให้ใหญ่ขึ้น) เส้นขอบ /40 ไม่มีพื้นช่องป้าย — ผู้ใช้สั่งให้กลืนกับพื้นหลัง
 * สีตัวอักษรต้องเป็น text-muted-foreground เต็ม: /70 วัดได้ 3.09:1 (dark) / 3.45:1 (light) ตก WCAG AA 4.5:1
 * เต็มได้ 4.90:1 / 7.11:1 — ทำให้จางด้วยเส้นขอบ/พื้น ไม่ใช่ลดความทึบของตัวอักษร
 * ไม่ดึงสายตา · ห้ามลดต่ำกว่า 10px (9px line-height 1.2 ตัดสระบนภาษาไทย) ให้ลดที่ padding/สีแทน
 * ใช้ `<table>` จริงให้คอลัมน์ชื่อ/วันเวลาของสองแถวตรงกันเอง · ไม่ใช้ truncate กับชื่อ
 * (overflow-hidden ที่ line-height 1.35 ตัดสระบนภาษาไทย) ชื่อยาวให้ขึ้นบรรทัดใหม่ในช่องแทน
 *
 * @param audit - `doc.audit` (ไม่มีทั้ง created และ updated = ไม่ render เช่นโหมดสร้างใบใหม่)
 * @param docVersion - `doc.doc_version` (null/undefined = ไม่มีช่องรุ่น · 0 ยังแสดงเป็น rev. 0)
 * @example
 * <DocAuditLine audit={pr.audit} docVersion={pr.doc_version} className="ms-auto" />
 */
export function DocAuditLine({
  audit,
  docVersion,
  className,
}: {
  readonly audit?: Audit;
  readonly docVersion?: number | null;
  readonly className?: string;
}) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  if (!audit?.created?.at && !audit?.updated?.at) return null;

  const rows = [
    { label: tfl("auditCreatedBy"), entry: audit.created },
    { label: tfl("auditUpdatedBy"), entry: audit.updated },
  ].filter(({ entry }) => entry?.at || entry?.name);
  // ช่องรุ่นต่อท้ายแถวแรก สูงเต็มทุกแถว — `!= null` เพราะ doc_version 0 เป็นค่าจริง
  const revCell =
    docVersion != null ? (
      <td
        rowSpan={rows.length}
        className="border-border/40 border-s px-1.5 text-center align-middle whitespace-nowrap tabular-nums"
      >
        {tfl("revision")} {docVersion}
      </td>
    ) : null;

  return (
    <table
      className={cn(
        "text-muted-foreground text-micro border-border/40 w-fit max-w-full border-separate border-spacing-0 overflow-hidden rounded-sm border",
        className,
      )}
    >
      {/* ตารางไม่มีหัวคอลัมน์ที่มองเห็น — caption ให้ screen reader รู้ว่าตารางนี้คืออะไร */}
      <caption className="sr-only">{tfl("auditInfo")}</caption>
      <tbody>
        {rows.map(({ label, entry }, i) => (
          <AuditRow
            key={label}
            label={label}
            entry={entry}
            dateTimeFormat={dateTimeFormat}
            trailing={i === 0 ? revCell : null}
          />
        ))}
      </tbody>
    </table>
  );
}

const CELL =
  "border-border/40 px-1.5 py-0.5 text-start align-top [tr+tr>&]:border-t";

function AuditRow({
  label,
  entry,
  dateTimeFormat,
  trailing,
}: {
  readonly label: string;
  readonly entry?: AuditEntry;
  readonly dateTimeFormat: string;
  readonly trailing?: ReactNode;
}) {
  if (!entry) return null;
  return (
    <tr>
      <th scope="row" className={`${CELL} font-normal whitespace-nowrap`}>
        {label}:
      </th>
      <td className={`${CELL} border-s break-words`}>{entry.name ?? "—"}</td>
      <td className={`${CELL} border-s whitespace-nowrap tabular-nums`}>
        {entry.at ? formatDate(entry.at, dateTimeFormat) : "—"}
      </td>
      {trailing}
    </tr>
  );
}

/**
 * ทางเข้าแบบไอคอนของตาราง audit สำหรับจอแคบ — กดเปิด/ปิด (จอสัมผัส) และ hover เปิดเมื่อใช้เมาส์
 * ตารางเต็มที่วางในหัวเอกสารซ่อนบนมือถือ เพราะกินแถวเต็มใต้ Description
 *
 * @param audit - `doc.audit` (ไม่มีทั้ง created และ updated = ไม่ render)
 * @example
 * <DocAuditButton audit={pr.audit} docVersion={pr.doc_version} className="sm:hidden" />
 */
export function DocAuditButton({
  audit,
  docVersion,
  className,
}: {
  readonly audit?: Audit;
  readonly docVersion?: number | null;
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
        // เปิดด้วย hover ต้องไม่ดึงโฟกัสออกจากจุดเดิม · เนื้อหาไม่มีอะไรให้กด โฟกัสจึงอยู่ที่ปุ่ม
        // Esc ยังปิดได้ (Radix ฟังที่ document) และ Radix คืนโฟกัสให้ปุ่มเอง
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerEnter={onHover(true)}
        onPointerLeave={onHover(false)}
      >
        <DocAuditLine audit={audit} docVersion={docVersion} />
      </PopoverContent>
    </Popover>
  );
}
