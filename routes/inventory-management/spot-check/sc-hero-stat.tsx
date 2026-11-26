interface ScHeroStatLabels {
  readonly productsToCheck: string;
  readonly method: string;
  readonly location: string;
  readonly productsLabel: string;
  readonly footer: string;
}

interface ScHeroStatProps {
  readonly count: number;
  readonly methodLabel: string;
  readonly locationName?: string;
  readonly labels: ScHeroStatLabels;
}

export function ScHeroStat({
  count,
  methodLabel,
  locationName,
  labels,
}: ScHeroStatProps) {
  return (
    <div className="bg-card hidden rounded-xl border p-4 lg:block">
      <div className="text-muted-foreground text-micro-eyebrow font-semibold tracking-widest uppercase">
        {labels.productsToCheck}
      </div>
      <div className="mt-1 flex items-baseline gap-2">
        <span
          className={
            count
              ? "text-foreground text-3xl leading-none font-semibold tracking-tight tabular-nums"
              : "text-muted-foreground/60 text-3xl leading-none font-semibold tracking-tight tabular-nums"
          }
        >
          {count || 0}
        </span>
        <span className="text-muted-foreground text-xs">
          {labels.productsLabel.toLowerCase()}
        </span>
      </div>

      <div className="bg-border mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-md">
        <Cell k={labels.method} v={methodLabel} />
        <Cell
          k={labels.location}
          v={locationName || "—"}
          empty={!locationName}
        />
      </div>

      <div className="text-muted-foreground text-micro mt-2">
        {labels.footer}
      </div>
    </div>
  );
}

function Cell({
  k,
  v,
  empty,
}: {
  readonly k: string;
  readonly v: string | number;
  readonly empty?: boolean;
}) {
  return (
    <div className="bg-card px-2 py-1.5">
      <div className="text-muted-foreground text-micro-floor font-semibold tracking-widest uppercase">
        {k}
      </div>
      <div
        className={
          empty
            ? "text-muted-foreground/60 text-micro mt-0.5 truncate font-semibold"
            : "text-foreground text-micro mt-0.5 truncate font-semibold"
        }
      >
        {v}
      </div>
    </div>
  );
}
