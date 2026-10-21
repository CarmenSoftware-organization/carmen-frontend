import { useTranslations } from "use-intl";
import { AlertTriangle, Bell } from "lucide-react";
import {
  splitTemplate,
  unknownVariables,
  type TemplateSegment,
} from "./noti-tmpl-variables";

/**
 * ข้อความเทมเพลตแบบดิบ — ย้อม `{{token}}` ให้จางลง
 *
 * เทมเพลตทุกอันขึ้นต้นด้วยโครงประโยคคล้ายกันและมีตัวแปรแทรกกลาง ถ้าปล่อยสีเดียวกันหมด
 * ตาจะสะดุด `{{docNo}}` ก่อนคำที่ใช้แยกแถวออกจากกัน — ตัวแปรจึงถอยเป็นพื้นหลัง
 * ให้ถ้อยคำจริงเป็นสิ่งที่อ่านได้ก่อน
 */
export function TemplateText({ text }: { readonly text: string }) {
  const parts = text.split(/(\{\{\w+\}\})/g).filter(Boolean);
  return (
    <span className="line-clamp-1">
      {parts.map((part, i) =>
        /^\{\{\w+\}\}$/.test(part) ? (
          <span key={i} className="text-muted-foreground/60 font-mono">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </span>
  );
}

/**
 * พรีวิว "ตามรูปทรงของปลายทางจริง" — การ์ดแจ้งเตือนในแอป
 *
 * คนเขียนตัดสินใจเรื่องความยาวและน้ำเสียงจากรูปทรงที่ผู้รับเห็น ไม่ใช่จากกล่อง
 * ข้อความเปล่า ๆ · ค่าที่เติมเป็นค่าตัวอย่าง (ย้อมสีให้เห็นว่าไม่ใช่ข้อความคงที่)
 * ส่วนตัวแปรที่ไม่รู้จักจะโชว์เป็น `{{...}}` สีแดง เพราะตอนส่งจริงมันจะค้าง
 * แบบนั้นไปถึงผู้รับ
 */
export function NotiTmplPreview({
  name,
  body,
}: {
  readonly name: string;
  readonly body: string;
}) {
  const t = useTranslations("systemAdmin.notificationTemplate");
  const unknown = unknownVariables(body);

  return (
    <div className="flex h-full min-w-0 flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <Bell className="text-muted-foreground size-3.5" aria-hidden />
        <span className="text-micro-eyebrow text-muted-foreground tracking-wider uppercase">
          {t("previewTitle")}
        </span>
      </div>

      {/* เวทีสีกลาง + การ์ดสี bg-card ทับบน — อ่านเป็น "ของวางอยู่บนพื้น"
          ไม่ใช่การ์ดซ้อนการ์ด (ทั้งบล็อกนี้อยู่ในการ์ดของ SettingSection แล้ว) */}
      <div className="bg-muted/50 flex-1 rounded-lg p-3 sm:p-4">
        <div className="bg-card flex gap-2.5 rounded-lg border p-3 shadow-sm">
          <div className="bg-info/15 text-info-ink flex size-7 shrink-0 items-center justify-center rounded-full text-micro font-bold">
            C
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-xs font-semibold">{name}</p>
              <span className="text-muted-foreground shrink-0 text-micro">
                {t("previewNow")}
              </span>
            </div>
            <p className="text-muted-foreground text-xs leading-relaxed break-words whitespace-pre-wrap">
              <Filled text={body} />
            </p>
          </div>
        </div>
      </div>

      {unknown.length > 0 && (
        <p className="text-destructive flex items-start gap-1.5 text-micro">
          <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden />
          <span>
            {t("previewUnknownVars")}{" "}
            <span className="font-mono">{unknown.join(", ")}</span>
          </span>
        </p>
      )}
    </div>
  );
}

function Filled({ text }: { readonly text: string }) {
  const segments = splitTemplate(text);
  if (segments.length === 0) return null;
  return (
    <>
      {segments.map((s: TemplateSegment, i) => {
        if (s.kind === "text") return <span key={i}>{s.text}</span>;
        if (s.kind === "unknown") {
          return (
            <span
              key={i}
              className="text-destructive bg-destructive/10 rounded-sm px-0.5 font-mono"
            >
              {s.text}
            </span>
          );
        }
        return (
          <span key={i} className="text-foreground font-medium">
            {s.text}
          </span>
        );
      })}
    </>
  );
}
