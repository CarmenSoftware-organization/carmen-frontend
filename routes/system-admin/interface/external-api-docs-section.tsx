import { endOfMonth, format, startOfMonth } from "date-fns";
import { Download, ExternalLink, Link2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { SettingSection } from "@/components/ui/setting-section";
import { PERMISSIONS } from "@/constant/permissions";
import { useCan } from "@/hooks/use-can";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import { copyToClipboard } from "@/lib/clipboard";
import { baseSpec } from "@/lib/external-api/localized-spec";
import {
  externalApiBaseUrl,
  externalApiRoot,
  useBuApiKey,
} from "./use-bu-api-key";

/** หน้าเอกสารฉบับเต็ม (public — routes/developers/api) */
const DOCS_PATH = "/developers/api";

/** path แรกของ spec (ต้องเป็น `/api/ext/v1/ap-invoices` — ลำดับ path ใน openapi.json กำหนดตัวอย่าง curl) */
const FIRST_PATH = Object.keys(baseSpec().paths)[0];

/**
 * ตัวอย่าง curl — secret เป็นตัวแปร shell เสมอ ห้ามเติมค่าจริง
 *
 * @param root - รากของ host
 * @param clientId - client id ของ BU หรือ null (ยังไม่มีกุญแจ → placeholder)
 * @returns คำสั่ง curl หลายบรรทัด
 */
function curlFor(root: string, clientId: string | null) {
  const now = new Date();
  return [
    `curl -sS -G "${root}${FIRST_PATH}" \\`,
    `  -H "x-client-id: ${clientId ?? "YOUR_CLIENT_ID"}" \\`,
    `  -H "x-client-secret: $CARMEN_CLIENT_SECRET" \\`,
    `  --data-urlencode "date_from=${format(startOfMonth(now), "yyyy-MM-dd")}" \\`,
    `  --data-urlencode "date_to=${format(endOfMonth(now), "yyyy-MM-dd")}" \\`,
    `  --data-urlencode "perpage=50"`,
  ].join("\n");
}

/** ดาวน์โหลด spec ฉบับของ BU นี้ — server เป็นราก host ของ BU (path ใน spec มี `/api/ext/v1` อยู่แล้ว) */
function downloadSpec(root: string) {
  const spec = {
    ...baseSpec(),
    servers: [{ url: root, description: "Carmen Blue" }],
  };
  const blob = new Blob([JSON.stringify(spec, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "carmen-external-api-openapi.json";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * ส่วน "API documentation" ของหน้า Export tools → External — Quick start (curl ที่เติม URL และ
 * Client ID ของ BU ให้) + ดาวน์โหลด openapi.json + ลิงก์ไปเอกสารฉบับเต็มที่หน้า public
 * `/developers/api` (เปิดได้โดยไม่ต้องล็อกอิน ส่งลิงก์ให้ทีม integrator ได้)
 *
 * - เห็นได้เมื่อมีสิทธิ์ `system_admin.bu_api_key.view` และใบ INF ของ External อ่านได้
 *   (กติกาเดียวกับส่วน API Access) — ไม่ต้องมีกุญแจก่อน
 * - ใช้ query กุญแจตัวเดียวกับ API Access (queryKey เดียวกัน ไม่ยิงซ้ำ) และไม่แตะ secret
 *
 * @returns React element ของ section หรือ null เมื่อไม่มีสิทธิ์ดู
 */
export function ExternalApiDocsSection() {
  const t = useTranslations("systemAdmin.interface.export.apiDocs");
  const { can } = useCan();
  const { canReadConfig } = useInterfaceEntitlement();

  const canView = can(PERMISSIONS.system_admin.bu_api_key.view);
  const readable = canReadConfig("export", "external");
  const query = useBuApiKey(canView && readable);

  if (!canView || !readable) return null;

  const root = externalApiRoot(externalApiBaseUrl(query.data));
  const clientId = query.data?.exists ? query.data.client_id : null;
  const curl = curlFor(root, clientId);
  const docsUrl = `${window.location.origin}${DOCS_PATH}`;

  return (
    <div className="mt-8">
      <SettingSection title={t("title")} description={t("desc")} plain first>
        <div className="space-y-5">
          {/* ของที่ส่งให้ทีม integrator อยู่กลุ่มเดียวกัน — outline ทั้งหมด ให้ Edit ที่ header
              เป็นปุ่มหลักปุ่มเดียวของหน้า (ลิงก์เอกสารไม่ใช่การกระทำหลักของหน้าตั้งค่า) */}
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={DOCS_PATH} target="_blank" rel="noopener noreferrer">
                <ExternalLink aria-hidden="true" />
                {t("openFull")}
              </a>
            </Button>
            {/* Button ไม่ใช่ CopyButton — CopyButton เป็นชิปเล็กสีจาง วางคู่ปุ่ม outline แล้วดูเป็นของคนละชุด */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={async () => {
                if (await copyToClipboard(docsUrl))
                  toast.success(t("linkCopied"));
              }}
            >
              <Link2 aria-hidden="true" />
              {t("copyLink")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadSpec(root)}
            >
              <Download aria-hidden="true" />
              {t("download")}
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-medium">{t("quickStart")}</h3>
              <CopyButton
                value={curl}
                label={t("copyCurl")}
                successMessage={t("copied")}
              >
                {t("copyCurl")}
              </CopyButton>
            </div>
            <p className="text-muted-foreground text-xs">
              {clientId ? t("quickStartDesc") : t("quickStartNoKey")}
            </p>
            <pre className="bg-muted overflow-x-auto rounded-md border p-3 text-xs">
              <code>{curl}</code>
            </pre>
          </div>
        </div>
      </SettingSection>
    </div>
  );
}
