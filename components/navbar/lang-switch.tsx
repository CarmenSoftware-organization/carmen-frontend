import { useLocale, useTranslations } from "use-intl";
import { Check, Globe } from "lucide-react";
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocaleSwitch } from "@/hooks/use-locale-switch";
import { SUPPORTED_LOCALES, type SupportedLocale } from "@/i18n/config";

const LOCALE_LABELS: Record<SupportedLocale, string> = {
  en: "English",
  th: "ไทย",
};

export function LangSwitch() {
  const locale = useLocale() as SupportedLocale;
  const t = useTranslations("common");
  const { switchLocale, isPending } = useLocaleSwitch();

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger className="cursor-pointer gap-2 rounded-md px-2 py-2 text-sm">
        <Globe className="size-4" />
        {t("language")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="min-w-48 p-1.5">
        {SUPPORTED_LOCALES.map((loc) => {
          const isActive = locale === loc;
          return (
            <DropdownMenuItem
              key={loc}
              onClick={() => switchLocale(loc)}
              disabled={isPending}
              className="cursor-pointer gap-2 rounded-md px-2 py-2 text-sm"
              // menuitem ไม่รองรับ aria-checked — ตัวเลือกแบบเลือกได้หนึ่งเดียวต้องเป็น menuitemradio
              role="menuitemradio"
              aria-checked={isActive}
            >
              <span className="flex-1">{LOCALE_LABELS[loc]}</span>
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
