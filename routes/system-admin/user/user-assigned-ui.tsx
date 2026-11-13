import { PersonAvatar } from "@/components/share/person-avatar";

/* Re-export shared admin primitives so existing imports from this file
   keep working without churn. */
export { SectionCard, EmptyState } from "../shared/admin-ui";

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
