import { useTranslations } from "use-intl";
import { cn } from "@/lib/utils";
import { ENTRY_COL } from "./entry-item-row";

/** หัวคอลัมน์ของใบนับ — ความกว้างมาจาก ENTRY_COL ชุดเดียวกับแถว */
export function EntrySheetHeader({
  translationNamespace,
}: {
  readonly translationNamespace: string;
}) {
  const t = useTranslations(translationNamespace);
  return (
    <div className="bg-muted/50 text-muted-foreground text-micro-legal flex items-center gap-3 border-b py-1.5 pr-3 pl-4 font-semibold tracking-wider uppercase">
      <span className={ENTRY_COL.seq}>#</span>
      <span className={ENTRY_COL.name}>{t("sheetItem")}</span>
      <span
        className={cn("hidden sm:block", ENTRY_COL.notes)}
        aria-hidden="true"
      />
      <span
        className={cn(
          "hidden items-center justify-end gap-2 sm:flex",
          ENTRY_COL.qty,
        )}
      >
        <span className="hidden font-normal tracking-normal normal-case lg:inline">
          <kbd className="bg-card rounded border px-1 font-sans">Enter</kbd>{" "}
          {t("sheetEnterNext")}
        </span>
        <span className="lg:hidden">{t("sheetCount")}</span>
      </span>
      <span className={cn("hidden sm:block", ENTRY_COL.unit)}>
        {t("sheetUnit")}
      </span>
    </div>
  );
}
