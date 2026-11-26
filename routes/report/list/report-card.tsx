import { ArrowUpRight, FileText, Sparkles } from "lucide-react";
import { useTranslations } from "use-intl";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Report } from "@/types/report";
import { ListCardRowNo } from "@/components/share/list-card";

interface ReportCardProps {
  /** เลขลำดับแถว (`rowNumber()`) */
  readonly rowNo?: number;
  readonly item: Report;
  readonly onSelect: (item: Report) => void;
}

export default function ReportCard({ item, rowNo, onSelect }: ReportCardProps) {
  const t = useTranslations("report");
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(item)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(item);
        }
      }}
      className={cn(
        "group border-border/60 bg-card relative flex cursor-pointer flex-col overflow-hidden rounded-xl border transition-colors",
        "focus-visible:ring-primary/40 focus-visible:ring-2 focus-visible:outline-none",
        "hover:border-primary/40 hover:-translate-y-0.5",
      )}
    >
      {/* Left accent bar — widens on hover */}
      <span
        aria-hidden
        className="bg-primary absolute inset-y-2 left-0 w-0.5 rounded-r-full opacity-60 transition-all group-hover:inset-y-0 group-hover:w-1 group-hover:opacity-100"
      />

      {/* Header */}
      <div className="relative flex items-start gap-3 px-4 pt-4 pb-2">
        {/* Icon tile */}
        <div
          className="relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklch, var(--primary), transparent 75%) 0%, color-mix(in oklch, var(--primary), transparent 88%) 100%)",
          }}
        >
          <FileText className="text-primary relative size-4" aria-hidden />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-1.5">
            <ListCardRowNo rowNo={rowNo} />
            <h3 className="text-foreground line-clamp-2 text-sm leading-tight font-semibold tracking-tight">
              {item.ReportName}
            </h3>
            <ArrowUpRight
              className="text-muted-foreground/60 group-hover:text-primary mt-0.5 size-3.5 shrink-0 opacity-0 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:opacity-100"
              aria-hidden
            />
          </div>
          <div className="text-muted-foreground text-micro mt-1 flex flex-wrap items-center gap-1.5">
            <span className="font-semibold tracking-wide uppercase">
              {item.ReportGroup}
            </span>
            {item.IsSystem && (
              <>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <Badge
                  variant="outline"
                  size="sm"
                  className="border-primary/30 text-primary text-micro-eyebrow inline-flex items-center gap-0.5 px-1.5 py-0 font-semibold tracking-wide uppercase"
                >
                  <Sparkles className="size-2" aria-hidden />
                  {t("system")}
                </Badge>
              </>
            )}
            {item._templateType && (
              <>
                <span aria-hidden className="text-border">
                  ·
                </span>
                <Badge
                  variant="outline"
                  size="sm"
                  className="text-muted-foreground text-micro-eyebrow inline-flex items-center px-1.5 py-0 font-semibold tracking-wide uppercase"
                >
                  {item._templateType}
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {item.Description && (
        <div className="border-border/40 relative mt-auto border-t px-4 py-2">
          <p className="text-muted-foreground line-clamp-2 text-xs leading-relaxed">
            {item.Description}
          </p>
        </div>
      )}
    </div>
  );
}
