import { useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronDown, ChevronUp, Download, Printer } from "lucide-react";
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
import {
  applyCascadeDecision,
  type CascadeDecision,
  type CascadePayload,
} from "./cascade-changes";
import TreeContent from "./tree-content";
import { TreeColumnsHeader } from "./tree-columns";
import { ListPageShell } from "@/components/share/list-page-shell";
import { DocumentListActions } from "@/components/share/document-list-actions";
import { CategoryReportDialog } from "./category-report-dialog";
import { useCategoryReport } from "./use-category-report";

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
  // Product Category Report — Print / Export เปิด dialog ช่วงรหัสเดียวกัน ต่างกันแค่ปุ่มยืนยัน
  const [reportMode, setReportMode] = useState<"print" | "export" | null>(null);
  const categoryReport = useCategoryReport();

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
  const selfMatches = (node: CategoryNode, q: string): boolean =>
    node.code.toLowerCase().includes(q) ||
    node.name.toLowerCase().includes(q) ||
    (node.description?.toLowerCase().includes(q) ?? false);
  const nodeMatches = (node: CategoryNode, q: string): boolean =>
    selfMatches(node, q) ||
    (node.children?.some((c) => nodeMatches(c, q)) ?? false);

  const filteredData = (() => {
    if (!search) return categoryData;
    const q = search.toLowerCase();
    return categoryData.filter((cat) => nodeMatches(cat, q));
  })();

  const { searchExpanded, matchCount } = (() => {
    const result: Record<string, boolean> = {};
    if (!search) return { searchExpanded: result, matchCount: 0 };
    const q = search.toLowerCase();
    let count = 0;
    const walk = (nodes: CategoryNode[]) => {
      for (const node of nodes) {
        if (selfMatches(node, q)) count++;
        if (nodeMatches(node, q)) result[node.id] = true;
        if (node.children?.length) walk(node.children);
      }
    };
    walk(filteredData);
    return { searchExpanded: result, matchCount: count };
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

  const handleFormSubmit = (
    formData: CategoryFormValues,
    decision?: CascadeDecision,
  ) => {
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
        // edit ต้องผ่าน applyCascadeDecision เสมอ — backend ถือ cascade_deviation=true เมื่อไม่ส่ง
        // (ห้าม spread data ซ้ำ: deviation ที่ไม่เปลี่ยนถูกลบออกจาก payload โดยตั้งใจ)
        // cast: Partial ของ helper มาจาก delete key deviation ที่ DTO ฝั่ง update รับเป็น optional จริง
        ...(applyCascadeDecision(data, decision) as typeof data &
          CascadePayload),
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
          extraActions={
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReportMode("export")}
              >
                <Download aria-hidden="true" />
                {tc("export")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReportMode("print")}
              >
                <Printer aria-hidden="true" />
                {tc("print")}
              </Button>
            </>
          }
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
      {/* Tree */}
      <div className="bg-card rounded-md border">
        {/* Header row — สถิติทั้งต้นไม้ หรือจำนวนที่ค้นเจอระหว่างค้นหา */}
        <div className="text-muted-foreground flex h-9 items-center justify-between gap-2 border-b px-3 text-xs">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap tabular-nums">
            {isLoading ? null : search ? (
              <span className="text-foreground/80 font-semibold">
                {t("nMatches", { count: matchCount })}
              </span>
            ) : (
              <>
                <span className="text-foreground/80 font-semibold">
                  {t("nItems", { count: stats.total })}
                </span>
                <span className="text-border hidden sm:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden sm:inline">
                  {t("nCategories", { count: stats.cats })}
                </span>
                <span className="text-border hidden sm:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden sm:inline">
                  {t("nSubcategories", { count: stats.subs })}
                </span>
                <span className="text-border hidden sm:inline" aria-hidden>
                  ·
                </span>
                <span className="hidden sm:inline">
                  {t("nItemGroups", { count: stats.igs })}
                </span>
              </>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
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

        {/* Radix ห่อ viewport ด้วย display:table ซึ่งกว้างตามเนื้อหา ทำให้แถวล้นออกนอก
            viewport และปุ่มลบท้ายแถวโดนตัด — บังคับเป็น block ให้แถวกว้างเท่ากล่อง */}
        <ScrollArea className="h-[calc(100vh-21rem-1.5rem)] sm:h-[calc(100vh-11rem-1.5rem)] [&_[data-slot=scroll-area-viewport]>div]:block!">
          {!isLoading && filteredData.length > 0 && <TreeColumnsHeader />}
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

      <CategoryReportDialog
        open={reportMode !== null}
        onOpenChange={(open) => !open && setReportMode(null)}
        mode={reportMode ?? "print"}
        categories={catData ?? []}
        subCategories={subData ?? []}
        itemGroups={igData ?? []}
        busy={categoryReport.isBusy}
        onSubmit={
          reportMode === "export"
            ? categoryReport.exportReport
            : categoryReport.printReport
        }
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
