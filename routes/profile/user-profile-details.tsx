import { Link } from "react-router";
import { Building2, Mail, Phone, Settings } from "lucide-react";
import { useTranslations } from "use-intl";
import { useProfile } from "@/hooks/use-profile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import LoaderProfile from "@/components/loader/loader-profile";
import {
  CompactSection,
  FieldGrid,
  SECTION_PAIR,
} from "@/components/share/compact-section";
import { SettingField } from "@/components/share/setting-field";
import BUSection from "./bu-section";

export default function UserProfileDetails() {
  const t = useTranslations("profile");
  const { data: profile, isLoading, isError } = useProfile();

  if (isLoading) return <LoaderProfile />;

  if (isError || !profile)
    return <p className="text-destructive p-4 text-xs">{t("failedToLoad")}</p>;

  const { user_info } = profile;
  const fullName = [
    user_info.firstname,
    user_info.middlename,
    user_info.lastname,
  ]
    .filter(Boolean)
    .join(" ");

  const initials = [user_info.firstname, user_info.lastname]
    .filter(Boolean)
    .map((n) => n!.charAt(0).toUpperCase())
    .join("");

  const personal = (
    <CompactSection title={t("personalInfo")}>
      <FieldGrid>
        <SettingField label={t("firstName")} value={user_info.firstname} />
        <SettingField label={t("middleName")} value={user_info.middlename} />
        <SettingField label={t("lastName")} value={user_info.lastname} />
        <SettingField label={t("alias")} value={profile.alias_name} />
      </FieldGrid>
    </CompactSection>
  );

  return (
    // ไม่มี slide-in: เหมือนหน้า profile/setting — แอนิเมชันยาวทำให้หน้าที่เปิดบ่อยรู้สึกช้า
    <div className="animate-in fade-in w-full duration-150">
      {/* หัวหน้า — เลือกแนวตั้ง/แนวนอนจากความกว้างของการ์ดเอง ไม่ใช่ของจอ (sidebar พับ/กางได้) */}
      <div className="@container">
        <div className="bg-card flex flex-col gap-3 rounded-xl border p-4 shadow-sm @md:flex-row @md:items-center @md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              // Force remount when avatar_url flips
              key={profile.avatar_url ?? "fallback"}
              className="size-14 shrink-0"
            >
              {profile.avatar_url && (
                <AvatarImage
                  src={profile.avatar_url}
                  alt={fullName}
                  className="object-cover"
                />
              )}
              <AvatarFallback className="bg-primary/10 text-primary text-base font-semibold">
                {profile.alias_name || initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <h1 className="text-base font-semibold tracking-tight break-words">
                  {fullName}
                </h1>
                {profile.platform_role && (
                  <Badge variant="primary-light" size="sm">
                    {profile.platform_role}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <Mail className="size-3.5 shrink-0" aria-hidden="true" />
                  <span className="break-all">{profile.email}</span>
                </span>
                {user_info.telephone && (
                  <span className="inline-flex items-center gap-1.5">
                    <Phone className="size-3.5 shrink-0" aria-hidden="true" />
                    <span>{user_info.telephone}</span>
                  </span>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            asChild
            className="h-11 w-full shrink-0 @md:h-8 @md:w-auto"
          >
            <Link to="/profile/setting">
              <Settings className="size-3.5" aria-hidden="true" />
              {t("editProfile")}
            </Link>
          </Button>
        </div>
      </div>

      {/* ข้อมูลส่วนตัว | ลายเซ็น — สองหมวดสูงใกล้กัน วางเคียงกันบนจอกว้าง */}
      {profile.signature_url ? (
        <div className={SECTION_PAIR}>
          {personal}
          <CompactSection title={t("signature")}>
            {/* หมึกลายเซ็นเป็นสีเข้มบนพื้นโปร่ง — วางบนพื้นขาวเสมอ ไม่งั้นมองไม่เห็นใน dark mode */}
            <div className="inline-flex max-w-full rounded-md border bg-white p-2">
              <img
                key={profile.signature_url}
                src={profile.signature_url}
                alt={t("signature")}
                className="max-h-20 max-w-full object-contain"
              />
            </div>
          </CompactSection>
        </div>
      ) : (
        personal
      )}

      {/* Business Units — หนึ่ง BU หนึ่งการ์ดเต็มความกว้าง ช่องข้างในแตกคอลัมน์ตามความกว้างการ์ด */}
      <section className="mt-5">
        <div className="mb-2 flex min-h-8 items-center gap-x-2">
          <h2 className="text-sm font-semibold tracking-tight">
            {t("businessUnits")}
          </h2>
          <span className="text-muted-foreground text-xs font-semibold tabular-nums">
            {profile.business_unit.length}
          </span>
        </div>
        {profile.business_unit.length > 0 ? (
          <div className="space-y-3">
            {profile.business_unit.map((bu) => (
              <BUSection key={bu.id} bu={bu} />
            ))}
          </div>
        ) : (
          <div className="bg-card text-muted-foreground flex items-center gap-2 rounded-xl border p-4 text-sm shadow-sm">
            <Building2 className="size-4 shrink-0" aria-hidden="true" />
            {t("noBusinessUnits")}
          </div>
        )}
      </section>
    </div>
  );
}
