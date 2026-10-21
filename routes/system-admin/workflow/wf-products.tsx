import { useId, useState } from "react";
import {
  ChevronRight,
  PackageSearch,
  Search,
  TriangleAlert,
} from "lucide-react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Product } from "@/types/workflows";
import type { WorkflowCreateModel } from "./wf-form-schema";
import { WfProductsTable } from "./wf-products-table";
import { cn } from "@/lib/utils";

interface TreeNode {
  id: string;
  name: string;
  type: "category" | "sub_category" | "item_group" | "product";
  children: TreeNode[];
  product?: Product;
}

type ViewMode = "all" | "selected";

// ติ๊กสินค้าต้องนับเป็นการแก้ฟอร์ม — ไม่งั้น `useUnsavedChanges` ใน wf-detail ไม่เตือนตอนออกจากหน้า
// แล้วที่ติ๊กไว้ทั้งหมดหายเงียบ ๆ
const DIRTY = { shouldDirty: true } as const;

const buildTree = (
  products: Product[],
  uncategorizedLabel: string,
): TreeNode[] => {
  const categoryMap = new Map<string, TreeNode>();

  for (const p of products) {
    const catId = p.product_category?.id ?? "uncategorized";
    const catName = p.product_category?.name ?? uncategorizedLabel;
    // id ของกิ่งเป็น path — "uncategorized" ใต้หมวดต่างกันจะได้ไม่ชนกันใน leafIdsMap/expandedIds
    // (เดิมชนกัน ติ๊กกิ่ง uncategorized ของหมวดหนึ่งแล้วไปเลือกสินค้าของอีกหมวด)
    const subCatId = `${catId}/${p.product_sub_category?.id ?? "uncategorized"}`;
    const subCatName = p.product_sub_category?.name ?? uncategorizedLabel;
    const groupId = `${subCatId}/${p.product_item_group?.id ?? "uncategorized"}`;
    const groupName = p.product_item_group?.name ?? uncategorizedLabel;

    if (!categoryMap.has(catId)) {
      categoryMap.set(catId, {
        id: catId,
        name: catName,
        type: "category",
        children: [],
      });
    }
    const catNode = categoryMap.get(catId)!;

    let subCatNode = catNode.children.find((c) => c.id === subCatId);
    if (!subCatNode) {
      subCatNode = {
        id: subCatId,
        name: subCatName,
        type: "sub_category",
        children: [],
      };
      catNode.children.push(subCatNode);
    }

    let groupNode = subCatNode.children.find((c) => c.id === groupId);
    if (!groupNode) {
      groupNode = {
        id: groupId,
        name: groupName,
        type: "item_group",
        children: [],
      };
      subCatNode.children.push(groupNode);
    }

    groupNode.children.push({
      id: p.id,
      name: p.name,
      type: "product",
      children: [],
      product: p,
    });
  }

  return Array.from(categoryMap.values());
};

/** ตัดกิ่งที่ไม่มีสินค้าผ่าน `keep` เหลือแค่เส้นทางไปหาสินค้าที่ผ่าน */
const filterTree = (
  nodes: TreeNode[],
  keep: (product: Product) => boolean,
): TreeNode[] =>
  nodes
    .map((node) => {
      if (node.type === "product") {
        return node.product && keep(node.product) ? node : null;
      }
      const children = filterTree(node.children, keep);
      return children.length === 0 ? null : { ...node, children };
    })
    .filter((n): n is TreeNode => n !== null);

interface WfProductsProps {
  readonly form: UseFormReturn<WorkflowCreateModel>;
  readonly allProducts: Product[];
  readonly isDisabled: boolean;
  readonly readOnly: boolean;
}

export function WfProducts({
  form,
  allProducts,
  isDisabled,
  readOnly,
}: WfProductsProps) {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  // โหมด Selected แสดงชุดที่เลือกไว้ "ตอนสลับเข้ามา" — ถ้ากรองจากค่าสด เอาติ๊กออกแล้วแถวหายทันที
  // กดพลาดก็ติ๊กกลับไม่ได้ แถวที่เอาออกจึงค้างอยู่ (ไม่ติ๊ก) จนกว่าจะสลับโหมด
  const [selectedSnapshot, setSelectedSnapshot] = useState<Set<string>>(
    () => new Set(),
  );
  const t = useTranslations("systemAdmin.workflow");
  const tfl = useTranslations("field");
  const uncategorizedLabel = t("uncategorized");

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const tree = buildTree(allProducts, uncategorizedLabel);
    const ids = new Set<string>();
    for (const cat of tree) {
      ids.add(cat.id);
      for (const sub of cat.children) {
        ids.add(sub.id);
      }
    }
    return ids;
  });

  const selectedProducts = useWatch({
    control: form.control,
    name: "data.products",
  });
  const selectedIds = new Set(selectedProducts ?? []);

  const tree = buildTree(allProducts, uncategorizedLabel);

  // นับ leaf ทั้งหมดกับที่เลือกแล้วของทุก node ในรอบเดียว — ตัวเลข "เลือก/ทั้งหมด" กับแถบความครอบคลุม
  // ของแต่ละกิ่งอ่านจากตรงนี้ ส่วน leafIdsMap ใช้ตอนติ๊กทั้งกิ่ง
  const leafIdsMap = new Map<string, string[]>();
  const selectedCountMap = new Map<string, number>();
  const compute = (node: TreeNode): string[] => {
    const ids =
      node.type === "product" ? [node.id] : node.children.flatMap(compute);
    leafIdsMap.set(node.id, ids);
    selectedCountMap.set(
      node.id,
      ids.filter((id) => selectedIds.has(id)).length,
    );
    return ids;
  };
  for (const cat of tree) compute(cat);

  const q = search.trim().toLowerCase();
  const matchesSearch = (p: Product) =>
    !q ||
    p.code?.toLowerCase().includes(q) ||
    p.name?.toLowerCase().includes(q) ||
    (p.local_name?.toLowerCase().includes(q) ?? false);

  // โหมดอ่าน: เอาเฉพาะสินค้าที่เลือกไว้มาลงตาราง — ต้นไม้ทั้งก้อนมีไว้ติ๊ก
  // ไม่ได้มีไว้อ่าน คนเปิดดูอยากรู้แค่ว่า workflow นี้ครอบสินค้าอะไรบ้าง
  if (readOnly) {
    const rows = allProducts.filter(
      (p) => selectedIds.has(p.id) && matchesSearch(p),
    );

    return (
      <div className="space-y-4 pt-4">
        <div className="flex items-center gap-4">
          <div className="relative max-w-sm flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
            <Input
              placeholder={t("searchProducts")}
              size="sm"
              className="pl-8"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <span className="text-muted-foreground text-xs">
            {t("nSelected", { count: selectedProducts?.length ?? 0 })}
          </span>
        </div>

        <WfProductsTable products={rows} />
      </div>
    );
  }

  const isFiltered = !!q || viewMode === "selected";
  const filteredTree = isFiltered
    ? filterTree(
        tree,
        (p) =>
          matchesSearch(p) &&
          (viewMode === "all" || selectedSnapshot.has(p.id)),
      )
    : tree;

  // select all ทำงานกับที่มองเห็น — ค้นอยู่ก็เลือก/เอาออกเฉพาะที่กรองเจอ
  // (เกณฑ์เดียวกับ checkbox ของ node กลุ่ม ที่กวาดเฉพาะ leaf ใต้กิ่งตัวเอง)
  const visibleProductIds: string[] = [];
  const walk = (nodes: TreeNode[]) => {
    for (const n of nodes) {
      if (n.type === "product") visibleProductIds.push(n.id);
      else walk(n.children);
    }
  };
  walk(filteredTree);

  const selectedVisibleCount = visibleProductIds.filter((id) =>
    selectedIds.has(id),
  ).length;
  const allVisibleSelected =
    visibleProductIds.length > 0 &&
    selectedVisibleCount === visibleProductIds.length;
  const selectAllState: boolean | "indeterminate" = allVisibleSelected
    ? true
    : selectedVisibleCount > 0
      ? "indeterminate"
      : false;

  const setSelection = (ids: string[]) =>
    form.setValue("data.products", ids, DIRTY);

  const addOrRemove = (ids: string[], remove: boolean) => {
    const current = form.getValues("data.products") ?? [];
    if (remove) {
      const removeSet = new Set(ids);
      setSelection(current.filter((id) => !removeSet.has(id)));
    } else {
      setSelection([...current, ...ids.filter((id) => !selectedIds.has(id))]);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleProduct = (id: string) => {
    if (isDisabled) return;
    addOrRemove([id], selectedIds.has(id));
  };

  const toggleGroup = (node: TreeNode) => {
    if (isDisabled) return;
    const leafIds = leafIdsMap.get(node.id) ?? [];
    addOrRemove(
      leafIds,
      leafIds.every((id) => selectedIds.has(id)),
    );
  };

  const toggleSelectAll = () => {
    if (isDisabled) return;
    addOrRemove(visibleProductIds, allVisibleSelected);
  };

  const selectedTotal = selectedProducts?.length ?? 0;

  return (
    <div className="space-y-3 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm min-w-48 flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2" />
          <Input
            placeholder={t("searchProducts")}
            size="sm"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Tabs
          value={viewMode}
          onValueChange={(v) => {
            if (v === "selected") setSelectedSnapshot(new Set(selectedIds));
            setViewMode(v as ViewMode);
          }}
        >
          <TabsList className="h-8">
            <TabsTrigger value="all" className="gap-1.5 px-2.5">
              {t("productsViewAll")}
              <span className="text-muted-foreground tabular-nums">
                {allProducts.length.toLocaleString()}
              </span>
            </TabsTrigger>
            <TabsTrigger value="selected" className="gap-1.5 px-2.5">
              {t("productsViewSelected")}
              <span className="text-muted-foreground tabular-nums">
                {selectedTotal.toLocaleString()}
              </span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {selectedTotal === 0 && allProducts.length > 0 && (
        <p
          role="status"
          className="border-warning/40 bg-warning/10 text-warning-ink flex items-start gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          {t("productsNoneSelectedWarning")}
        </p>
      )}

      <div className="overflow-hidden rounded-lg border">
        {visibleProductIds.length > 0 && (
          <label
            htmlFor="wf-products-select-visible"
            className={cn(
              "bg-muted/40 flex items-center gap-2 border-b py-2 pr-3 pl-7",
              !isDisabled && "cursor-pointer",
            )}
          >
            <Checkbox
              id="wf-products-select-visible"
              checked={selectAllState}
              onCheckedChange={toggleSelectAll}
              disabled={isDisabled}
            />
            <span className="text-muted-foreground flex-1 text-xs font-medium">
              {isFiltered
                ? t("selectShownProducts", {
                    count: visibleProductIds.length,
                  })
                : tfl("selectAll")}
            </span>
            <span className="text-muted-foreground text-xs">
              {t("productsCoverage")}
            </span>
          </label>
        )}

        <div className="max-h-[max(20rem,calc(100dvh-24rem))] overflow-y-auto py-1">
          {filteredTree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <PackageSearch className="text-muted-foreground/50 mb-2 size-6" />
              <p className="text-muted-foreground text-xs">
                {viewMode === "selected" && !q
                  ? t("productsNoneSelected")
                  : q
                    ? t("noProductsMatch")
                    : t("noProductsAvailable")}
              </p>
            </div>
          ) : (
            filteredTree.map((catNode) => (
              <TreeNodeRow
                key={catNode.id}
                node={catNode}
                depth={0}
                expandedIds={expandedIds}
                forceExpand={isFiltered}
                onToggleExpand={toggleExpand}
                onToggleProduct={toggleProduct}
                onToggleGroup={toggleGroup}
                selectedIds={selectedIds}
                isDisabled={isDisabled}
                leafIdsMap={leafIdsMap}
                selectedCountMap={selectedCountMap}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

interface TreeNodeRowProps {
  readonly node: TreeNode;
  readonly depth: number;
  readonly expandedIds: Set<string>;
  readonly forceExpand: boolean;
  readonly onToggleExpand: (id: string) => void;
  readonly onToggleProduct: (id: string) => void;
  readonly onToggleGroup: (node: TreeNode) => void;
  readonly selectedIds: Set<string>;
  readonly isDisabled: boolean;
  readonly leafIdsMap: Map<string, string[]>;
  readonly selectedCountMap: Map<string, number>;
}

const TreeNodeRow = ({
  node,
  depth,
  expandedIds,
  forceExpand,
  onToggleExpand,
  onToggleProduct,
  onToggleGroup,
  selectedIds,
  isDisabled,
  leafIdsMap,
  selectedCountMap,
}: TreeNodeRowProps) => {
  const isExpanded = forceExpand || expandedIds.has(node.id);
  const paddingLeft = depth * 20 + 8;
  const checkboxId = useId();

  if (node.type === "product") {
    const isSelected = selectedIds.has(node.id);
    const product = node.product;
    return (
      <label
        htmlFor={checkboxId}
        className={cn(
          "flex items-center gap-2 py-1.5 pr-3 transition-colors",
          isSelected && "bg-primary/5",
          !isDisabled && "hover:bg-muted/60 cursor-pointer",
        )}
        style={{ paddingLeft: paddingLeft + 20 }}
      >
        <Checkbox
          id={checkboxId}
          checked={isSelected}
          onCheckedChange={() => onToggleProduct(node.id)}
          disabled={isDisabled}
        />
        <span className="text-muted-foreground w-24 shrink-0 truncate font-mono text-xs">
          {product?.code}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs">
          {node.name}
          {product?.local_name && (
            <span className="text-muted-foreground ml-2">
              {product.local_name}
            </span>
          )}
        </span>
      </label>
    );
  }

  const total = leafIdsMap.get(node.id)?.length ?? 0;
  const selected = selectedCountMap.get(node.id) ?? 0;
  const checkState: boolean | "indeterminate" =
    selected === 0 ? false : selected === total ? true : "indeterminate";
  const coverage = total === 0 ? 0 : (selected / total) * 100;

  return (
    <>
      <div
        className="hover:bg-muted/60 flex items-center gap-2 py-1.5 pr-3"
        style={{ paddingLeft }}
      >
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground flex size-4 shrink-0 cursor-pointer items-center justify-center"
          onClick={() => onToggleExpand(node.id)}
          aria-expanded={isExpanded}
          aria-label={node.name}
        >
          <ChevronRight
            className={cn(
              "size-4 transition-transform",
              isExpanded && "rotate-90",
            )}
          />
        </button>
        <Checkbox
          id={checkboxId}
          checked={checkState}
          onCheckedChange={() => onToggleGroup(node)}
          disabled={isDisabled}
          aria-label={node.name}
        />
        <button
          type="button"
          className={cn(
            "min-w-0 flex-1 cursor-pointer truncate text-left text-xs",
            depth === 0 ? "font-semibold" : "font-medium",
          )}
          onClick={() => onToggleExpand(node.id)}
        >
          {node.name}
        </button>
        {/* เลือก/ทั้งหมด + แถบความครอบคลุม — กวาดตาก็รู้ว่าหมวดไหนเลือกครบ บางส่วน หรือยังไม่แตะ */}
        <span
          className={cn(
            "w-20 shrink-0 text-right text-xs tabular-nums",
            selected === 0
              ? "text-muted-foreground/60"
              : "text-muted-foreground",
          )}
        >
          <span className={cn(selected > 0 && "text-foreground font-medium")}>
            {selected.toLocaleString()}
          </span>
          {" / "}
          {total.toLocaleString()}
        </span>
        <span
          className="bg-muted h-1 w-16 shrink-0 overflow-hidden rounded-full"
          aria-hidden="true"
        >
          <span
            className="bg-primary block h-full rounded-full transition-[width]"
            style={{ width: `${coverage}%` }}
          />
        </span>
      </div>
      {isExpanded &&
        node.children.map((child) => (
          <TreeNodeRow
            key={child.id}
            node={child}
            depth={depth + 1}
            expandedIds={expandedIds}
            forceExpand={forceExpand}
            onToggleExpand={onToggleExpand}
            onToggleProduct={onToggleProduct}
            onToggleGroup={onToggleGroup}
            selectedIds={selectedIds}
            isDisabled={isDisabled}
            leafIdsMap={leafIdsMap}
            selectedCountMap={selectedCountMap}
          />
        ))}
    </>
  );
};
