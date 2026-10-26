import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { ListPageShell } from "@/components/share/list-page-shell";
import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { usePosStatus } from "@/hooks/use-pos-status";
import { useURL } from "@/hooks/use-url";
import { PosImportHistory } from "./pos-import-history";
import { PosImportLines } from "./pos-import-lines";
import { PosMicros3700UploadButton } from "./pos-micros3700-upload-button";
import { PosSftpLastPull } from "./pos-sftp-last-pull";
import { PosSimphonyUploadButton } from "./pos-simphony-upload-button";

/**
 * หน้า Import POS — ยอดขายดิบจาก POS: อัปโหลด · สถานะ SFTP · ประวัตินำเข้า · บรรทัดของรายการที่เลือก
 * (ไม่มี mapping — อยู่ที่ Sales Consumption)
 *
 * @returns React element ของหน้า
 */
export function ImportPosPage() {
  const tm = useTranslations("modules");
  const t = useTranslations("operationPlan.importPos");
  const { enabledBrands } = usePosStatus();
  const { canWrite } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  const [importId] = useURL("import");

  const writable = (b: "simphony" | "micros3700") =>
    enabledBrands.includes(b) && canWrite && entitlementOf("pos", b) !== "expired";

  return (
    <ListPageShell
      title={tm("importPos")}
      description={t("description")}
      actions={
        <div className="flex items-center gap-2">
          {writable("simphony") && <PosSimphonyUploadButton />}
          {writable("micros3700") && <PosMicros3700UploadButton />}
        </div>
      }
    >
      {enabledBrands.includes("simphony") && (
        <div>
          <PosSftpLastPull enabled />
          <p className="text-muted-foreground mt-2 text-sm">
            <Link
              to="/system-admin/interface/pos/simphony"
              className="text-primary hover:underline"
            >
              {t("connectionSettings")}
            </Link>
          </p>
        </div>
      )}
      <h2 className="mt-6 text-base font-medium">{t("history.title")}</h2>
      <PosImportHistory selectedId={importId || undefined} />
      {importId && <PosImportLines key={importId} importId={importId} />}
    </ListPageShell>
  );
}
