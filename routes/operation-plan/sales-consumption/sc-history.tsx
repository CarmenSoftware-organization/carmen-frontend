import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { ScDetail, ScHistoryEntry } from "@/types/sales-consumption";

/** ประวัติของวัน เรียงใหม่ → เก่า (backend ส่งเก่า → ใหม่) */
function newestFirst(history: ScHistoryEntry[]): ScHistoryEntry[] {
  return [...history].sort((a, b) => b.at.localeCompare(a.at));
}

/**
 * แท็บประวัติ — สร้าง/นำเข้าไฟล์/ตรวจ on-hand/post/void ของทุกเอกสารในวันขายเดียวกัน
 *
 * @returns React element ของแท็บ
 */
export function ScHistory({ sc }: { readonly sc: ScDetail }) {
  const t = useTranslations("operationPlan.salesConsumption.detail.history");
  const tBrand = useTranslations("operationPlan.salesConsumption.detail.brand");
  const { dateTimeFormat } = useProfile();

  if (sc.history.length === 0) {
    return <p className="text-muted-foreground text-sm">{t("empty")}</p>;
  }

  const detailOf = (h: ScHistoryEntry): string | null => {
    const p = h.text_params;
    if (h.action === "imported") {
      const brand = String(p.brand ?? "");
      return [p.store_name, tBrand.has(brand) ? tBrand(brand) : brand]
        .filter(Boolean)
        .join(" · ");
    }
    if (h.action === "onhand_verified") {
      return p.ok === false ? t("verifiedShort") : t("verifiedOk");
    }
    if (h.action === "voided" && p.reason) {
      return t("reason", { reason: String(p.reason) });
    }
    return null;
  };

  return (
    <ol className="space-y-3">
      {newestFirst(sc.history).map((h, i) => {
        const detail = detailOf(h);
        return (
          <li
            key={`${h.at}-${h.action}-${i}`}
            className="border-border border-l-2 pl-3"
          >
            <div className="text-sm font-medium">
              {t(`actions.${h.action}`, {
                sc_no: String(h.text_params.sc_no ?? ""),
                file_name: String(h.text_params.file_name ?? ""),
              })}
            </div>
            {detail && (
              <div className="text-muted-foreground text-sm">{detail}</div>
            )}
            <div className="text-muted-foreground text-xs">
              {formatDate(h.at, dateTimeFormat)}
              {h.user_name && ` · ${t("byUser", { user: h.user_name })}`}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
