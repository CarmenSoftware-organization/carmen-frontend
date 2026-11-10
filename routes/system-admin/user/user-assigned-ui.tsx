import type { ReactNode } from "react";
import { PersonAvatar } from "@/components/share/person-avatar";
import { cn } from "@/lib/utils";

/* Re-export shared admin primitives so existing imports from this file
   keep working without churn. */
export { SectionCard, EmptyState } from "../shared/admin-ui";

/* ------------------------------------------------------------------ */
/* AssignSection — 2-column "settings" row (mirrors company-profile)  */
/* left = title + description (+ count / filter action); right = body   */
/* ------------------------------------------------------------------ */

export function AssignSection({
  title,
  description,
  count,
  action,
  first,
  wide,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly count?: number;
  readonly action?: ReactNode;
  readonly first?: boolean;
  readonly wide?: boolean;
  readonly children: ReactNode;
}) {
  const heading = (
    <div className="flex items-baseline gap-2">
      <h2 className="text-foreground text-base font-semibold tracking-tight">
        {title}
      </h2>
      {count !== undefined && (
        <span className="text-muted-foreground text-xs font-semibold tabular-nums">
          {count}
        </span>
      )}
    </div>
  );
  const desc = description && (
    <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
      {description}
    </p>
  );

  if (wide) {
    return (
      <section
        className={cn(
          "space-y-4",
          !first && "border-border/70 mt-8 border-t pt-8",
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            {heading}
            {desc}
          </div>
          {action}
        </div>
        <div className="min-w-0">{children}</div>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "grid gap-x-10 gap-y-3 md:grid-cols-3",
        !first && "border-border/70 mt-8 border-t pt-8",
      )}
    >
      <div className="md:col-span-1">
        {heading}
        {desc}
        {action && <div className="mt-3">{action}</div>}
      </div>
      <div className="min-w-0 md:col-span-2">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* UserAvatar — initials on a flat neutral surface (identity, not neon) */
/* ------------------------------------------------------------------ */

interface UserAvatarProps {
  readonly first: string;
  readonly last: string;
  readonly avatarUrl?: string | null;
}

export function UserAvatar({ first, last, avatarUrl }: UserAvatarProps) {
  return (
    <PersonAvatar
      firstname={first}
      lastname={last}
      avatarUrl={avatarUrl}
      className="border-border/60 size-16 shrink-0 border"
      fallbackClassName="bg-muted text-foreground text-lg font-semibold tracking-wide"
    />
  );
}
