import { useTranslations } from "use-intl";
import { PersonAvatar } from "@/components/share/person-avatar";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { Audit, AuditEntry } from "@/types/audit";

/**
 * การ์ดบันทึกของเอกสาร (ผู้สร้าง/วันที่สร้าง · ผู้แก้ล่าสุด/วันที่แก้) วางท้ายหน้าเอกสาร
 *
 * ตั้งใจให้เงียบที่สุดในหน้า: ไม่มีพื้น card มีแค่เส้นขอบจาง ตัวอักษร xs สีจาง — เป็นข้อมูล
 * อ้างอิงตอนสงสัย ไม่ใช่สิ่งที่ต้องอ่านทุกครั้ง ประวัติละเอียดอยู่ที่ activity sheet แล้ว
 * สองช่องเรียงตามความกว้างกล่อง (container query) — กล่องแคบซ้อนเป็นสองแถว
 *
 * @param audit - `doc.audit` (ไม่มีทั้ง created และ updated = ไม่ render เช่นโหมดสร้างใบใหม่)
 * @example
 * <DocAuditCard audit={purchaseRequest?.audit} />
 */
export function DocAuditCard({ audit }: { readonly audit?: Audit }) {
  const tfl = useTranslations("field");
  const { dateTimeFormat } = useProfile();

  if (!audit?.created?.at && !audit?.updated?.at) return null;

  return (
    <section
      aria-label={`${tfl("created")} / ${tfl("updated")}`}
      className="border-border/60 @container/audit rounded-lg border border-dashed px-3 py-2"
    >
      <dl className="grid grid-cols-1 gap-x-6 gap-y-1.5 @md/audit:grid-cols-2">
        <AuditCell
          label={tfl("created")}
          entry={audit.created}
          dateTimeFormat={dateTimeFormat}
        />
        <AuditCell
          label={tfl("updated")}
          entry={audit.updated}
          dateTimeFormat={dateTimeFormat}
        />
      </dl>
    </section>
  );
}

function AuditCell({
  label,
  entry,
  dateTimeFormat,
}: {
  readonly label: string;
  readonly entry?: AuditEntry;
  readonly dateTimeFormat: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 text-xs">
      <dt className="text-muted-foreground w-24 shrink-0">{label}</dt>
      <dd className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
        {entry?.name ? (
          <span className="text-foreground flex min-w-0 items-center gap-1.5">
            <PersonAvatar
              fallback="icon"
              avatarUrl={entry.avatar}
              className="text-muted-foreground size-4 shrink-0"
              fallbackClassName="bg-transparent text-inherit"
              iconClassName="size-full"
            />
            <span className="truncate">{entry.name}</span>
          </span>
        ) : null}
        <span className="text-muted-foreground tabular-nums">
          {entry?.at ? formatDate(entry.at, dateTimeFormat) : "—"}
        </span>
      </dd>
    </div>
  );
}
