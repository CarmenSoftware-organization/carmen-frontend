import { useTranslations } from "use-intl";
import type { FileUsage } from "@/types/document";

const MAX_SHOWN = 5;

/** "รูปสินค้า · 801010001" ต่อบรรทัด สูงสุด 5 แล้วต่อด้วย "และอีก N รายการ" · null/ว่าง = ไม่แสดงอะไร */
export function DocumentUsageList({
  usages,
}: {
  readonly usages: FileUsage[] | null | undefined;
}) {
  const t = useTranslations("systemAdmin.document");
  if (!usages || usages.length === 0) return null;
  const shown = usages.slice(0, MAX_SHOWN);
  return (
    <span className="block space-y-0.5">
      {shown.map((u, i) => {
        const kind = t.has(`usage.${u.kind}`) ? t(`usage.${u.kind}`) : u.kind;
        const label = u.label ?? u.owner_id;
        return (
          <span key={`${u.kind}-${u.owner_id ?? i}-${i}`} className="block">
            {label ? `${kind} · ${label}` : kind}
          </span>
        );
      })}
      {usages.length > shown.length && (
        <span className="text-muted-foreground block">
          {t("usageMore", { count: usages.length - shown.length })}
        </span>
      )}
    </span>
  );
}
