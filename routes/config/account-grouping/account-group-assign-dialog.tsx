import { useState, useMemo } from "react";
import { useTranslations } from "use-intl";
import { Link, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ChartOfAccount } from "@/types/chart-of-accounts";
import type { AccountGroupNode } from "./account-grouping-types";

interface AccountGroupAssignDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly targetGroup: AccountGroupNode | null;
  readonly unassignedAccounts: ChartOfAccount[];
  readonly onAssign: (account: ChartOfAccount) => void;
  readonly isPending?: boolean;
}

export function AccountGroupAssignDialog({
  open,
  onOpenChange,
  targetGroup,
  unassignedAccounts,
  onAssign,
  isPending = false,
}: AccountGroupAssignDialogProps) {
  const t = useTranslations("config.accountGrouping");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    // BR-GRP-002: Filter by targetGroup.category first so accounts match the group's branch category
    const categoryMatched = targetGroup
      ? unassignedAccounts.filter((a) => a.category === targetGroup.category)
      : unassignedAccounts;

    if (!query.trim()) return categoryMatched;
    const q = query.toLowerCase();
    return categoryMatched.filter(
      (a) =>
        a.code.toLowerCase().includes(q) ||
        a.description_1.toLowerCase().includes(q) ||
        (a.description_2?.toLowerCase().includes(q) ?? false),
    );
  }, [unassignedAccounts, targetGroup, query]);

  if (!targetGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2 pr-6">
            <DialogTitle className="flex items-center gap-2">
              <Link className="size-4 text-primary" />
              <span>{t("assign.title", { code: targetGroup.code })}</span>
            </DialogTitle>
            <Badge variant="secondary" size="sm" className="font-mono capitalize">
              {targetGroup.category}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {targetGroup.name} (L{targetGroup.level}) &bull; Category:{" "}
            <span className="font-medium text-foreground capitalize">
              {targetGroup.category}
            </span>
          </p>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("assign.search")}
              className="pl-8 h-9 text-xs"
            />
          </div>

          {/* Accounts List */}
          <div className="rounded-xl border bg-card">
            <ScrollArea className="h-64">
              {filtered.length > 0 ? (
                <div className="divide-y divide-border/60">
                  {filtered.map((acc) => (
                    <div
                      key={acc.id}
                      className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors text-xs"
                    >
                      <div className="space-y-0.5 min-w-0 pr-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-primary">
                            {acc.code}
                          </span>
                          <span className="text-micro font-mono text-muted-foreground">
                            ({acc.type})
                          </span>
                        </div>
                        <div className="font-medium text-foreground truncate">
                          {acc.description_1}
                        </div>
                        {acc.description_2 && (
                          <div className="text-micro text-muted-foreground truncate">
                            {acc.description_2}
                          </div>
                        )}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        disabled={isPending}
                        onClick={() => onAssign(acc)}
                        className="shrink-0 h-7 text-xs font-semibold gap-1"
                      >
                        {t("assign.select")}
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                  <p>{t("assign.emptyPool")}</p>
                  <p className="text-micro text-muted-foreground/80">
                    Showing unassigned accounts matching category &ldquo;{targetGroup.category}&rdquo;
                  </p>
                </div>
              )}
            </ScrollArea>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {t("dialog.cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
