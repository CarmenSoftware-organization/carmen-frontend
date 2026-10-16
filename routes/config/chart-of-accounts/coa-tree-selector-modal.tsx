import { useState, useMemo } from "react";
import { FolderTree, ChevronRight, Check } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AccountGroupMaster } from "@/types/accounting-master";
import type { AccountCategory } from "@/types/chart-of-accounts";

export interface GroupingPathNode {
  code: string;
  name: string;
  level: number;
}

interface CoaTreeSelectorModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly category?: AccountCategory | "";
  readonly groups: AccountGroupMaster[];
  /** โหนดที่มีกลุ่มลูก — backend ผูกบัญชีได้เฉพาะ leaf จึงกดเลือกไม่ได้ */
  readonly nonLeafIds: ReadonlySet<string>;
  readonly currentGroupId?: string;
  readonly onSelect: (
    path: GroupingPathNode[],
    targetGroup: AccountGroupMaster,
  ) => void;
}

export function CoaTreeSelectorModal({
  open,
  onOpenChange,
  category,
  groups,
  nonLeafIds,
  currentGroupId,
  onSelect,
}: CoaTreeSelectorModalProps) {
  const t = useTranslations("config.chartOfAccounts");
  const tc = useTranslations("common");

  const [selectedId, setSelectedId] = useState<string>(currentGroupId ?? "");

  // Build group lookup map
  const groupMap = useMemo(
    () => new Map(groups.map((g) => [g.id, g])),
    [groups],
  );

  // Filter groups by category if category is selected
  const filteredGroups = useMemo(() => {
    if (!category) return groups;
    return groups.filter((g) => g.category === category);
  }, [groups, category]);

  // Compute full ancestry path for any given group
  const computePath = (group: AccountGroupMaster): GroupingPathNode[] => {
    const path: GroupingPathNode[] = [];
    let curr: AccountGroupMaster | undefined = group;
    const visited = new Set<string>();

    while (curr && !visited.has(curr.id)) {
      visited.add(curr.id);
      path.unshift({
        code: curr.code,
        name: curr.name,
        level: curr.level,
      });
      curr = curr.parent_id ? groupMap.get(curr.parent_id) : undefined;
    }
    return path;
  };

  const handleConfirm = () => {
    const targetGroup = groupMap.get(selectedId);
    if (!targetGroup || nonLeafIds.has(targetGroup.id)) return;
    const path = computePath(targetGroup);
    onSelect(path, targetGroup);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="border-b pb-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FolderTree className="size-4.5" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                {t("sections.grouping")}
              </DialogTitle>
              <DialogDescription className="mt-0.5 text-xs text-muted-foreground">
                {t("sections.groupingDesc")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-2 overflow-y-auto py-2">
          {filteredGroups.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              {category
                ? `No account groups defined for category: ${category}`
                : "No account groups available."}
            </p>
          ) : (
            filteredGroups.map((group) => {
              const isSelectable = !nonLeafIds.has(group.id);
              const isSelected = isSelectable && selectedId === group.id;
              const path = computePath(group);
              const paddingLeftClass =
                group.level === 1
                  ? "pl-3"
                  : group.level === 2
                    ? "pl-6"
                    : group.level === 3
                      ? "pl-9"
                      : "pl-12";

              return (
                <div
                  key={group.id}
                  onClick={isSelectable ? () => setSelectedId(group.id) : undefined}
                  aria-disabled={!isSelectable}
                  title={isSelectable ? undefined : t("labels.parentGroupNotSelectable")}
                  className={`flex items-center justify-between rounded-lg border p-2.5 transition-colors ${paddingLeftClass} ${
                    !isSelectable
                      ? "cursor-default border-transparent bg-muted/40 text-muted-foreground"
                      : isSelected
                        ? "cursor-pointer border-primary/50 bg-primary/10"
                        : "cursor-pointer border-border/60 bg-card hover:bg-secondary/40"
                  }`}
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        className="font-mono text-micro-legal"
                      >
                        L{group.level}
                      </Badge>
                      <span className="font-mono text-xs font-bold text-foreground">
                        {group.code}
                      </span>
                      <span className="text-xs font-medium text-foreground truncate">
                        {group.name}
                      </span>
                      {group.name_local && (
                        <span className="text-xs text-muted-foreground truncate">
                          ({group.name_local})
                        </span>
                      )}
                    </div>
                    {path.length > 1 && (
                      <div className="flex flex-wrap items-center gap-1 text-micro text-muted-foreground font-mono">
                        {path.map((item, idx) => (
                          <span key={item.code} className="inline-flex items-center gap-1">
                            <span>{item.code}</span>
                            {idx < path.length - 1 && (
                              <ChevronRight className="size-3 text-muted-foreground/60" />
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="ml-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="border-t pt-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!selectedId || nonLeafIds.has(selectedId)}
            onClick={handleConfirm}
          >
            {tc("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
