import { useEffect, useMemo, useRef } from "react";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { Download } from "lucide-react";
import SwaggerUI from "swagger-ui-dist/swagger-ui-es-bundle.js";
import "swagger-ui-dist/swagger-ui.css";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import "./external-api-docs.css";
// สำเนาของ BE `docs/external-api/openapi.json` (carmen-turborepo-backend-v2) —
// อัปเดต: รัน `bun run swagger:export-external` ที่ BE แล้ว copy ไฟล์นั้นมาทับไฟล์นี้
// import ตรงนี้ (ไม่ใช่ public/) เพื่อให้เข้า chunk lazy นี้ chunk เดียว และ version ตาม build
import openapi from "./external-api-openapi.json";

/**
 * ประโยคใน spec ที่ชวนกด Authorize แล้วลองยิง — หน้านี้ปิด Try it out และซ่อน Authorize
 * (ไม่ให้วาง secret ในเบราว์เซอร์) จึงตัดทิ้งตอนแสดง ถ้า BE เปลี่ยนถ้อยคำ = ไม่ตัด ไม่พัง
 */
const AUTHORIZE_HINT =
  "In this page, click **Authorize** and fill in both values to try the endpoint.";

/** path แรกของ spec (ต้องเป็น `/api/ext/v1/ap-invoices` — ลำดับ path ใน openapi.json กำหนดตัวอย่าง curl) — ใช้ประกอบตัวอย่าง curl */
const FIRST_PATH = Object.keys(openapi.paths)[0];

/**
 * spec ฉบับของ BU นี้ — server เป็นราก host ของ BU (path ใน spec มี `/api/ext/v1` อยู่แล้ว)
 *
 * @param root - รากจาก `externalApiRoot`
 * @returns spec ที่เปลี่ยน `servers` และตัดประโยค Authorize ออก
 */
function specFor(root: string) {
  return {
    ...openapi,
    info: {
      ...openapi.info,
      description: openapi.info.description.replace(AUTHORIZE_HINT, ""),
    },
    servers: [{ url: root, description: "Carmen" }],
  };
}

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

/**
 * เนื้อหาเอกสาร API ขาเข้า — quick start (curl) + ปุ่มดาวน์โหลด openapi.json + Swagger UI
 *
 * ไฟล์นี้ถูก import แบบ lazy จาก `external-api-docs-section.tsx` เท่านั้น เพราะลาก Swagger UI
 * (React 18 ของมันเองทั้งก้อน) + CSS ของมันมาด้วย — CSS ของ swagger-ui ทุก selector อยู่ใต้
 * `.swagger-ui` จึงไม่รั่วไปหน้าอื่น
 *
 * Swagger UI ปิด Try it out (`supportedSubmitMethods: []`) — ไม่ให้ส่ง secret จากเบราว์เซอร์
 * (และ CORS ของ BE ก็ไม่เปิดให้ `/api/ext` อยู่แล้ว)
 *
 * @param props.root - รากของ host ของ BU (ไม่มี `/api/ext/v1`)
 * @param props.clientId - client id ของกุญแจ หรือ null เมื่อยังไม่มี
 * @returns React element ของเอกสาร
 */
export default function ExternalApiDocs({
  root,
  clientId,
}: {
  readonly root: string;
  readonly clientId: string | null;
}) {
  const t = useTranslations(
    "systemAdmin.interface.accounting.external.apiDocs",
  );
  const hostRef = useRef<HTMLDivElement>(null);
  const spec = useMemo(() => specFor(root), [root]);
  const curl = curlFor(root, clientId);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Swagger UI สร้าง React root ของตัวเองและไม่มี API unmount — ให้มันอยู่ใน node ลูกที่เรา
    // สร้างเอง แล้วถอด node ทิ้งตอน cleanup (StrictMode mount สองรอบก็ไม่ซ้อนกัน)
    const node = document.createElement("div");
    host.appendChild(node);
    SwaggerUI({
      domNode: node,
      spec,
      supportedSubmitMethods: [],
      tryItOutEnabled: false,
      validatorUrl: null,
      deepLinking: false,
      docExpansion: "list",
      defaultModelsExpandDepth: 0,
      defaultModelExpandDepth: 2,
    });
    return () => node.remove();
  }, [spec]);

  const download = () => {
    const blob = new Blob([JSON.stringify(spec, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "carmen-external-api-openapi.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-medium">{t("quickStart")}</h3>
          <div className="flex items-center gap-2">
            <CopyButton
              value={curl}
              label={t("copyCurl")}
              successMessage={t("copied")}
            >
              {t("copyCurl")}
            </CopyButton>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={download}
            >
              <Download aria-hidden="true" />
              {t("download")}
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {clientId ? t("quickStartDesc") : t("quickStartNoKey")}
        </p>
        <pre className="bg-muted overflow-x-auto rounded-md border p-3 text-xs">
          <code>{curl}</code>
        </pre>
      </div>

      <div ref={hostRef} className="external-api-docs" />
    </div>
  );
}
