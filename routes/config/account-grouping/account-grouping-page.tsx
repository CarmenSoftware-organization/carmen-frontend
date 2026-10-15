import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { FolderTree, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import SearchInput from "@/components/search-input";
import { ListPageShell } from "@/components/share/list-page-shell";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { useBuCode } from "@/hooks/use-bu-code";
import { API_ENDPOINTS } from "@/constant/api-endpoints";
import { ApiError, isAppStatusErrorCode } from "@/lib/api-error";
import { useErrorToast } from "@/hooks/use-error-toast";
import { httpClient } from "@/lib/http-client";
import { useGlAccountGroups, glAccountGroupsKey } from "../shared/use-gl-account-groups";
import {
  useChartOfAccountAll,
  useUpdateChartOfAccount,
} from "@/hooks/use-chart-of-account";
import { QUERY_KEYS } from "@/constant/query-keys";
import type { ChartOfAccount, AccountCategory } from "@/types/chart-of-accounts";
import type { AccountGroupNode, GroupTreeLevel } from "./account-grouping-types";
import { useAccountGroupingTree } from "./use-account-grouping-tree";
import { AccountGroupTreeNode } from "./account-group-tree-node";
import { AccountGroupDetailPanel } from "./account-group-detail-panel";
import { AccountGroupFormDialog } from "./account-group-form-dialog";
import { AccountGroupMoveDialog } from "./account-group-move-dialog";
import { AccountGroupAssignDialog } from "./account-group-assign-dialog";
import { AccountGroupUnassignWarningDialog } from "./account-group-unassign-warning-dialog";

export default function AccountGroupingPage() {
  const t = useTranslations("config.accountGrouping");
  const tt = useTranslations("toast");
  const errorToast = useErrorToast();
  // รหัสสถานะแอป (APP_READ_ONLY ฯลฯ) ต้องแปลผ่าน errorToast — `err.message` เป็นประโยค
  // default ภาษาอังกฤษของ gateway
  const toastMutationError = (err: unknown, fallback: string) => {
    if (err instanceof ApiError && isAppStatusErrorCode(err.appCode)) {
      errorToast(err);
      return;
    }
    toast.error(err instanceof Error ? err.message : fallback);
  };
  const buCode = useBuCode();
  const queryClient = useQueryClient();

  // Queries
  const groupQuery = useGlAccountGroups();
  const accountsQuery = useChartOfAccountAll();
  const updateAccount = useUpdateChartOfAccount();

  const groups = useMemo(() => groupQuery.data ?? [], [groupQuery.data]);
  const accounts = useMemo(() => accountsQuery.data ?? [], [accountsQuery.data]);
  const isLoading = groupQuery.isLoading || accountsQuery.isLoading;

  const [search, setSearch] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Modals state
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<"add" | "edit">("add");
  const [editingNode, setEditingNode] = useState<AccountGroupNode | null>(null);
  const [defaultParentNode, setDefaultParentNode] = useState<AccountGroupNode | null>(null);
  const [targetLevel, setTargetLevel] = useState<GroupTreeLevel>(1);

  const [moveOpen, setMoveOpen] = useState(false);
  const [movingNode, setMovingNode] = useState<AccountGroupNode | null>(null);

  const [assignOpen, setAssignOpen] = useState(false);

  const [warningOpen, setWarningOpen] = useState(false);
  const [warningNode, setWarningNode] = useState<AccountGroupNode | null>(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deletingNode, setDeletingNode] = useState<AccountGroupNode | null>(null);

  const [isMutating, setIsMutating] = useState(false);

  // Tree Hook
  const {
    fullTree,
    filteredTree,
    unassignedAccounts,
    expanded,
    toggleExpand,
    expandAll,
    collapseAll,
    findNodeById,
    getBreadcrumbs,
    isDescendant,
    getMaxSubDepth,
    getNodesByLevel,
    stats,
  } = useAccountGroupingTree({ groups, accounts, search });

  // Auto select first node if none selected
  useEffect(() => {
    if (!selectedNodeId && fullTree.length > 0) {
      setSelectedNodeId(fullTree[0].id);
    }
  }, [fullTree, selectedNodeId]);

  const selectedNode = useMemo(
    () => (selectedNodeId ? findNodeById(selectedNodeId) : null),
    [selectedNodeId, findNodeById],
  );

  const breadcrumbs = useMemo(
    () => (selectedNode ? getBreadcrumbs(selectedNode) : []),
    [selectedNode, getBreadcrumbs],
  );

  // Parent choices for Add Modal
  const parentOptionsForLevel = useMemo(() => {
    if (targetLevel <= 1) return [];
    return getNodesByLevel((targetLevel - 1) as GroupTreeLevel);
  }, [targetLevel, getNodesByLevel]);

  // Handler: Add Group (Top Header or Sub-group button)
  const handleOpenAdd = (parent: AccountGroupNode | null = null, defaultLvl: GroupTreeLevel = 1) => {
    if (parent) {
      // BR-GRP-004: If chosen parent has assigned accounts, block and show Warning Modal!
      if (parent.assignedAccounts && parent.assignedAccounts.length > 0) {
        setWarningNode(parent);
        setWarningOpen(true);
        return;
      }
      const nextLvl = Math.min(parent.level + 1, 4) as GroupTreeLevel;
      setTargetLevel(nextLvl);
      setDefaultParentNode(parent);
    } else {
      setTargetLevel(defaultLvl);
      setDefaultParentNode(null);
    }
    setFormMode("add");
    setEditingNode(null);
    setFormOpen(true);
  };

  const handleOpenEdit = (node: AccountGroupNode) => {
    setFormMode("edit");
    setEditingNode(node);
    setDefaultParentNode(null);
    setTargetLevel(node.level);
    setFormOpen(true);
  };

  const handleOpenMove = (node: AccountGroupNode) => {
    setMovingNode(node);
    setMoveOpen(true);
  };

  const handleOpenDelete = (node: AccountGroupNode) => {
    if (node.children && node.children.length > 0) {
      toast.error(t("delete.hasChildren"));
      return;
    }
    if (node.assignedAccounts && node.assignedAccounts.length > 0) {
      toast.error(t("delete.hasAccounts"));
      return;
    }
    setDeletingNode(node);
    setDeleteOpen(true);
  };

  // Submit Add / Edit Group
  const handleFormSubmit = async (data: {
    code: string;
    name: string;
    name_local?: string;
    level: GroupTreeLevel;
    parent_id: string | null;
    category: AccountCategory;
    sort_order?: number;
  }) => {
    if (!buCode || isMutating) return;
    setIsMutating(true);
    try {
      const url = API_ENDPOINTS.GL_ACCOUNT_GROUPS(buCode);
      const isEdit = formMode === "edit" && editingNode;

      const payload = {
        code: data.code,
        name: data.name,
        name_local: data.name_local || null,
        level: data.level,
        parent_id: data.parent_id,
        category: data.category,
        sort_order: data.sort_order ?? 0,
      };

      const res = isEdit
        ? await httpClient.put(`${url}/${editingNode.id}`, {
            ...payload,
            doc_version: editingNode.doc_version,
          })
        : await httpClient.post(url, payload);

      if (!res.ok) throw await ApiError.from(res, "Unable to save account group");

      await queryClient.invalidateQueries({ queryKey: glAccountGroupsKey(buCode) });
      toast.success(isEdit ? tt("updateSuccess", { entity: data.name }) : tt("createSuccess", { entity: data.name }));
      setFormOpen(false);
    } catch (err) {
      toastMutationError(err, "Unable to save account group");
    } finally {
      setIsMutating(false);
    }
  };

  // Submit Move Group
  const handleMoveConfirm = async (group: AccountGroupNode, targetParentId: string | null) => {
    if (!buCode || isMutating) return;
    setIsMutating(true);
    try {
      const targetParent = targetParentId ? findNodeById(targetParentId) : null;
      const newLevel = targetParent ? ((targetParent.level + 1) as GroupTreeLevel) : (1 as GroupTreeLevel);

      const url = `${API_ENDPOINTS.GL_ACCOUNT_GROUPS(buCode)}/${group.id}`;
      const res = await httpClient.put(url, {
        code: group.code,
        name: group.name,
        name_local: group.name_local,
        category: group.category,
        sort_order: group.sort_order,
        parent_id: targetParentId,
        level: newLevel,
        doc_version: group.doc_version,
      });

      if (!res.ok) throw await ApiError.from(res, "Unable to move account group");

      await queryClient.invalidateQueries({ queryKey: glAccountGroupsKey(buCode) });
      toast.success(`Group [${group.code}] moved successfully`);
      setMoveOpen(false);
    } catch (err) {
      toastMutationError(err, "Unable to move account group");
    } finally {
      setIsMutating(false);
    }
  };

  // Submit Assign Account to Leaf Group
  const handleAssignAccount = async (account: ChartOfAccount) => {
    if (!selectedNode || isMutating) return;
    setIsMutating(true);
    try {
      const nodeBreadcrumbs = getBreadcrumbs(selectedNode);
      const groupingPath = nodeBreadcrumbs.map((b) => ({
        code: b.code,
        name: b.name,
        level: b.level,
      }));

      await updateAccount.mutateAsync({
        id: account.id,
        doc_version: account.doc_version,
        code: account.code,
        description_1: account.description_1,
        description_2: account.description_2 ?? null,
        // dialog ให้เลือกเฉพาะบัญชีหมวดเดียวกับกลุ่มอยู่แล้ว — ?? กันแค่ type ของบัญชีเก่าที่ยัง null
        category: account.category ?? selectedNode.category,
        nature: account.nature,
        type: account.type,
        is_active: account.is_active,
        account_group_id: selectedNode.id,
        grouping_path: groupingPath,
        allowed_departments: account.allowed_departments ?? null,
        department_required: Boolean(account.department_required),
        allowed_dimensions: account.allowed_dimensions ?? null,
        dimension_required: Boolean(account.dimension_required),
        attributes: account.attributes ?? null,
        manual_posting_allowed: account.manual_posting_allowed,
        control_account_type: account.control_account_type ?? null,
      });

      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CHART_OF_ACCOUNTS] });
      await accountsQuery.refetch();
      toast.success(`Account [${account.code}] assigned to group [${selectedNode.code}]`);
      setAssignOpen(false);
    } catch (err) {
      toastMutationError(err, "Unable to assign account");
    } finally {
      setIsMutating(false);
    }
  };

  // Submit Unassign Account
  const handleUnassignAccount = async (account: ChartOfAccount) => {
    if (isMutating) return;
    // บัญชีเก่าที่ category ยัง null — backend ปฏิเสธการแก้จนกว่าจะระบุหมวด ไม่เดาหมวดให้เงียบ ๆ
    const category = account.category;
    if (!category) {
      toast.error(`Account [${account.code}] has no category — set it on the account first`);
      return;
    }
    setIsMutating(true);
    try {
      await updateAccount.mutateAsync({
        id: account.id,
        doc_version: account.doc_version,
        code: account.code,
        description_1: account.description_1,
        description_2: account.description_2 ?? null,
        category,
        nature: account.nature,
        type: account.type,
        is_active: account.is_active,
        account_group_id: null,
        grouping_path: null,
        allowed_departments: account.allowed_departments ?? null,
        department_required: Boolean(account.department_required),
        allowed_dimensions: account.allowed_dimensions ?? null,
        dimension_required: Boolean(account.dimension_required),
        attributes: account.attributes ?? null,
        manual_posting_allowed: account.manual_posting_allowed,
        control_account_type: account.control_account_type ?? null,
      });

      await queryClient.invalidateQueries({ queryKey: [QUERY_KEYS.CHART_OF_ACCOUNTS] });
      await accountsQuery.refetch();
      toast.success(`Account [${account.code}] unassigned successfully`);
    } catch (err) {
      toastMutationError(err, "Unable to unassign account");
    } finally {
      setIsMutating(false);
    }
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!buCode || !deletingNode || isMutating) return;
    setIsMutating(true);
    try {
      const url = `${API_ENDPOINTS.GL_ACCOUNT_GROUPS(buCode)}/${deletingNode.id}`;
      const res = await httpClient.delete(url);
      if (!res.ok) throw await ApiError.from(res, "Unable to delete account group");

      await queryClient.invalidateQueries({ queryKey: glAccountGroupsKey(buCode) });
      toast.success(tt("deleteSuccess", { entity: deletingNode.name }));
      if (selectedNodeId === deletingNode.id) {
        setSelectedNodeId(null);
      }
      setDeleteOpen(false);
      setDeletingNode(null);
    } catch (err) {
      toastMutationError(err, "Unable to delete account group");
    } finally {
      setIsMutating(false);
    }
  };

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      actions={
        <DocumentListActions
          onAdd={() => handleOpenAdd(null, 1)}
          addLabel={t("add")}
          hideExportPrint
        />
      }
      toolbar={
        <div className="w-full">
          <SearchInput
            defaultValue={search}
            onSearch={setSearch}
            onInputChange={setSearch}
            placeholder={t("searchPlaceholder")}
          />
        </div>
      }
    >
      {/* Summary KPI Counters Bar */}
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-2.5 px-1 py-1 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground/80">
            {t("totalGroups")}: {stats.total}
          </span>
          <span className="text-border">|</span>
          <span>L1: {stats.l1}</span>
          <span className="text-border">|</span>
          <span>L2: {stats.l2}</span>
          <span className="text-border">|</span>
          <span>L3: {stats.l3}</span>
          <span className="text-border">|</span>
          <span>L4: {stats.l4}</span>
          <span className="text-border">|</span>
          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
            {t("assignedAccounts")}: {stats.assignedCount}
          </span>
          <span className="text-border">|</span>
          <span className="text-amber-700 dark:text-amber-400 font-medium">
            {t("unassignedAccounts")}: {stats.unassignedCount}
          </span>
        </div>
      )}

      {/* Main Workspace Split Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[calc(100vh-17.5rem)] min-h-[500px]">
        {/* LEFT 7 COLS: TREE VIEW NAVIGATION PANEL */}
        <div className="lg:col-span-7 flex flex-col rounded-lg border bg-card shadow-xs overflow-hidden">
          {/* Header Row */}
          <div className="flex h-11 items-center justify-between border-b bg-muted/40 px-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            <div className="flex items-center gap-1.5">
              <FolderTree className="size-4 text-primary" />
              <span>{t("groupHierarchy")}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button onClick={expandAll} size="sm" variant="ghost" className="text-xs gap-1.5">
                <ChevronDown className="size-3.5" />
                <span>{t("expandAll")}</span>
              </Button>
              <Button onClick={collapseAll} size="sm" variant="ghost" className="text-xs gap-1.5">
                <ChevronUp className="size-3.5" />
                <span>{t("collapseAll")}</span>
              </Button>
            </div>
          </div>

          {/* Tree Scrollable Content */}
          <ScrollArea className="flex-1 p-2.5">
            {filteredTree.length > 0 ? (
              <div className="space-y-0.5">
                {filteredTree.map((node) => (
                  <AccountGroupTreeNode
                    key={node.id}
                    node={node}
                    level={0}
                    selectedNodeId={selectedNodeId}
                    expanded={expanded}
                    toggleExpand={toggleExpand}
                    onSelect={(n) => setSelectedNodeId(n.id)}
                    onAddSubGroup={(n) => handleOpenAdd(n)}
                    onMoveGroup={handleOpenMove}
                    onEditGroup={handleOpenEdit}
                    onDeleteGroup={handleOpenDelete}
                    search={search}
                  />
                ))}
              </div>
            ) : (
              <div className="flex h-40 flex-col items-center justify-center text-xs text-muted-foreground">
                <FolderTree className="size-8 opacity-20 mb-2" />
                <span>{search ? "No matching account groups found" : "No account groups configured yet"}</span>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* RIGHT 5 COLS: DETAIL & ASSIGNED ACCOUNTS PANEL */}
        <div className="lg:col-span-5 flex flex-col rounded-lg border bg-card shadow-xs overflow-hidden">
          <AccountGroupDetailPanel
            selectedNode={selectedNode}
            breadcrumbs={breadcrumbs}
            onAddSubGroup={(n) => handleOpenAdd(n)}
            onMoveGroup={handleOpenMove}
            onEditGroup={handleOpenEdit}
            onDeleteGroup={handleOpenDelete}
            onOpenAssignDialog={() => setAssignOpen(true)}
            onUnassignAccount={handleUnassignAccount}
          />
        </div>
      </div>

      {/* MODALS */}
      <AccountGroupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={formMode}
        initialNode={editingNode}
        defaultParentNode={defaultParentNode}
        parentOptions={parentOptionsForLevel}
        onLevelChange={setTargetLevel}
        onSubmit={handleFormSubmit}
        isPending={isMutating}
      />

      <AccountGroupMoveDialog
        open={moveOpen}
        onOpenChange={setMoveOpen}
        targetGroup={movingNode}
        fullTree={fullTree}
        isDescendant={isDescendant}
        getMaxSubDepth={getMaxSubDepth}
        onConfirmMove={handleMoveConfirm}
        isPending={isMutating}
      />

      <AccountGroupAssignDialog
        open={assignOpen}
        onOpenChange={setAssignOpen}
        targetGroup={selectedNode}
        unassignedAccounts={unassignedAccounts}
        onAssign={handleAssignAccount}
        isPending={isMutating}
      />

      <AccountGroupUnassignWarningDialog
        open={warningOpen}
        onOpenChange={setWarningOpen}
        targetGroup={warningNode}
      />

      <DeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={t("delete.title")}
        description={
          deletingNode
            ? t("delete.confirm", { name: deletingNode.name, code: deletingNode.code })
            : ""
        }
        onConfirm={handleConfirmDelete}
        isPending={isMutating}
      />
    </ListPageShell>
  );
}
