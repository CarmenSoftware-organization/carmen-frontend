import { Link2Off } from "lucide-react";
import { useTranslations } from "use-intl";
import { LocaleToggle } from "@/components/locale-toggle";

/**
 * หน้า "ลิงก์หมดอายุ" ของ RFQ portal — แสดงเมื่อ token ใช้ไม่ได้ (401)
 *
 * ผู้เห็นหน้านี้คือ vendor (หรือทีมโรงแรม/support) ที่คลิกลิงก์มา ไม่ใช่ dev — จึง
 * ไม่พูดถึง "token"/รหัสใด ๆ เลย ใช้ภาษาคนเข้าใจง่าย + บอกทางออก (ติดต่อโรงแรม
 * ที่ส่งลิงก์มา) ดีไซน์ตาม DESIGN.md: centered เงียบ ๆ, ไอคอน muted ในวงกลม
 * neutral (สัญญาณสีเดียว ไม่ใช่ alarm แดง), ไม่มีเงา, whitespace เยอะ
 */
export default function PriceListExternalExpired() {
  const t = useTranslations("priceListPortal");
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col items-center justify-center px-6 text-center">
      <LocaleToggle className="mb-8" />
      <div className="bg-muted mb-6 flex size-14 items-center justify-center rounded-full">
        <Link2Off className="text-muted-foreground size-6" aria-hidden="true" />
      </div>
      <h1 className="text-foreground text-xl font-semibold tracking-tight">
        {t("expiredTitle")}
      </h1>
      <p className="text-muted-foreground mt-2.5 text-sm leading-relaxed">
        {t("expiredBody")}
      </p>
    </div>
  );
}
