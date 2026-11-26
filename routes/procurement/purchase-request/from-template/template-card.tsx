import { useTranslations } from "use-intl";
import { Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PurchaseRequestTemplate } from "@/types/purchase-request";

interface Props {
  readonly template: PurchaseRequestTemplate;
  readonly onSelect: (id: string) => void;
}

const PREVIEW_LIMIT = 3;

export default function TemplateCard({ template, onSelect }: Props) {
  const t = useTranslations("procurement.purchaseRequest");
  const items = template.purchase_request_template_detail;
  const previewItems = items.slice(0, PREVIEW_LIMIT);
  const remaining = items.length - PREVIEW_LIMIT;

  return (
    <button
      type="button"
      onClick={() => onSelect(template.id)}
      className="group bg-card hover:border-primary/40 focus-visible:ring-primary/40 flex w-full min-w-0 items-start gap-3 rounded-xl border p-3 text-left transition-colors duration-200 focus:outline-none focus-visible:ring-2"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-foreground truncate text-sm font-semibold">
              {template.name}
            </h3>
            {template.workflow?.name && (
              <p className="text-muted-foreground text-micro mt-0.5 truncate">
                {template.workflow.name}
              </p>
            )}
          </div>
          <Badge
            variant="secondary"
            size="xs"
            className="shrink-0 tabular-nums"
          >
            {t("nItems", { count: items.length })}
          </Badge>
        </div>

        {items.length > 0 && (
          <div className="bg-muted/40 space-y-1 rounded-md border p-2">
            {previewItems.map((item) => (
              <div
                key={item.id}
                className="text-micro flex min-w-0 items-center gap-1.5"
              >
                <Package
                  aria-hidden="true"
                  className="text-muted-foreground size-3 shrink-0"
                />
                <Badge
                  variant="outline"
                  size="xs"
                  className="text-micro-legal shrink-0"
                >
                  {item.product?.code}
                </Badge>
                <span className="text-foreground min-w-0 flex-1 truncate">
                  {item.product?.name}
                </span>
                <span className="text-muted-foreground shrink-0 tabular-nums">
                  {item.requested_qty} {item.requested_unit?.name}
                </span>
              </div>
            ))}
            {remaining > 0 && (
              <p className="text-muted-foreground/70 text-micro-legal pl-4.5">
                {t("nMore", { count: remaining })}
              </p>
            )}
          </div>
        )}
      </div>
    </button>
  );
}
