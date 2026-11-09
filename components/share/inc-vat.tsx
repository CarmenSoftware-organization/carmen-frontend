import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

/**
 * ป้าย "Inc VAT" ของราคาที่กรอกรวม VAT มาแล้ว — ใช้ตัวเดียวทุกหน้า (PL / PR / PO / GRN / AP)
 *
 * วาง **หน้า** ตัวเลขเสมอ: คอลัมน์ราคาชิดขวา ถ้าป้ายต่อท้าย แถวที่ติ๊กตัวเลขจะเลื่อนซ้าย
 * ทศนิยมไม่ตรงกับแถวอื่น · หน้าตาเดียวกับ `HiddenValue` (ชิปพื้น muted) เป็นตระกูล
 * "ข้อมูลกำกับราคา" ไม่ใช่สถานะเอกสาร
 */
export function IncVatTag({
  className,
  title,
}: {
  readonly className?: string;
  /** เช่น ราคาก่อน VAT ให้ hover ดู */
  readonly title?: string;
}) {
  const tc = useTranslations("common");
  return (
    <Badge
      variant="invert-light"
      size="xs"
      title={title}
      className={cn(
        "text-muted-foreground h-4 px-1.5 font-medium",
        className,
      )}
    >
      {tc("incVat")}
    </Badge>
  );
}

/**
 * ตัวเลขราคา + ป้าย Inc VAT ด้านหน้า (ถ้าติ๊ก) — โหมดอ่านอย่างเดียว
 */
export function PriceWithIncVat({
  isTaxIncluded,
  children,
  className,
  title,
}: {
  readonly isTaxIncluded: boolean | null | undefined;
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly title?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end gap-1.5 whitespace-nowrap tabular-nums",
        className,
      )}
    >
      {isTaxIncluded && <IncVatTag title={title} />}
      {children}
    </span>
  );
}

/**
 * ช่องติ๊ก Inc VAT ใต้ช่องราคา (โหมดแก้ไข) — ชิดขวาให้ตรงกับตัวเลข
 */
export function IncVatToggle({
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
  readonly disabled?: boolean;
  readonly className?: string;
}) {
  const tc = useTranslations("common");
  return (
    <label
      className={cn(
        "text-muted-foreground flex cursor-pointer items-center justify-end gap-1.5 text-xs font-normal select-none has-disabled:cursor-not-allowed",
        className,
      )}
    >
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onCheckedChange(v === true)}
        disabled={disabled}
        className="bg-background size-3.5"
      />
      {tc("incVat")}
    </label>
  );
}
