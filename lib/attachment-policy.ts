/**
 * นโยบายไฟล์แนบ comment ของ BU — ค่าจริงมาจาก `GET api/:bu_code/attachment-policy` (ตั้งจาก carmen-backstage)
 * ค่าเริ่มต้นต้องเท่ากับของ backend (`attachment-policy.ts` ใน backend-gateway): ใช้ระหว่างโหลด / ดึงไม่สำเร็จ
 * backend เป็นด่านจริง — ฝั่งนี้แค่ช่วยให้ผู้ใช้รู้ก่อนอัปโหลด
 */
export interface AttachmentPolicy {
  allowed_types: string[];
  max_size_mb: number;
  mime_types: string[];
  extensions: string[];
}

export const DEFAULT_ATTACHMENT_POLICY: AttachmentPolicy = {
  allowed_types: ["image", "pdf"],
  max_size_mb: 10,
  mime_types: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "application/pdf",
  ],
  extensions: [".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"],
};

/** MIME ที่ไม่บอกอะไร — กรณีนี้เท่านั้นที่ถอยไปดูนามสกุล (กติกาเดียวกับ backend) */
const NEUTRAL_MIME = new Set(["", "application/octet-stream"]);

export function isFileAllowed(file: File, policy: AttachmentPolicy): boolean {
  const mime = file.type.toLowerCase().trim();
  if (!NEUTRAL_MIME.has(mime)) return policy.mime_types.includes(mime);
  const dot = file.name.lastIndexOf(".");
  const ext = dot >= 0 ? file.name.slice(dot).toLowerCase() : "";
  return ext !== "" && policy.extensions.includes(ext);
}

/** ค่า `accept` ของ file picker — ใส่ทั้ง MIME และนามสกุล เพราะบาง OS กรองด้วยนามสกุลเท่านั้น */
export const acceptFor = (policy: AttachmentPolicy) =>
  [...policy.mime_types, ...policy.extensions].join(",");

export const maxBytesOf = (policy: AttachmentPolicy) =>
  policy.max_size_mb * 1024 * 1024;

/** รายการนามสกุลสำหรับข้อความเตือน เช่น "JPG, PNG, PDF, XLSX" */
export const typesLabel = (policy: AttachmentPolicy) =>
  [...new Set(policy.extensions.map((e) => e.replace(".", "").toUpperCase()))]
    .filter((e) => e !== "JPEG")
    .join(", ");
