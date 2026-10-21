import DOMPurify from "dompurify";
import {
  EMAIL_DOC_TYPES,
  type EmailDocType,
  type EmailTemplate,
  type EmailTemplatesValue,
} from "@/types/email-template";

/**
 * Placeholder ที่ใช้ได้จริงต่อชนิดเอกสาร — เป็นทั้งรายการที่หน้าตั้งค่าเอาไปทำปุ่ม
 * "แทรกตัวแปร" และเป็นสัญญาว่า dialog ส่งอีเมลของเอกสารนั้นต้องส่งค่าครบทุกตัว
 * (ตัวที่ไม่มีค่าจะถูกแทนด้วยสตริงว่าง ไม่ใช่ปล่อย `{{...}}` ค้างไปถึงผู้รับ)
 */
export const EMAIL_PLACEHOLDERS: Record<EmailDocType, readonly string[]> = {
  po: ["po_no", "vendor_name", "bu_name", "total", "delivery_date"],
  rfp: [
    "rfp_name",
    "vendor_name",
    "contact_person",
    "bu_name",
    "start_date",
    "end_date",
    "portal_url",
  ],
};

/**
 * ค่าตัวอย่างสำหรับพรีวิวในหน้าตั้งค่า — ไม่เคยถูกส่งออกไปจริง มีไว้ให้เห็นว่า
 * template ที่เขียนไว้หน้าตาเป็นอย่างไรเมื่อเติมค่าแล้ว
 */
export const EMAIL_PLACEHOLDER_SAMPLES: Record<
  EmailDocType,
  Record<string, string>
> = {
  po: {
    po_no: "PO-2026-000123",
    vendor_name: "Siam Fresh Supply Co., Ltd.",
    bu_name: "Riverside Hotel Bangkok",
    total: "125,400.00 THB",
    delivery_date: "31/12/2026",
  },
  rfp: {
    rfp_name: "Dry goods Q1/2027",
    vendor_name: "Siam Fresh Supply Co., Ltd.",
    contact_person: "Somchai P.",
    bu_name: "Riverside Hotel Bangkok",
    start_date: "01/01/2027",
    end_date: "15/01/2027",
    portal_url: "https://carmen.example.com/pl/sample-token",
  },
};

/**
 * เติมค่าลง placeholder `{{key}}`
 *
 * `mode: "html"` จะ escape ค่าที่เติมลงไปก่อนเสมอ — ชื่อผู้ขายที่มี `&` หรือ `<`
 * ต้องไม่กลายเป็น markup ในเนื้อเมล ส่วนหัวเรื่องเป็นข้อความล้วนจึงใช้ `"text"`
 *
 * placeholder ของเอกสารชนิดนั้นที่ผู้เรียกไม่ได้ส่งค่ามา จะถูกแทนด้วยสตริงว่าง
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
  mode: "text" | "html",
  docType?: EmailDocType,
): string {
  const keys = new Set([
    ...Object.keys(values),
    ...(docType ? EMAIL_PLACEHOLDERS[docType] : []),
  ]);
  let out = template;
  for (const key of keys) {
    const raw = values[key] ?? "";
    out = out.replaceAll(`{{${key}}}`, mode === "html" ? escapeHtml(raw) : raw);
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "div",
  "span",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "blockquote",
  "code",
  "pre",
  "a",
];

/**
 * ล้าง HTML ของเนื้อเมลให้เหลือเฉพาะ tag ที่ mail client ทั่วไปแสดงได้
 *
 * เรียกทั้งตอนโหลดค่าเข้า editor และก่อนบันทึก/ก่อนส่ง — ฝั่ง backend ล้างซ้ำอีกชั้น
 * เพราะ client ไม่ใช่ขอบเขตความเชื่อถือ (ยิง API ตรงได้)
 */
export function sanitizeEmailHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR: ["href", "target", "rel", "title"],
    ALLOWED_URI_REGEXP: /^(?:https?|mailto):/i,
  });
}

/**
 * ข้อความล้วนที่อ่านได้จาก HTML — ใช้ตรวจว่าเนื้อเมล "ว่างจริง" ไหม
 * (`<p></p>` ที่ editor ทิ้งไว้ไม่ใช่เนื้อความ แต่ `body.trim()` มองว่ามี)
 */
export function htmlToPlainText(html: string): string {
  const doc = new DOMParser().parseFromString(
    html.replaceAll(/<br\s*\/?>/gi, "\n").replaceAll(/<\/p>/gi, "</p>\n"),
    "text/html",
  );
  return (doc.body.textContent ?? "").replaceAll(/\n{3,}/g, "\n\n").trim();
}

/**
 * แปลงข้อความล้วนเป็น HTML ย่อหน้าละบรรทัด
 *
 * ใช้ตอนยกข้อความจาก `email_profiles` (ซึ่งเป็นข้อความล้วนมาแต่เดิม) มาใส่ editor —
 * ถ้าโยนดิบ ๆ ลงไป การขึ้นบรรทัดใหม่ทั้งหมดจะหายเพราะ HTML ยุบ whitespace
 */
export function plainTextToHtml(text: string): string {
  if (!text.trim()) return "";
  // ข้อความที่มี tag อยู่แล้วคือ HTML ที่เคยบันทึกไว้ ไม่ใช่ข้อความล้วน — อย่าแปลงซ้ำ
  if (/<[a-z][\s\S]*>/i.test(text)) return sanitizeEmailHtml(text);
  return text
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p>${para
          .split("\n")
          .map((line) =>
            line
              .replaceAll("&", "&amp;")
              .replaceAll("<", "&lt;")
              .replaceAll(">", "&gt;"),
          )
          .join("<br />")}</p>`,
    )
    .join("");
}

const EMPTY_VALUE: EmailTemplatesValue = { defaults: {}, templates: [] };

/**
 * อ่านค่าที่ backend เก็บไว้แบบ passthrough (app-config ไม่ validate คีย์ที่ไม่รู้จัก)
 *
 * ข้อมูลเสียรูปต้องไม่ทำให้หน้าพังทั้งหน้า — แถวที่ไม่เข้ารูปถูกทิ้งเงียบ ๆ
 * ส่วนค่าที่ไม่ใช่ object เลยจะกลายเป็นค่าว่าง (= ยังไม่เคยตั้งค่า)
 */
export function parseEmailTemplatesValue(raw: unknown): EmailTemplatesValue {
  if (!raw || typeof raw !== "object") return EMPTY_VALUE;
  const obj = raw as Record<string, unknown>;
  const rawTemplates = Array.isArray(obj.templates) ? obj.templates : [];
  const templates = rawTemplates.filter(isEmailTemplate);

  const rawDefaults =
    obj.defaults && typeof obj.defaults === "object"
      ? (obj.defaults as Record<string, unknown>)
      : {};
  const defaults: EmailTemplatesValue["defaults"] = {};
  for (const docType of EMAIL_DOC_TYPES) {
    const id = rawDefaults[docType];
    defaults[docType] = typeof id === "string" ? id : null;
  }

  return { defaults, templates };
}

function isEmailTemplate(v: unknown): v is EmailTemplate {
  if (!v || typeof v !== "object") return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.id === "string" &&
    typeof t.name === "string" &&
    EMAIL_DOC_TYPES.includes(t.doc_type as EmailDocType) &&
    typeof t.subject_template === "string" &&
    typeof t.body_template === "string"
  );
}

/**
 * template ที่ใช้ได้ของเอกสารชนิดหนึ่ง เรียงให้ตัวที่ตั้งเป็นค่าเริ่มต้นมาก่อน
 */
export function templatesForDocType(
  value: EmailTemplatesValue,
  docType: EmailDocType,
): EmailTemplate[] {
  const defaultId = value.defaults[docType];
  return value.templates
    .filter((t) => t.doc_type === docType && t.enabled !== false)
    .sort((a, b) => {
      if (a.id === defaultId) return -1;
      if (b.id === defaultId) return 1;
      return a.name.localeCompare(b.name);
    });
}
