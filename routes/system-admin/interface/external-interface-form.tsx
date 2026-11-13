import { Zap } from "lucide-react";
import { useTranslations } from "use-intl";
import { SECTION_PAIR } from "@/components/share/compact-section";
import { FormPageShell } from "@/components/share/form-page-shell";
import { FormToolbar } from "@/components/share/form-toolbar";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { ExternalApiAccessSection } from "./external-api-access-section";
import { ExternalApiDocsSection } from "./external-api-docs-section";

/**
 * แถบบอกโซน "มีผลทันที" — ส่วน API ด้านล่างบันทึกทันทีที่ทำรายการ ไม่มีปุ่มบันทึกแยก
 * แต่หมวดหน้าตาเดียวกับฟอร์มของแบรนด์อื่น ไม่มีแถบนี้ผู้ใช้จะรอปุ่มบันทึกหลังสลับสถานะ key
 */
function LiveZoneDivider({
  title,
  hint,
}: {
  readonly title: string;
  readonly hint: string;
}) {
  // แถบเต็มความกว้าง ไม่ใช่หัวข้อหมวด — หน้าตาแบบหัวข้อจะอ่านเป็น section ที่ไม่มีการ์ด
  return (
    <div className="bg-muted/40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-dashed px-4 py-2.5">
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
  const { canReadConfig } = useInterfaceEntitlement();
  const showApiZone = can(PERMISSIONS.system_admin.bu_api_key.view);
  // เอกสาร API แสดงเฉพาะเมื่อใบ INF อ่านได้ — หมวดเหลืออันเดียวต้องไม่อยู่ในกริดคู่
  // ไม่งั้นบนจอกว้างมันกว้างแค่ครึ่งจอ อีกครึ่งว่าง
  const paired = showApiZone && canReadConfig("export", "external");

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
      {/* API Access | เอกสาร API — วางเคียงกันบนจอกว้าง (1700px ขึ้นไป) */}
      <div className={paired ? SECTION_PAIR : undefined}>
        <ExternalApiAccessSection />
        <ExternalApiDocsSection />
      </div>
    </FormPageShell>
  );
}
