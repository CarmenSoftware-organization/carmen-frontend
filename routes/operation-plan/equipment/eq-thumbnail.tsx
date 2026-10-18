import { useState } from "react";
import { Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface EqThumbnailProps {
  readonly src: string | null | undefined;
  readonly alt: string;
  readonly className?: string;
}

/**
 * รูปย่อของอุปกรณ์ (การ์ดในกริด · หัวหน้ารายละเอียด) — ขนาดกำหนดจาก `className`
 *
 * ไม่มีรูป หรือโหลดไม่ขึ้น (ลิงก์ไฟล์หมดอายุ) = ไอคอนเดียวกับเมนู Equipment
 * บนพื้น muted กล่องจึงสูงเท่ากันทุกใบ ไม่กระโดดตอนรูปพัง
 */
export function EqThumbnail({ src, alt, className }: EqThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = !!src && failedSrc !== src;

  return (
    <div
      className={cn(
        "bg-muted flex shrink-0 items-center justify-center overflow-hidden rounded-md border",
        className,
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="size-full object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <Wrench
          className="text-muted-foreground/60 size-5"
          aria-hidden="true"
        />
      )}
    </div>
  );
}
