import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import type { DocumentFile } from "@/types/document";
import { documentReferenceLabel } from "./document-reference-labels";
import { documentReferenceHref } from "./document-reference-link";

interface DocumentReferenceProps {
  readonly doc: DocumentFile;
  readonly className?: string;
}

/**
 * "แนบมาจาก" ของไฟล์ — ชื่อโมดูล · เลขเอกสาร เป็นลิงก์ไปเอกสารต้นทางเมื่อสร้างลิงก์ได้
 * ใช้ทั้งในตาราง และแผงรายละเอียดของมุมมอง preview
 */
export function DocumentReference({ doc, className }: DocumentReferenceProps) {
  const t = useTranslations("systemAdmin.document");
  const tm = useTranslations("modules");
  const type = doc.reference_type ?? null;
  const base = cn("block max-w-64 truncate text-xs", className);

  // ตรวจ reference_type ก่อน: reference_exists เป็น null ทั้งตอนไม่มีที่มาและตอน lookup ล้มเหลว
  if (type == null) {
    return <span className={base}>{t("summary.directUpload")}</span>;
  }
  if (doc.reference_exists === false) {
    return (
      <span className={cn(base, "text-muted-foreground")}>
        {t("referenceDeleted")}
      </span>
    );
  }
  const moduleLabel = documentReferenceLabel(
    type,
    tm,
    t("summary.directUpload"),
  );
  const text = doc.reference_no
    ? `${moduleLabel} · ${doc.reference_no}`
    : moduleLabel;
  const href = documentReferenceHref(
    type,
    doc.reference_parent_id ?? null,
    doc.reference_id ?? null,
  );
  if (href) {
    return (
      <Link
        to={href}
        className={cn(
          base,
          "text-primary font-medium underline-offset-2 hover:underline",
        )}
        title={text}
      >
        {text}
      </Link>
    );
  }
  if (!doc.reference_id) {
    return (
      <span className={cn(base, "text-muted-foreground")}>
        {t("referenceUnknown")}
      </span>
    );
  }
  return (
    <span className={base} title={text}>
      {text}
    </span>
  );
}
