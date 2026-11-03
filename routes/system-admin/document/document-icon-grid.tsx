import type { Table } from "@tanstack/react-table";
import { useTranslations } from "use-intl";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { formatFileSize } from "@/lib/format-file-size";
import { cn } from "@/lib/utils";
import type { DocumentFile } from "@/types/document";
import { DocumentThumb } from "./document-thumb";

interface DocumentIconGridProps {
  readonly table: Table<DocumentFile>;
  readonly isLoading: boolean;
  /** false = ผู้ใช้ไม่มีสิทธิ์ลบ → ไม่แสดงช่องติ๊ก */
  readonly selectable: boolean;
  /** คลิก tile = เปิดไฟล์นั้นในมุมมอง preview */
  readonly onOpen: (doc: DocumentFile) => void;
  readonly perpage: number;
}

const GRID = "grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-3";

/**
 * มุมมอง icon ของหน้า Document — tile รูปย่อ/ไอคอนชนิดไฟล์ + ชื่อ + ขนาด·วันที่
 *
 * อ่านแถวจาก TanStack table ตัวเดียวกับตาราง การเลือกจึงเป็นชุดเดียวกันทุกมุมมอง
 * (สลับมุมมองแล้วสิ่งที่ติ๊กไว้ไม่หาย และแถบลบหลายรายการใช้ได้เหมือนเดิม)
 */
export function DocumentIconGrid({
  table,
  isLoading,
  selectable,
  onOpen,
  perpage,
}: DocumentIconGridProps) {
  "use no memo";
  const t = useTranslations("systemAdmin.document");
  const { dateFormat } = useProfile();

  if (isLoading) {
    return (
      <div className={GRID}>
        {Array.from({ length: Math.min(perpage, 12) }, (_, i) => (
          <Skeleton key={i} className="aspect-[4/5] rounded-md" />
        ))}
      </div>
    );
  }

  const rows = table.getRowModel().rows;
  const anySelected =
    table.getIsSomeRowsSelected() || table.getIsAllRowsSelected();

  return (
    <ul className={GRID} aria-label={t("title")}>
      {rows.map((row) => {
        const doc = row.original;
        const selected = row.getIsSelected();
        const at = doc.audit?.created?.at ?? doc.lastModified;
        return (
          <li
            key={row.id}
            className={cn(
              "group bg-card relative flex flex-col overflow-hidden rounded-md border transition-colors",
              selected
                ? "border-primary ring-primary/30 ring-2"
                : "hover:border-primary/40",
            )}
          >
            <button
              type="button"
              onClick={() => onOpen(doc)}
              className="focus-visible:ring-ring flex flex-1 flex-col text-left outline-none focus-visible:ring-2"
              title={doc.originalName}
            >
              <DocumentThumb
                doc={doc}
                className="aspect-[4/3] w-full border-b"
                iconClassName="size-10"
              />
              <span className="flex flex-col gap-0.5 px-2.5 py-2">
                <span className="line-clamp-2 text-xs font-semibold break-all">
                  {doc.originalName}
                </span>
                <span className="text-muted-foreground text-micro tabular-nums">
                  {formatFileSize(doc.size)}
                  {at ? ` · ${formatDate(at, dateFormat)}` : ""}
                </span>
              </span>
            </button>
            {selectable && (
              <Checkbox
                checked={selected}
                onCheckedChange={(v) => row.toggleSelected(!!v)}
                aria-label={doc.originalName}
                className={cn(
                  "bg-background absolute top-2 left-2 shadow-sm transition-opacity",
                  // ซ่อนไว้จนชี้/โฟกัส เว้นแต่มีการเลือกอยู่แล้ว — ตอนนั้นทุกใบต้องเห็นว่าติ๊กได้
                  !selected &&
                    !anySelected &&
                    "opacity-0 group-focus-within:opacity-100 group-hover:opacity-100",
                )}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}
