import { useBusinessUnit } from "@/hooks/use-business-unit";
import { useProfile } from "@/hooks/use-profile";
import { resolvePriceRates, type PriceRates } from "@/lib/bu-price-rates";

/** % ค่าบริการ / VAT ของ BU ที่ใช้งานอยู่ (หน้า Default Setting) — ใช้บวกราคา net ของสูตรเป็น gross */
export function useRecipePriceRates(): PriceRates {
  const { defaultBu } = useProfile();
  const { data: businessUnit } = useBusinessUnit(defaultBu?.id);
  return resolvePriceRates(businessUnit?.config);
}
