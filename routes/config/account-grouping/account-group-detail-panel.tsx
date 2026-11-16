import {
  FolderTree,
  ChevronRight,
  Plus,
  MoveRight,
  Pencil,
  Trash2,
  Unlink,
  Link,
  Layers,
  AlertCircle,
} from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AccountGroupNode } from "./account-grouping-types";
import type { ChartOfAccount } from "@/types/chart-of-accounts";

interface AccountGroupDetailPanelProps {
  readonly selectedNode: AccountGroupNode | null;
  readonly breadcrumbs: AccountGroupNode[];
  readonly onAddSubGroup: (node: AccountGroupNode) => void;
  readonly onMoveGroup: (node: AccountGroupNode) => void;
  readonly onEditGroup: (node: AccountGroupNode) => void;
  readonly onDeleteGroup: (node: AccountGroupNode) => void;
  readonly onOpenAssignDialog: () => void;
  readonly onUnassignAccount: (account: ChartOfAccount) => void;
  readonly readOnly?: boolean;
}

const LEVEL_COLOR_MAP: Record<number, string> = {
  1: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/30",
  2: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
  3: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30",
  4: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
};

export function AccountGroupDetailPanel({
  selectedNode,
  breadcrumbs,
  onAddSubGroup,
  onMoveGroup,
  onEditGroup,
  onDeleteGroup,
  onOpenAssignDialog,
  onUnassignAccount,
  readOnly = false,
}: AccountGroupDetailPanelProps) {
  const t = useTranslations("config.accountGrouping");

  if (!selectedNode) {
    return (
      <div className="text-muted-foreground @container flex h-full min-w-0 flex-col items-center justify-center p-8 text-center">
        <FolderTree className="mb-3 size-12 opacity-30" />
        <p className="text-sm font-medium">{t("noGroupSelected")}</p>
      </div>
    );
  }

  const hasChildren = Boolean(
    selectedNode.children && selectedNode.children.length > 0,
  );
  const assignedList = selectedNode.assignedAccounts ?? [];

  return (
    <div className="@container flex h-full min-w-0 flex-col">
      {/* Panel Header */}
      <div className="bg-muted/30 flex min-h-11 flex-wrap items-center justify-between gap-2 border-b px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={`rounded border px-2 py-0.5 font-mono text-xs font-bold ${
              LEVEL_COLOR_MAP[selectedNode.level] ?? LEVEL_COLOR_MAP[1]
            }`}
          >
            L{selectedNode.level} Group
          </span>
          <span className="text-foreground truncate font-mono text-sm font-bold">
            {selectedNode.code}
          </span>
        </div>

        {/* Quick Toolbar */}
        {!readOnly && (
          <div className="flex shrink-0 items-center gap-1.5">
            {selectedNode.level < 4 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                title={t("addSubGroup")}
                onClick={() => onAddSubGroup(selectedNode)}
              >
                <Plus className="size-3.5" />
                <span className="sr-only @xl:not-sr-only">
                  {t("addSubGroup")}
                </span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              title={t("moveGroup")}
              onClick={() => onMoveGroup(selectedNode)}
            >
              <MoveRight className="size-3.5" />
              <span className="sr-only @xl:not-sr-only">{t("moveGroup")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              onClick={() => onEditGroup(selectedNode)}
              title={t("editGroup")}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => onDeleteGroup(selectedNode)}
              title={t("deleteGroup")}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 space-y-4 p-4">
        {/* Node Information Card */}
        <div className="bg-secondary/20 space-y-2.5 rounded-lg border p-3.5">
          <div className="space-y-1">
            <div className="text-muted-foreground text-xs font-medium">
              Group Name
            </div>
            <div className="text-foreground text-sm font-bold">
              {selectedNode.name}
            </div>
            {selectedNode.name_local && (
              <div className="text-muted-foreground text-xs">
                {selectedNode.name_local}
              </div>
            )}
          </div>

          {/* Breadcrumb Hierarchy */}
          {breadcrumbs.length > 0 && (
            <div className="border-border/60 border-t pt-2">
              <div className="text-micro text-muted-foreground mb-1">
                Hierarchy Path:
              </div>
              <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
                {breadcrumbs.map((b, idx) => (
                  <span key={b.id} className="inline-flex items-center gap-1">
                    <span className="bg-card border-border text-foreground rounded border px-1.5 py-0.5 font-semibold">
                      L{b.level}:{b.code}
                    </span>
                    {idx < breadcrumbs.length - 1 && (
                      <ChevronRight className="text-muted-foreground/60 size-3" />
                    )}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Counts */}
          <div className="border-border/60 text-muted-foreground flex flex-wrap items-center gap-2 border-t pt-2 text-xs">
            <span>
              Child Groups:{" "}
              <strong className="text-foreground">
                {selectedNode.children?.length ?? 0}
              </strong>
            </span>
            <span>
              Assigned Accounts:{" "}
              <strong className="text-foreground">{assignedList.length}</strong>
            </span>
          </div>
        </div>

        {/* Assigned Accounts Section */}
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-bold tracking-wider uppercase">
              <Layers className="text-primary size-3.5" />
              <span>
                {t("assignedAccounts")} ({assignedList.length})
              </span>
            </h3>

            {!readOnly && (
              <Button
                type="button"
                size="sm"
                variant={hasChildren ? "outline" : "default"}
                disabled={hasChildren}
                onClick={onOpenAssignDialog}
                className="gap-1.5"
              >
                <Link className="size-3.5" />
                <span>{t("assignAccount")}</span>
              </Button>
            )}
          </div>

          {/* Leaf-only notice if has children */}
          {hasChildren && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertCircle className="size-4 shrink-0" />
              <span>{t("leafOnlyNotice")}</span>
            </div>
          )}

          {/* Accounts Table Container */}
          <div className="bg-card overflow-hidden rounded-lg border">
            {assignedList.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="block w-full text-left text-xs @2xl:table">
                  <thead className="bg-muted/40 text-muted-foreground sr-only border-b font-semibold @2xl:not-sr-only @2xl:table-header-group">
                    <tr>
                      <th className="px-3 py-2">Code</th>
                      <th className="px-3 py-2">Account Name</th>
                      <th className="px-3 py-2">Type</th>
                      {!readOnly && (
                        <th className="block px-3 py-2 text-right @2xl:table-cell @2xl:w-px">
                          Action
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-border/60 block divide-y @2xl:table-row-group">
                    {assignedList.map((acc) => (
                      <tr
                        key={acc.id}
                        className="hover:bg-muted/30 block p-2 transition-colors @2xl:table-row @2xl:p-0"
                      >
                        <td className="text-primary block px-3 py-2 font-mono font-bold @2xl:table-cell @2xl:w-px @2xl:whitespace-nowrap">
                          {acc.code}
                        </td>
                        <td className="block px-3 py-2 @2xl:table-cell @2xl:w-full @2xl:max-w-0">
                          <div className="text-foreground font-medium break-words @2xl:truncate">
                            {acc.description_1}
                          </div>
                          {acc.description_2 && (
                            <div className="text-micro text-muted-foreground break-words @2xl:truncate">
                              {acc.description_2}
                            </div>
                          )}
                        </td>
                        <td className="text-muted-foreground block px-3 py-2 font-mono @2xl:table-cell @2xl:w-px @2xl:whitespace-nowrap">
                          {acc.type}
                        </td>
                        {!readOnly && (
                          <td className="block px-3 py-2 text-right @2xl:table-cell @2xl:w-px">
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => onUnassignAccount(acc)}
                              className="text-micro-legal text-destructive hover:bg-destructive/10 hover:text-destructive h-8 gap-1 px-2"
                              title={t("unassign")}
                            >
                              <Unlink className="size-3" />
                              <span>{t("unassign")}</span>
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-muted-foreground space-y-1 p-8 text-center text-xs">
                <p>
                  {hasChildren ? t("leafOnlyNotice") : t("noAssignedAccounts")}
                </p>
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
