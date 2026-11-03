import { useInViewport } from "@/hooks/use-in-viewport";
import { cn } from "@/lib/utils";
import type { DocumentFile } from "@/types/document";
import { getFileTypeInfo, getPreviewKind } from "./document-file-type";
import { useDocumentBlob, useObjectUrl } from "./use-document-blob";

/** รูปใหญ่กว่านี้ไม่ทำรูปย่อ — ต้องลากทั้งไฟล์ผ่าน gateway เพื่อรูปเล็ก ๆ ไม่คุ้ม */
const THUMB_MAX_BYTES = 3 * 1024 * 1024;

interface DocumentThumbProps {
  readonly doc: DocumentFile;
  /** ขนาดไอคอนแทนรูป — tile ใหญ่ / แถวรายการเล็ก */
  readonly iconClassName?: string;
  readonly className?: string;
}

/**
 * รูปย่อของไฟล์ — ไฟล์รูป (≤ 3 MB) โหลดเมื่อเข้าใกล้ viewport แล้วแสดงแบบ cover
 * ชนิดอื่น/โหลดไม่ได้/ยังไม่ถึงคิว แสดงไอคอนชนิดไฟล์แทน กรอบมีขนาดคงที่จาก className
 * ของผู้เรียก จึงไม่กระตุกตอนรูปมาถึง
 */
export function DocumentThumb({
  doc,
  iconClassName = "size-10",
  className,
}: DocumentThumbProps) {
  const { ref, inView } = useInViewport<HTMLDivElement>();
  const canThumb =
    getPreviewKind(doc.contentType) === "image" && doc.size <= THUMB_MAX_BYTES;
  const { data: blob } = useDocumentBlob(doc.fileToken, canThumb && inView);
  const url = useObjectUrl(canThumb ? blob : undefined);
  const { icon: Icon, className: iconColor } = getFileTypeInfo(doc.contentType);

  return (
    <div
      ref={ref}
      className={cn(
        "bg-muted/60 flex items-center justify-center overflow-hidden",
        className,
      )}
    >
      {url ? (
        <img
          src={url}
          alt=""
          className="size-full object-cover"
          draggable={false}
        />
      ) : (
        <Icon className={cn(iconColor, iconClassName)} aria-hidden="true" />
      )}
    </div>
  );
}
