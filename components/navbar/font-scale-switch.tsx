import { useState } from "react";
import { useTranslations } from "use-intl";
import { ALargeSmall, Check } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DEFAULT_FONT_SCALE,
  FONT_SCALES,
  applyScale,
  readStoredScale,
  type FontScale,
} from "@/lib/font-scale";

/**
 * ขนาดตัวอย่าง "Aa" — px คงที่ ไม่ใช่ rem โดยตั้งใจ
 *
 * ถ้าใช้ rem ตัวอย่างทั้ง 5 ตัวจะโตตามเมนูพร้อมกันและมีขนาดเท่ากันหมด เทียบกัน
 * ไม่ได้เลย ซึ่งทำลายเหตุผลเดียวที่มันอยู่ตรงนั้น ค่าคือ root ของแต่ละระดับ × 0.75
 */
const PREVIEW_PX: Record<FontScale, number> = {
  small: 11,
  normal: 12,
  big: 13.5,
  bigger: 15,
  biggest: 16.5,
};

const LABEL_KEY = {
  small: "fontSizeSmall",
  normal: "fontSizeNormal",
  big: "fontSizeBig",
  bigger: "fontSizeBigger",
  biggest: "fontSizeBiggest",
} as const satisfies Record<FontScale, string>;

/**
 * ระดับที่ "ใช้งานจริงใน tab นี้" — อ่านจาก class บน <html> ไม่ใช่ localStorage
 *
 * สอง tab เปิดพร้อมกัน: tab A เปลี่ยนเป็น biggest, tab B ไม่ sync ตาม (ตั้งใจ ไม่ทำ
 * cross-tab sync) แต่ค่าที่ apply จริงใน tab B ยังเป็นค่าที่ tab B โหลดมา — ถ้าอ่าน
 * localStorage ตรงๆ เมนูของ tab B จะ checkmark ผิดระดับ (ของ tab A) ทั้งที่หน้าจอ
 * ตัวเองไม่ได้ขนาดนั้น ไม่มี class `font-scale-*` เลย = `normal` จึง fallback ไป
 * readStoredScale() (จะได้ "normal" เสมอในเคสนั้น)
 */
function readActiveScale(): FontScale {
  const root = document.documentElement;
  const active = FONT_SCALES.find(
    (scale) =>
      scale !== DEFAULT_FONT_SCALE &&
      root.classList.contains(`font-scale-${scale}`),
  );
  return active ?? readStoredScale();
}

/**
 * Font scale submenu — ฝังใน DropdownMenu อื่น
 *
 * ถือ state เอง ไม่มี provider: ค่าจริงอยู่บน <html> ไม่ได้อยู่ใน React และไม่มี
 * component อื่นในแอปต้องอ่านมัน เมนูปิดแล้ว component unmount — mount ครั้งหน้า
 * อ่าน class บน <html> ใหม่ (readActiveScale) จึงตรงกับ tab นี้เสมอ ไม่ใช่
 * localStorage ตรงๆ — สอง tab เปิดพร้อมกันแล้วอีก tab เปลี่ยนค่า localStorage
 * จะไม่ตรงกับ DOM ของ tab นี้อีกต่อไป
 *
 * mirror pattern เดียวกับ ThemeSwitch / LangSwitch
 */
export function FontScaleSwitch() {
  const t = useTranslations("common");
  const [scale, setScale] = useState<FontScale>(readActiveScale);

  const select = (next: FontScale) => {
    applyScale(next);
    setScale(next);
  };

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-md px-2 py-2 text-xs">
        <ALargeSmall className="size-4" />
        {t("fontSize")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48 p-1.5">
        {FONT_SCALES.map((option) => {
          const isActive = scale === option;
          return (
            <DropdownMenuItem
              key={option}
              onClick={() => select(option)}
              className="cursor-pointer gap-2 rounded-md px-2 py-2 text-sm"
              // menuitem ไม่รองรับ aria-checked — ตัวเลือกแบบเลือกได้หนึ่งเดียวต้องเป็น menuitemradio
              role="menuitemradio"
              aria-checked={isActive}
            >
              {/* กว้างคงที่เพื่อให้ชื่อระดับทั้ง 5 เรียงตรงกัน ไม่เต้นตามความกว้าง
                  ของตัวอย่าง */}
              <span
                className="w-7 shrink-0 text-center leading-none font-semibold"
                style={{ fontSize: `${PREVIEW_PX[option]}px` }}
                aria-hidden="true"
              >
                Aa
              </span>
              <span className="flex-1">{t(LABEL_KEY[option])}</span>
              {isActive && (
                <Check className="text-primary size-4" aria-hidden="true" />
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
