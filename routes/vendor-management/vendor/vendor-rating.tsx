import { useState } from "react";
import { StarIcon, XIcon } from "lucide-react";
import { RadioGroup as RadioGroupPrimitive } from "radix-ui";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const STARS = [1, 2, 3, 4, 5] as const;

interface StarsProps {
  readonly value: number;
  readonly className?: string;
}

/** ดาวแบบอ่านอย่างเดียว — ใช้ในโหมด view */
export function VendorRatingStars({ value, className }: StarsProps) {
  const t = useTranslations("vendorManagement.vendor");
  return (
    <span
      // data-slot กันเซลล์ DataGrid ใส่ line-clamp ให้ (มันทับ display เป็น flow-root จน gap หาย)
      data-slot="vendor-rating-stars"
      role="img"
      aria-label={t("ratingValue", { value })}
      className={cn("inline-flex items-center gap-1.5", className)}
    >
      <span className="inline-flex items-center gap-0.5" aria-hidden>
        {STARS.map((n) => (
          <StarIcon
            key={n}
            className={cn(
              "size-3.5",
              n <= value
                ? "fill-primary text-primary"
                : "text-muted-foreground/40",
            )}
          />
        ))}
      </span>
      <span className="text-muted-foreground tabular-nums" aria-hidden>
        {value}/5
      </span>
    </span>
  );
}

interface InputProps {
  readonly id?: string;
  readonly value: number | null;
  readonly onChange: (value: number | null) => void;
  readonly disabled?: boolean;
}

/**
 * ช่องให้คะแนน 1–5 — radiogroup ของ Radix จัดการ roving focus + ลูกศรให้
 * radio เลือกแล้วยกเลิกไม่ได้ จึงมีปุ่มล้างแยก (null = ยังไม่ประเมิน ตาม tb_vendor.rating)
 */
export function VendorRatingInput({
  id,
  value,
  onChange,
  disabled,
}: InputProps) {
  const t = useTranslations("vendorManagement.vendor");
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  return (
    <div className="flex h-8 items-center gap-2">
      <RadioGroupPrimitive.Root
        id={id}
        value={value == null ? "" : String(value)}
        onValueChange={(v) => onChange(Number(v))}
        disabled={disabled}
        orientation="horizontal"
        aria-label={t("rating")}
        className="flex items-center"
        onMouseLeave={() => setHover(null)}
      >
        {STARS.map((n) => (
          <RadioGroupPrimitive.Item
            key={n}
            value={String(n)}
            aria-label={t("ratingValue", { value: n })}
            onMouseEnter={() => setHover(n)}
            className="focus-visible:ring-ring/50 rounded-sm p-0.5 outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <StarIcon
              aria-hidden
              className={cn(
                "size-5 transition-colors",
                n <= shown
                  ? "fill-primary text-primary"
                  : "text-muted-foreground/40",
                hover != null &&
                  n <= shown &&
                  "fill-primary/60 text-primary/60",
              )}
            />
          </RadioGroupPrimitive.Item>
        ))}
      </RadioGroupPrimitive.Root>

      <span className="text-muted-foreground min-w-[4.5rem] text-xs tabular-nums">
        {shown > 0 ? `${shown}/5` : t("notRated")}
      </span>

      {value != null && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={t("clearRating")}
          title={t("clearRating")}
          onClick={() => onChange(null)}
        >
          <XIcon />
        </Button>
      )}
    </div>
  );
}
