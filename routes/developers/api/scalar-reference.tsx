import { useMemo } from "react";
import { ApiReferenceReact } from "@scalar/api-reference-react";
import "@scalar/api-reference-react/style.css";
import { localizedSpec } from "@/lib/external-api/localized-spec";
import { SCALAR_TH } from "@/lib/external-api/scalar-th";

/** stack ที่ลูกค้าใช้จริง — ที่เหลือทุก target ของ Scalar ซ่อน */
const SHOWN_TARGETS = ["shell", "node", "python", "php", "csharp"];
const ALL_TARGETS = [
  "c",
  "clojure",
  "csharp",
  "dart",
  "fsharp",
  "go",
  "http",
  "java",
  "js",
  "julia",
  "kotlin",
  "node",
  "objc",
  "ocaml",
  "php",
  "powershell",
  "python",
  "r",
  "ruby",
  "rust",
  "shell",
  "swift",
];
const HIDDEN_CLIENTS = Object.fromEntries(
  ALL_TARGETS.filter((t) => !SHOWN_TARGETS.includes(t)).map((t) => [t, true]),
);

/**
 * ซ่อนปุ่ม/ป้ายของ Scalar ที่ปิดด้วย option ไม่ได้ และใช้ฟอนต์ของแอป
 * selector อิง DOM ของเวอร์ชันที่ pin ไว้ (0.9.81) — อัปเกรดแล้วต้องเปิดหน้าดูอีกครั้ง
 */
const CUSTOM_CSS = `
.scalar-app, .scalar-api-reference {
  --scalar-font: var(--font-sans);
  --scalar-font-code: var(--font-mono);
  /* header ของเรา (h-12) ติดบนสุด — เมนูซ้ายของ Scalar ต้อง sticky ใต้มัน */
  --refs-header-height: 3rem;
}
/* ปุ่ม "Generate SDK" (ขายบริการ) — ทั้งในการ์ดบทนำและท้ายการ์ดโค้ดของทุก endpoint */
.generate-sdk-button,
.selected-client-action,
/* ท้ายเมนูซ้าย: "Powered by Scalar" + ปุ่มธีมของ Scalar (เราใช้ปุ่มธีมของแอป) */
.darklight-reference {
  display: none !important;
}
/*
 * Scalar ปิดค่า credential ในตัวอย่างโค้ดเป็น ····· (สีโปร่ง + ::after) — ค่าที่เราใส่เป็น
 * placeholder (YOUR_CLIENT_ID / YOUR_CLIENT_SECRET) ไม่ใช่ secret ผู้อ่านต้องเห็นว่าต้องแทนอะไร
 */
.credential .credential-value {
  color: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
}
.credential::after {
  content: none !important;
}
`;

/**
 * Scalar API reference ของ API ขาเข้า — ไฟล์เดียวที่ import Scalar (ถูกโหลดผ่าน lazy เท่านั้น)
 *
 * option ที่ห้ามหาย: `telemetry: false` (ค่าเริ่มต้นของ Scalar เป็น true → ส่งข้อมูลผู้เข้าชม
 * ออกไปเงียบ ๆ CSP `connect-src https:` ไม่บล็อก), `withDefaultFonts: false` (CSP font-src)
 * และ agent / mcp / developer tools / Try it ปิดทั้งหมด
 *
 * @param props.locale - locale ของแอป — เปลี่ยนแล้ว remount (เปลี่ยนแค่ content ภาษา UI ไม่ตาม)
 * @param props.dark - ธีมที่ resolve แล้ว — เปลี่ยนแล้ว remount เช่นกัน เพราะ Scalar อ่าน
 *   `forceDarkModeState` ครั้งเดียวตอน setup (ไม่ reactive) ส่งค่าใหม่เข้าไปเฉย ๆ เอกสารไม่เปลี่ยนธีม
 * @returns React element ของเอกสาร
 */
export default function ScalarReference({
  locale,
  dark,
}: {
  readonly locale: string;
  readonly dark: boolean;
}) {
  const content = useMemo(() => localizedSpec(locale), [locale]);
  return (
    <ApiReferenceReact
      key={`${locale}-${dark ? "dark" : "light"}`}
      configuration={{
        content,
        layout: "modern",
        telemetry: false,
        withDefaultFonts: false,
        hideTestRequestButton: true,
        hideClientButton: true,
        hideDarkModeToggle: true,
        forceDarkModeState: dark ? "dark" : "light",
        showDeveloperTools: "never",
        agent: { disabled: true },
        mcp: { disabled: true },
        documentDownloadType: "none",
        hiddenClients: HIDDEN_CLIENTS,
        defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
        authentication: {
          securitySchemes: {
            "x-client-id": { value: "YOUR_CLIENT_ID" },
            "x-client-secret": { value: "YOUR_CLIENT_SECRET" },
          },
        },
        localization:
          locale === "th"
            ? { locale: "th", translations: SCALAR_TH }
            : undefined,
        customCss: CUSTOM_CSS,
      }}
    />
  );
}
