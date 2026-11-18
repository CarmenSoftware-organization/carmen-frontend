import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { Audit, AuditEntry } from "@/types/audit";

/**
 * บรรทัดบันทึกของเอกสารในแถบท้ายหน้า: "สร้างโดย: ชื่อ (วันเวลา) | แก้ไขล่าสุด: ชื่อ (วันเวลา)"
 *
 * ตัวเล็ก (text-xs) สีจางทั้งบรรทัด ไม่แย่งความสนใจจากยอดรวมและปุ่ม Save/Submit ข้าง ๆ
 * ตัวคั่นเป็น border-s ของช่องที่สอง (ทรงเดียวกับ SummaryBar) ไม่ใช่ตัวอักษร "|" —
 * กล่องแคบจนช่องที่สองตกบรรทัด เส้นจะถูก overflow-hidden ตัดทิ้ง ไม่ค้างหัวบรรทัด
 *
 * @param audit - `doc.audit` (ไม่มีทั้ง created และ updated = ไม่ render เช่นโหมดสร้างใบใหม่)
 * @example
 * <SummaryFooterBar meta={<DocAuditLine audit={pr.audit} />} … />
 */
export function DocAuditLine({ audit }: { readonly audit?: Audit }) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  if (!audit?.created?.at && !audit?.updated?.at) return null;

  return (
    <div className="text-muted-foreground overflow-hidden text-xs">
      <div className="-ms-[17px] flex flex-wrap items-center gap-x-4 gap-y-0.5">
        <AuditPart
          label={tfl("auditCreatedBy")}
          entry={audit.created}
          dateTimeFormat={dateTimeFormat}
        />
        <AuditPart
          label={tfl("auditUpdatedBy")}
          entry={audit.updated}
          dateTimeFormat={dateTimeFormat}
        />
      </div>
    </div>
  );
}

function AuditPart({
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
    <span className="border-border min-w-0 border-s ps-4">
      {label}: {entry.name ?? "—"}
      {entry.at && (
        <span className="whitespace-nowrap tabular-nums">
          {" "}
          ({formatDate(entry.at, dateTimeFormat)})
        </span>
      )}
    </span>
  );
}
