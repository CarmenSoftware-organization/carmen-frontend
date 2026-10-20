import { Zap } from "lucide-react";
import { useTranslations } from "use-intl";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { ExternalApiAccessSection } from "./external-api-access-section";
import { ExternalApiDocsSection } from "./external-api-docs-section";

/**
 * เส้นแบ่งโซน "มีผลทันที" — ส่วน API ด้านล่างบันทึกทันทีที่ทำรายการ ไม่มีปุ่มบันทึกแยก
 * แต่ใช้ SettingSection หน้าตาเดียวกัน ไม่มีเส้นนี้ผู้ใช้จะรอปุ่มบันทึกหลังสลับสถานะ key
 */
function LiveZoneDivider({
  title,
  hint,
}: {
  readonly title: string;
  readonly hint: string;
}) {
  // แถบเต็มความกว้าง ไม่ใช่ grid ของ SettingSection — แบบเดิม (หัวซ้าย + เส้นขวา) อ่านเป็น
  // section ที่ไม่มีการ์ด ไม่ใช่เส้นแบ่งโซน
  return (
    <div className="bg-muted/40 mt-12 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed px-4 py-2.5">
      <Zap aria-hidden="true" className="text-primary size-4 shrink-0" />
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-muted-foreground text-xs">{hint}</p>
    </div>
  );
}

/**
 * หน้าของ brand `external` ในหมวด Export tools — เหลือแค่โซน API ขาเข้า (API Access + เอกสาร API)
 * ซึ่งทำงานทันทีด้วยตัวเอง ไม่มีฟอร์มให้แก้/บันทึก จึงไม่ผ่าน `InterfacePageLayout`
 * และไม่เขียน `interface_export_external` อีก — บัญชีที่ export ใช้มาจากผังการผูกบัญชี (COA mapping)
 * ส่วนบัญชีตั้งต้นของ `gl_setting` อยู่ที่หน้าตั้งค่า Accounting
 *
 * @returns React element ของหน้า external interface
 */
export default function ExternalInterfaceForm() {
  const te = useTranslations("systemAdmin.interface.export");
  const { can } = useCan();
  const showApiZone = can(PERMISSIONS.system_admin.bu_api_key.view);

  return (
    <FormPageShell
      width="wide"
      header={
        <FormToolbar
          mode="view"
          formId="interface-config-form"
          isPending={false}
          title={te("brand.external")}
          subtitle={te("desc")}
          onCancel={() => undefined}
        />
      }
    >
      {showApiZone && (
        <LiveZoneDivider title={te("liveZone")} hint={te("liveZoneHint")} />
      )}
      <ExternalApiAccessSection />
      <ExternalApiDocsSection />
    </FormPageShell>
  );
}
