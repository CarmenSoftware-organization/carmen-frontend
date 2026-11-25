import { useTranslations } from "use-intl";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
export interface VarianceGridItem {
  readonly id: string;
  readonly product_code: string;
  readonly product_name: string;
  readonly product_local_name?: string;
}

interface VarianceGridProps<T extends VarianceGridItem> {
  readonly items: readonly T[];
  readonly getSystemQty: (item: T) => number;
  readonly getActualQty: (item: T) => number | null;
  readonly getVariance: (item: T) => number;
  readonly getUnitName: (item: T) => string;
  readonly translationNamespace: string;
}

export function VarianceGrid<T extends VarianceGridItem>({
  items,
  getSystemQty,
  getActualQty,
  getVariance,
  getUnitName,
  translationNamespace,
}: VarianceGridProps<T>) {
  const t = useTranslations(translationNamespace);

  return (
    <div className="border-border/60 bg-card overflow-hidden rounded-xl border">
      <div className="overflow-x-auto">
        <table className="w-full min-w-160 border-collapse text-xs">
          <thead className="bg-muted/60 text-foreground border-b">
            <tr>
              <th
                scope="col"
                className="text-micro-legal px-3 py-2 text-left font-semibold tracking-widest uppercase"
              >
                {t("colProduct")}
              </th>
              <th
                scope="col"
                className="text-micro-legal px-3 py-2 text-right font-semibold tracking-widest uppercase"
              >
                {t("colSystem")}
              </th>
              <th
                scope="col"
                className="text-micro-legal px-3 py-2 text-right font-semibold tracking-widest uppercase"
              >
                {t("colActual")}
              </th>
              <th
                scope="col"
                className="text-micro-legal px-3 py-2 text-right font-semibold tracking-widest uppercase"
              >
                {t("colVariance")}
              </th>
              <th
                scope="col"
                className="text-micro-legal px-3 py-2 text-left font-semibold tracking-widest uppercase"
              >
                {t("colUnit")}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const variance = getVariance(item);
              const actual = getActualQty(item);
              return (
                <tr
                  key={item.id}
                  className="border-border/40 hover:bg-muted/30 border-b transition-colors last:border-b-0"
                >
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap items-baseline gap-1.5">
                      <Badge
                        variant="outline"
                        size="xs"
                        className="text-micro-eyebrow tracking-widest uppercase"
                      >
                        {item.product_code}
                      </Badge>
                      <span className="text-foreground text-sm leading-tight font-semibold tracking-tight">
                        {"- "}
                        {item.product_name}
                      </span>
                      {item.product_local_name && (
                        <span className="text-muted-foreground text-micro">
                          ({item.product_local_name})
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="text-foreground/80 px-3 py-2 text-right align-middle text-xs tabular-nums">
                    {getSystemQty(item)}
                  </td>
                  <td className="text-foreground px-3 py-2 text-right align-middle text-sm font-semibold tabular-nums">
                    {actual ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right align-middle">
                    <span
                      className={cn(
                        "text-sm font-semibold tabular-nums",
                        variance > 0 && "text-success-ink",
                        variance < 0 && "text-destructive",
                      )}
                    >
                      {variance > 0 ? `+${variance}` : variance}
                    </span>
                  </td>
                  <td className="px-3 py-2 align-middle">
                    {getUnitName(item)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
