import { Suspense } from "react";
import { Link, useParams } from "react-router";
import { useTranslations } from "use-intl";
import { ArrowLeft, CalendarX } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { findCategory, findBrand } from "./interface-registry";

/**
 * หน้า config ของ interface brand เดียว — resolve `:category/:brand` จาก registry แล้ว render form
 *
 * category/brand ที่ไม่รู้จัก หรือ brand ที่ platform ไม่ได้ให้สิทธิ์ (license) ถือเป็น "ไม่พบ"
 * — ใช้ ErrorState แบบ inline ไม่ใช่ NotFoundComponent เพราะหน้านี้ mount อยู่ใน RootLayout
 * (มี sidebar+navbar อยู่แล้ว) ส่วน NotFoundComponent เป็น full-page ไว้ใช้กับ top-level catch-all
 * เท่านั้น — เอามาซ้อนในนี้จะได้ chrome ซ้อน chrome (ตาม department/role edit)
 *
 * form อ่าน brand จาก `useParams` เอง — หน้านี้แค่ตรวจ resolve/entitlement ก่อน mount
 *
 * @returns React element ของหน้า interface detail
 */
export function Component() {
  const t = useTranslations("systemAdmin.interface");
  const { category, brand } = useParams<{ category: string; brand: string }>();
  const { entitlementOf, canReadConfig } = useInterfaceEntitlement();

  const categoryDef = findCategory(category);
  const brandDef = findBrand(category, brand);
  const entitlement =
    categoryDef && brandDef
      ? entitlementOf(categoryDef.key, brandDef.key)
      : "none";

  if (!categoryDef || !brandDef || entitlement === "none") {
    return (
      <ErrorState message={t("notFound")} backTo="/system-admin/interface" />
    );
  }

  // คีย์อยู่แค่ใน `expired_features` — backend ตอบ 403 ให้ GET จึงห้าม mount ฟอร์ม
  // (ฟอร์มยิง GET เองทันที) แสดงคำอธิบายแทน
  const readable = canReadConfig(categoryDef.key, brandDef.key);

  const Form = brandDef.form ?? categoryDef.form;
  return (
    <>
      {/* อ่านไม่ได้ = ไม่มีอะไรให้ "อ่านอย่างเดียว" — Empty ด้านล่างอธิบายแทน */}
      {entitlement === "expired" && readable && (
        // จงใจไม่ใช้ `LicenseExpiredBanner` ตรง ๆ — ตัวนั้น `return null` เมื่อสวิตช์
        // `LICENSE_ENFORCEMENT` ปิด แต่การล็อก interface ไม่ขึ้นกับสวิตช์นั้น
        // คำอธิบายต้องมองเห็นได้ทุกที่ที่การล็อกมองเห็นได้
        <div
          role="alert"
          className="bg-muted flex items-center justify-center gap-2 border-b px-4 py-2 text-xs"
        >
          <CalendarX className="text-destructive size-4 shrink-0" aria-hidden />
          <span className="text-muted-foreground">{t("expiredNotice")}</span>
        </div>
      )}
      {readable ? (
        <Suspense fallback={<FormPageSkeleton />}>
          <Form />
        </Suspense>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <CalendarX />
            </EmptyMedia>
            <EmptyTitle>
              {t(`${categoryDef.key}.brand.${brandDef.key}`)}
            </EmptyTitle>
            <EmptyDescription>{t("expiredUnreadable")}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button variant="outline" size="sm" asChild>
              <Link to="/system-admin/interface">
                <ArrowLeft /> {t("title")}
              </Link>
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </>
  );
}
