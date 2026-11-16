import { useState, useMemo } from "react";
import { useTranslations } from "use-intl";
import { MoveRight, Info, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import type { AccountGroupNode } from "./account-grouping-types";

interface AccountGroupMoveDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly targetGroup: AccountGroupNode | null;
  readonly fullTree: AccountGroupNode[];
  readonly isDescendant: (movingNode: AccountGroupNode, targetId: string) => boolean;
  readonly getMaxSubDepth: (node: AccountGroupNode) => number;
  readonly onConfirmMove: (group: AccountGroupNode, targetParentId: string | null) => void;
  readonly isPending?: boolean;
}

export function AccountGroupMoveDialog({
  open,
  onOpenChange,
  targetGroup,
  fullTree,
  isDescendant,
  getMaxSubDepth,
  onConfirmMove,
  isPending = false,
}: AccountGroupMoveDialogProps) {
  if (!targetGroup) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <AccountGroupMoveForm
          key={targetGroup.id}
          targetGroup={targetGroup}
          fullTree={fullTree}
          isDescendant={isDescendant}
          getMaxSubDepth={getMaxSubDepth}
          onConfirmMove={onConfirmMove}
          onCancel={() => onOpenChange(false)}
          isPending={isPending}
        />
      )}
    </Dialog>
  );
}

interface AccountGroupMoveFormProps {
  readonly targetGroup: AccountGroupNode;
  readonly fullTree: AccountGroupNode[];
  readonly isDescendant: (parent: AccountGroupNode, targetId: string) => boolean;
  readonly getMaxSubDepth: (node: AccountGroupNode) => number;
  readonly onConfirmMove: (group: AccountGroupNode, newParentId: string) => void;
  readonly onCancel: () => void;
  readonly isPending: boolean;
}

function AccountGroupMoveForm({
  targetGroup,
  fullTree,
  isDescendant,
  getMaxSubDepth,
  onConfirmMove,
  onCancel,
  isPending,
}: AccountGroupMoveFormProps) {
  const t = useTranslations("config.accountGrouping");
  const [selectedParentId, setSelectedParentId] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Flatten valid parent choices
  const validParents = useMemo(() => {
    const list: Array<{ id: string; label: string; level: number }> = [];

    const walk = (nodes: AccountGroupNode[]) => {
      for (const node of nodes) {
        // Cannot select itself
        if (node.id === targetGroup.id) continue;
        // Circular guard: cannot select any of its descendants
        if (isDescendant(targetGroup, node.id)) continue;

        // BR-GRP-006: Level 2 group can ONLY be moved to another Level 1 group
        if (targetGroup.level === 2 && node.level !== 1) continue;

        // BR-GRP-001: New level would be node.level + 1. Plus targetGroup's sub-depth cannot exceed 4
        const subDepth = getMaxSubDepth(targetGroup);
        if (node.level + 1 + subDepth > 4) continue;

        list.push({
          id: node.id,
          label: `[L${node.level}] ${node.code} - ${node.name}`,
          level: node.level,
        });

        if (node.children?.length) {
          walk(node.children);
        }
      }
    };

    walk(fullTree);
    return list;
  }, [targetGroup, fullTree, isDescendant, getMaxSubDepth]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedParentId) return;

    onConfirmMove(targetGroup, selectedParentId);
  };

  return (
    <DialogContent className="@container max-h-[90dvh] overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <MoveRight className="size-4 text-primary" />
          <span>
            {t("move.title")} [{targetGroup.code}]
          </span>
        </DialogTitle>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="space-y-4 py-2">
        {/* L2 Notice */}
        {targetGroup.level === 2 && (
          <div className="flex items-start gap-2 rounded-lg border border-blue-500/30 bg-blue-500/10 p-3 text-xs text-blue-800 dark:text-blue-300">
            <Info className="size-4 shrink-0 mt-0.5" />
            <span>{t("move.l2Notice")}</span>
          </div>
        )}

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <Field>
          <FieldLabel required>{t("move.targetParent")}</FieldLabel>
          <Select
            value={selectedParentId}
            onValueChange={(val) => {
              setSelectedParentId(val);
              setErrorMessage("");
            }}
            disabled={isPending}
          >
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="-- Select Target Parent Group --" />
            </SelectTrigger>
            <SelectContent>
              {validParents.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <DialogFooter className="pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            {t("dialog.cancel")}
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isPending || !selectedParentId}
          >
            {t("move.confirmMove")}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}
