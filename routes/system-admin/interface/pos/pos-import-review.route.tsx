import { useParams } from "react-router";
import { useTranslations } from "use-intl";
import { ErrorState } from "@/components/ui/error-state";
import { FormPageSkeleton } from "@/components/loader/form-page-skeleton";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { PosImportReview } from "./pos-import-review";
import type { PosBrand } from "./pos-sale-types";

const POS_BRANDS: readonly PosBrand[] = ["simphony", "micros3700"];

/** id ของการนำเข้าเป็น UUID — ค่าอื่นจาก URL ไม่ถูกส่งต่อเข้า path ของ API */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPosBrand(v: string | undefined): v is PosBrand {
  return POS_BRANDS.some((b) => b === v);
}

/**
 * หน้าตรวจและยืนยันตัดสต็อกของการนำเข้ายอดขาย POS หนึ่งรายการ
 * (`/system-admin/interface/pos/:brand/imports/:importId`)
 *
 * แบรนด์ที่ไม่รู้จัก หรือแบรนด์ที่ BU ไม่ได้สิทธิ์ (license) ถือเป็น "ไม่พบ" — ErrorState
 * แบบ inline เหมือน `interface-detail.route.tsx` · สิทธิ์หมดอายุ = ดูได้แต่ยืนยันไม่ได้
 *
 * @returns React element ของหน้าตรวจการนำเข้า
 */
export function Component() {
  const t = useTranslations("systemAdmin.interface");
  const { brand, importId } = useParams<{ brand: string; importId: string }>();
  const { entitlementOf, isLoading } = useInterfaceEntitlement();

  if (isLoading) return <FormPageSkeleton />;

  const entitlement = isPosBrand(brand) ? entitlementOf("pos", brand) : "none";
  if (
    !isPosBrand(brand) ||
    !importId ||
    !UUID_RE.test(importId) ||
    entitlement === "none"
  ) {
    return (
      <ErrorState message={t("notFound")} backTo="/system-admin/interface" />
    );
  }

  return (
    <PosImportReview
      brand={brand}
      importId={importId}
      expired={entitlement === "expired"}
    />
  );
}
