import { Mail, Phone } from "lucide-react";
import { useTranslations } from "use-intl";
import { EyeBrow } from "@/components/ui/eye-brow";

/** ช่องที่อยู่ของ hotel/company — ชุดเดียวกัน ต่างกันแค่ prefix ของชื่อ field */
export interface AddressParts {
  readonly name: string | null;
  readonly line1: string | null;
  readonly line2: string | null;
  readonly subDistrict: string | null;
  readonly district: string | null;
  readonly city: string | null;
  readonly province: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly email: string | null;
  readonly tel: string | null;
}

const present = (v: string | null): v is string => !!v && v.trim() !== "";

/**
 * บรรทัดท้องที่ของที่อยู่ — ตำบล · อำเภอ · เมือง · จังหวัด · รหัสไปรษณีย์ · ประเทศ
 * รวมเป็นบรรทัดเดียว ข้ามช่องว่าง (ส่วนใหญ่ BU กรอกแค่บางช่อง)
 */
export function localityLine(a: AddressParts): string {
  return [
    a.subDistrict,
    a.district,
    a.city,
    a.province,
    a.postalCode,
    a.country,
  ]
    .filter(present)
    .join(", ");
}

/**
 * ที่อยู่ในโหมดดู — จัดเป็นบล็อกแบบหัวจดหมาย แทนกล่องแยก 11 ช่องที่ครึ่งหนึ่งเป็น "—"
 *
 * @param printed - true = นี่คือข้อมูลที่ไปขึ้นหัวเอกสาร (บริษัท) → มี eyebrow บอก
 * @param legal - บรรทัดเลขภาษี/สาขา (เฉพาะบริษัท) — ช่องว่างโชว์ "ยังไม่ได้ระบุ"
 *   เพราะเอกสารภาษีขาดสองค่านี้ไม่ได้ ต่างจากช่องที่อยู่ที่เว้นได้
 */
export function AddressView({
  address,
  printed,
  legal,
}: {
  readonly address: AddressParts;
  readonly printed?: boolean;
  readonly legal?: ReadonlyArray<{
    readonly label: string;
    readonly value: string | null;
  }>;
}) {
  const t = useTranslations("companyProfile");
  const locality = localityLine(address);
  const lines = [address.line1, address.line2, locality].filter(present);
  const hasContact = present(address.email) || present(address.tel);

  return (
    <div className="space-y-3 sm:col-span-2">
      {printed && <EyeBrow>{t("address.printedOn")}</EyeBrow>}
      <div className="space-y-0.5">
        <p className="text-sm font-semibold break-words">
          {present(address.name) ? (
            address.name
          ) : (
            <span className="text-muted-foreground font-normal">
              {t("address.notSet")}
            </span>
          )}
        </p>
        {lines.length > 0 ? (
          lines.map((l) => (
            <p key={l} className="text-muted-foreground text-sm break-words">
              {l}
            </p>
          ))
        ) : (
          <p className="text-muted-foreground/70 text-sm">
            {t("address.noAddress")}
          </p>
        )}
      </div>
      {legal && legal.length > 0 && (
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
          {legal.map((l) => (
            <div key={l.label} className="flex gap-2">
              <dt className="text-muted-foreground">{l.label}</dt>
              <dd
                className={
                  present(l.value)
                    ? "font-mono tabular-nums"
                    : "text-warning-ink"
                }
              >
                {present(l.value) ? l.value : t("address.notSet")}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {hasContact && (
        <div className="flex flex-wrap gap-x-6 gap-y-1 border-t pt-3 text-sm">
          {present(address.email) && (
            <a
              href={`mailto:${address.email}`}
              className="text-muted-foreground hover:text-foreground inline-flex min-w-0 items-center gap-2 break-all"
            >
              <Mail className="size-3.5 shrink-0" aria-hidden />
              {address.email}
            </a>
          )}
          {present(address.tel) && (
            <a
              href={`tel:${address.tel.replace(/\s+/g, "")}`}
              className="text-muted-foreground hover:text-foreground inline-flex items-center gap-2 tabular-nums"
            >
              <Phone className="size-3.5 shrink-0" aria-hidden />
              {address.tel}
            </a>
          )}
        </div>
      )}
    </div>
  );
}
