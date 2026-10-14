import { useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, ChevronUp, FolderTree } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import SearchInput from "@/components/search-input";
import {
  useCategoryAll,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/use-category";
import {
  useSubCategoryAll,
  useCreateSubCategory,
  useUpdateSubCategory,
  useDeleteSubCategory,
} from "@/hooks/use-sub-category";
import {
  useItemGroupAll,
  useCreateItemGroup,
  useUpdateItemGroup,
  useDeleteItemGroup,
} from "@/hooks/use-item-group";
import { NODE_TYPE, type CategoryNode } from "@/types/category";
import { useCategoryTree } from "./use-category-tree";
import { useCategoryDialog } from "./use-category-dialog";
import { CategoryDialog } from "./category-dialog";
import {
  buildAccountCodesPayload,
  type CategoryFormValues,
} from "./category-form-schema";
import { useNodeAccountCodes } from "./use-node-account-codes";
import TreeContent from "./tree-content";
import { ListPageShell } from "@/components/share/list-page-shell";
import { DocumentListActions } from "@/components/share/document-list-actions";

export default function CategoryComponent() {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const tt = useTranslations("toast");
  const td = useTranslations("delete");

  const NODE_LABELS: Record<string, string> = {
    [NODE_TYPE.CATEGORY]: t("nodeCategory"),
    [NODE_TYPE.SUBCATEGORY]: t("nodeSubcategory"),
    [NODE_TYPE.ITEM_GROUP]: t("nodeItemGroup"),
  };

  // `?search=` ตั้งค่าเริ่มต้นของช่องค้นหา — หน้า chart of account mapping ลิงก์มาพร้อมรหัส item group
  // ที่ยังไม่มีบัญชี ให้ต้นไม้กางไปถึงโหนดนั้นเลย (อ่านครั้งเดียวตอน mount ไม่ sync กลับ URL)
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [deleteTarget, setDeleteTarget] = useState<CategoryNode | null>(null);

  // Data
  const { data: catData, isLoading: catLoading } = useCategoryAll();
  const { data: subData, isLoading: subLoading } = useSubCategoryAll();
  const { data: igData, isLoading: igLoading } = useItemGroupAll();
  const isLoading = catLoading || subLoading || igLoading;

  // Mutations
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const createSubCategory = useCreateSubCategory();
  const updateSubCategory = useUpdateSubCategory();
  const deleteSubCategory = useDeleteSubCategory();
  const createItemGroup = useCreateItemGroup();
  const updateItemGroup = useUpdateItemGroup();
  const deleteItemGroup = useDeleteItemGroup();

  const isMutating =
    createCategory.isPending ||
    updateCategory.isPending ||
    createSubCategory.isPending ||
    updateSubCategory.isPending ||
    createItemGroup.isPending ||
    updateItemGroup.isPending;

  const isDeleting =
    deleteCategory.isPending ||
    deleteSubCategory.isPending ||
    deleteItemGroup.isPending;

  // Tree
  const { categoryData, expanded, expandAll, collapseAll, toggleExpand } =
    useCategoryTree({
      categories: catData ?? [],
      subCategories: subData ?? [],
      itemGroups: igData ?? [],
      isLoading,
    });

  // Search
  const nodeMatches = (node: CategoryNode, q: string): boolean => {
    const self =
      node.code.toLowerCase().includes(q) ||
      node.name.toLowerCase().includes(q) ||
      (node.description?.toLowerCase().includes(q) ?? false);
    if (self) return true;
    return node.children?.some((c) => nodeMatches(c, q)) ?? false;
  };

  const filteredData = (() => {
    if (!search) return categoryData;
    const q = search.toLowerCase();
    return categoryData.filter((cat) => nodeMatches(cat, q));
  })();

  const searchExpanded = (() => {
    if (!search) return {};
    const q = search.toLowerCase();
    const result: Record<string, boolean> = {};
    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        if (nodeMatches(node, q)) result[node.id] = true;
        if (node.children?.length) walk(node.children);
      }
    };
    walk(filteredData);
    return result;
  })();

  // Stats
  const stats = (() => {
    const cats = catData?.length ?? 0;
    const subs = subData?.length ?? 0;
    const igs = igData?.length ?? 0;
    return { cats, subs, igs, total: cats + subs + igs };
  })();

  // Dialog
  const {
    open: dialogOpen,
    mode: dialogMode,
    selectedNode: listSelectedNode,
    parentNode: listParentNode,
    handleOpenChange,
    handleEdit,
    handleAdd,
  } = useCategoryDialog({ categoryData, onSubmit: () => {} });

  // account_codes มาจาก GET รายตัวเท่านั้น (list ไม่ส่ง) — โหลดของ node ที่แก้
  // และของบรรพบุรุษ (ใช้ทำ placeholder "สืบทอดจาก…") แล้วเติมกลับเข้า node
  const grandParentNode =
    listParentNode?.type === NODE_TYPE.SUBCATEGORY
      ? categoryData.find((c) => c.id === listParentNode.product_category_id)
      : undefined;
  const selectedCodes = useNodeAccountCodes(
    dialogOpen && dialogMode === "edit" ? listSelectedNode : undefined,
  );
  const parentCodes = useNodeAccountCodes(
    dialogOpen ? listParentNode : undefined,
  );
  const grandParentCodes = useNodeAccountCodes(
    dialogOpen ? grandParentNode : undefined,
  );
  const withCodes = (
    node: CategoryNode | undefined,
    codes: CategoryNode["account_codes"],
  ): CategoryNode | undefined =>
    node && codes ? { ...node, account_codes: codes } : node;
  const selectedNode = withCodes(listSelectedNode, selectedCodes.codes);
  const parentNode = withCodes(listParentNode, parentCodes.codes);
  const ancestors = [
    parentNode,
    withCodes(grandParentNode, grandParentCodes.codes),
  ].filter((n): n is CategoryNode => !!n);
  // โหมด edit ที่โหลด account_codes ของตัวเองไม่สำเร็จ → ห้ามส่ง account_codes
  // (เทียบกับ [] จะกลายเป็น add ซ้ำชนิดเดิม)
  const accountCodesUnavailable =
    dialogMode === "edit" && !!listSelectedNode && !selectedCodes.codes;

  const handleFormSubmit = (formData: CategoryFormValues) => {
    const isEdit = dialogMode === "edit";
    const { inventory_account_code, direct_account_code, ...rest } = formData;
    const account_codes =
      isEdit && accountCodesUnavailable
        ? undefined
        : buildAccountCodesPayload(
            isEdit ? (selectedNode?.account_codes ?? []) : [],
            { inventory: inventory_account_code, direct: direct_account_code },
          );
    const data = { ...rest, ...(account_codes ? { account_codes } : {}) };
    const ok = () => handleOpenChange(false);
    const opts = (label: string) => ({
      onSuccess: () => {
        toast.success(
          isEdit
            ? tt("updateSuccess", { entity: label })
            : tt("createSuccess", { entity: label }),
        );
        ok();
      },
    });

    if (isEdit && selectedNode) {
      // doc_version round-trips the loaded record's version — backend requires
      // it on update for optimistic concurrency (omitting it returns 400).
      const payload = {
        id: selectedNode.id,
        doc_version: selectedNode.doc_version,
        ...data,
      };
      const label = NODE_LABELS[selectedNode.type];
      const actions = {
        [NODE_TYPE.CATEGORY]: () => updateCategory.mutate(payload, opts(label)),
        [NODE_TYPE.SUBCATEGORY]: () =>
          updateSubCategory.mutate(
            {
              ...payload,
              product_category_id: data.product_category_id ?? "",
            },
            opts(label),
          ),
        [NODE_TYPE.ITEM_GROUP]: () =>
          updateItemGroup.mutate(
            {
              ...payload,
              product_subcategory_id: data.product_subcategory_id ?? "",
            },
            opts(label),
          ),
      };
      actions[selectedNode.type]();
    } else if (parentNode) {
      const childType =
        parentNode.type === NODE_TYPE.CATEGORY
          ? NODE_TYPE.SUBCATEGORY
          : NODE_TYPE.ITEM_GROUP;
      const label = NODE_LABELS[childType];
      const actions: Record<string, () => void> = {
        [NODE_TYPE.CATEGORY]: () =>
          createSubCategory.mutate(
            { ...data, product_category_id: parentNode.id },
            opts(label),
          ),
        [NODE_TYPE.SUBCATEGORY]: () =>
          createItemGroup.mutate(
            { ...data, product_subcategory_id: parentNode.id },
            opts(label),
          ),
      };
      actions[parentNode.type]?.();
    } else {
      createCategory.mutate(data, opts(NODE_LABELS[NODE_TYPE.CATEGORY]));
    }
  };

  // Delete
  const handleConfirmDelete = () => {
    if (!deleteTarget) return;
    const opts = {
      onSuccess: () => {
        toast.success(
          tt("deleteSuccess", { entity: NODE_LABELS[deleteTarget.type] }),
        );
        setDeleteTarget(null);
      },
    };
    const actions = {
      [NODE_TYPE.CATEGORY]: () => deleteCategory.mutate(deleteTarget.id, opts),
      [NODE_TYPE.SUBCATEGORY]: () =>
        deleteSubCategory.mutate(deleteTarget.id, opts),
      [NODE_TYPE.ITEM_GROUP]: () =>
        deleteItemGroup.mutate(deleteTarget.id, opts),
    };
    actions[deleteTarget.type]();
  };

  return (
    <ListPageShell
      title={t("title")}
      description={t("desc")}
      actions={
        <DocumentListActions
          onAdd={() => handleAdd()}
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
          />
        </div>
      }
    >
      {/* Summary bar */}
      {!isLoading && (
        <div className="text-muted-foreground flex items-center gap-3 px-1 py-1 text-xs">
          <span className="text-foreground/70 font-semibold">
            {t("nItems", { count: stats.total })}
          </span>
          <span className="text-border">|</span>
          <span>{t("nCategories", { count: stats.cats })}</span>
          <span className="text-border">|</span>
          <span>{t("nSubcategories", { count: stats.subs })}</span>
          <span className="text-border">|</span>
          <span>{t("nItemGroups", { count: stats.igs })}</span>
        </div>
      )}

      {/* Tree */}
      <div className="bg-card rounded-md border">
        {/* Header row */}
        <div className="bg-muted/40 text-muted-foreground text-micro-legal flex h-9 items-center justify-between border-b px-2 font-semibold tracking-wider uppercase">
          <div className="flex items-center">
            <FolderTree className="mr-1.5 h-3 w-3" />
            {t("categoryTree")}
          </div>
          <div className="flex items-center gap-1">
            <Button onClick={expandAll} size="xs" variant="ghost">
              <ChevronDown className="h-3 w-3" />
              {t("expand")}
            </Button>
            <Button onClick={collapseAll} size="xs" variant="ghost">
              <ChevronUp className="h-3 w-3" />
              {t("collapse")}
            </Button>
          </div>
        </div>

        <ScrollArea className="h-[calc(100vh-21rem-3rem)] sm:h-[calc(100vh-11rem-3rem)]">
          <TreeContent
            isLoading={isLoading}
            filteredData={filteredData}
            expanded={search ? searchExpanded : expanded}
            toggleExpand={toggleExpand}
            onEdit={handleEdit}
            onAdd={handleAdd}
            onDelete={setDeleteTarget}
            search={search}
          />
        </ScrollArea>
      </div>

      <CategoryDialog
        open={dialogOpen}
        onOpenChange={handleOpenChange}
        mode={dialogMode}
        selectedNode={selectedNode}
        parentNode={parentNode}
        ancestors={ancestors}
        accountCodesLoading={dialogMode === "edit" && selectedCodes.isLoading}
        accountCodesUnavailable={accountCodesUnavailable}
        onSubmit={handleFormSubmit}
        isPending={isMutating}
      />

      <DeleteDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}
        title={`${tc("delete")} ${NODE_LABELS[deleteTarget?.type ?? "category"]}`}
        description={td("confirmNamed", { name: deleteTarget?.name ?? "" })}
        isPending={isDeleting}
        onConfirm={handleConfirmDelete}
      />
    </ListPageShell>
  );
}
