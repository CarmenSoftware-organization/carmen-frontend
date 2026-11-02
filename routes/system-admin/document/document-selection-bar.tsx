import { Trash2, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { formatFileSize } from "@/lib/format-file-size";

/** เพดานของ server ต่อคำขอโหมดตัวกรอง (DOCUMENT_BULK_DELETE_TOO_MANY) */
export const BULK_DELETE_MAX = 1000;

interface DocumentSelectionBarProps {
  readonly selectedCount: number;
  readonly selectedSize: number;
  /** จำนวน/ขนาดรวมของทุกแถวที่ตรงตัวกรอง (paginate.total / total_size) */
  readonly matchingCount: number;
  readonly matchingSize: number;
  readonly allMatching: boolean;
  readonly onSelectAllMatching: () => void;
  readonly onClear: () => void;
  readonly onDelete: () => void;
  readonly deleteDisabled?: boolean;
  readonly deleteDisabledTitle?: string;
}

/**
 * แถบหลังเลือกไฟล์ในหน้า Document — จำนวน/ขนาดที่เลือก, ลิงก์ "เลือกทั้งหมดที่ตรงตัวกรอง"
 * (ปิดพร้อมคำแนะนำเมื่อเกินเพดาน 1,000) และปุ่มลบ · ไม่ใช่ปุ่มหลักของหน้า (ปุ่มหลัก = อัปโหลด)
 */
export function DocumentSelectionBar({
  selectedCount,
  selectedSize,
  matchingCount,
  matchingSize,
  allMatching,
  onSelectAllMatching,
  onClear,
  onDelete,
  deleteDisabled,
  deleteDisabledTitle,
}: DocumentSelectionBarProps) {
  const t = useTranslations("systemAdmin.document");
  const tooMany = matchingCount > BULK_DELETE_MAX;
  const canOfferAll = !allMatching && matchingCount > selectedCount;

  return (
    <div
      role="status"
      className="bg-muted/60 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border px-3 py-2 text-sm"
    >
      <span className="font-medium">
        {allMatching
          ? t("allMatchingSelected", {
              count: matchingCount,
              size: formatFileSize(matchingSize),
            })
          : t("selectedBar", {
              count: selectedCount,
              size: formatFileSize(selectedSize),
            })}
      </span>

      {canOfferAll &&
        (tooMany ? (
          <span className="text-muted-foreground text-xs">
            {t("selectAllMatchingTooMany", { max: BULK_DELETE_MAX })}
          </span>
        ) : (
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto p-0"
            onClick={onSelectAllMatching}
          >
            {t("selectAllMatching", {
              count: matchingCount,
              size: formatFileSize(matchingSize),
            })}
          </Button>
        ))}

      <div className="ml-auto flex items-center gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onClear}>
          <X />
          {t("clearSelection")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-destructive"
          onClick={onDelete}
          disabled={deleteDisabled}
          title={deleteDisabled ? deleteDisabledTitle : undefined}
        >
          <Trash2 />
          {t("bulkDelete")}
        </Button>
      </div>
    </div>
  );
}
