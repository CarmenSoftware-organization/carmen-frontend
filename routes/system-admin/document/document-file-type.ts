import {
  FileSpreadsheet,
  FileText,
  FileImage,
  File,
  FileArchive,
  FileCode,
} from "lucide-react";

/**
 * ไอคอน · ป้ายชนิด (key ใต้ systemAdmin.document) · สีไอคอน ของไฟล์ตาม MIME
 * ใช้ร่วมกันทั้งตาราง มุมมอง icon และ preview
 */
export const getFileTypeInfo = (contentType: string) => {
  if (
    contentType.includes("spreadsheet") ||
    contentType.includes("excel") ||
    contentType.includes("csv")
  )
    return {
      icon: FileSpreadsheet,
      labelKey: "xls" as const,
      className: "text-green-600",
    };
  if (contentType.includes("pdf"))
    return {
      icon: FileText,
      labelKey: "pdf" as const,
      className: "text-red-500",
    };
  if (contentType.includes("image"))
    return {
      icon: FileImage,
      labelKey: "image" as const,
      className: "text-blue-500",
    };
  if (
    contentType.includes("zip") ||
    contentType.includes("rar") ||
    contentType.includes("compressed")
  )
    return {
      icon: FileArchive,
      labelKey: "archive" as const,
      className: "text-amber-500",
    };
  if (contentType.includes("text/plain"))
    return {
      icon: FileText,
      labelKey: "txt" as const,
      className: "text-gray-500",
    };
  if (contentType.includes("word") || contentType.includes("document"))
    return {
      icon: FileText,
      labelKey: "doc" as const,
      className: "text-blue-600",
    };
  if (
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("html")
  )
    return {
      icon: FileCode,
      labelKey: "code" as const,
      className: "text-purple-500",
    };
  return {
    icon: File,
    labelKey: "file" as const,
    className: "text-muted-foreground",
  };
};

export type DocumentPreviewKind = "image" | "pdf" | "text" | "none";

/**
 * ชนิดที่เบราว์เซอร์แสดงในหน้าได้เอง — ที่เหลือ (docx/xlsx/zip) ให้ดาวน์โหลดอย่างเดียว
 * text ครอบ csv ด้วย เพราะ getFileTypeInfo จัด csv เป็น xls แต่เนื้อหาเป็นข้อความล้วน
 */
export function getPreviewKind(contentType: string): DocumentPreviewKind {
  // เทียบ MIME หลักแบบตรงตัว (ตัด ;charset ทิ้ง) — includes("pdf") ปล่อยชนิดแปลก ๆ ผ่านได้
  const base = contentType.split(";")[0].trim().toLowerCase();
  if (base.startsWith("image/")) return "image";
  if (base === "application/pdf") return "pdf";
  if (
    base.startsWith("text/") ||
    base === "application/csv" ||
    base === "application/json"
  )
    return "text";
  return "none";
}
