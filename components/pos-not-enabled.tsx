import { Link } from "react-router";
import { PlugZap } from "lucide-react";
import { useTranslations } from "use-intl";

import { Button } from "@/components/ui/button";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";

/**
 * หน้าแทนที่เมื่อเข้า URL ของหน้าที่ต้องมี POS interface แต่ BU ยังไม่เปิด
 *
 * อยู่ใน `components/` (ไม่ใช่ `routes/operation-plan/shared/`) เพราะ `RouteGuard`
 * ซึ่งอยู่ shared layer เป็นคน render — shared layer import จาก `routes/` ไม่ได้
 * ลิงก์ไปหน้า Interface แสดงเฉพาะผู้ที่อ่าน config POS ได้
 */
export function PosNotEnabled() {
  const t = useTranslations("posNotEnabled");
  const { canReadConfig } = useInterfaceEntitlement();
  const canOpenInterface =
    canReadConfig("pos", "simphony") || canReadConfig("pos", "micros3700");

  return (
    <div
      role="alert"
      className="flex flex-1 items-center justify-center px-6 py-16"
    >
      <div className="bg-card flex w-full max-w-sm flex-col items-center rounded-xl border p-6 text-center">
        <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-xl">
          <PlugZap className="size-5" aria-hidden />
        </div>
        <h2 className="text-foreground text-base font-semibold tracking-tight">
          {t("title")}
        </h2>
        <p className="text-muted-foreground mt-2 text-xs leading-relaxed">
          {t("description")}
        </p>
        {canOpenInterface && (
          <Button asChild size="sm" className="mt-5">
            <Link to="/system-admin/interface">{t("openInterface")}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
