import { useState } from "react";
import { useTranslations } from "use-intl";
import { PackageSearch } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocationPairProducts } from "@/hooks/use-location-pair-products";
import { useLookupPagination } from "@/hooks/use-lookup-pagination";
import type { LookupListParams } from "@/hooks/use-entities-by-ids";
import type { LocationPairProduct } from "@/types/product";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupLocationPairProductProps {
  readonly fromLocationId: string;
  readonly toLocationId: string;
  readonly workflowId: string;
  readonly value: string;
  readonly onValueChange: (
    value: string,
    product?: LocationPairProduct,
  ) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly excludeIds?: string[];
  readonly popoverWidth?: string;
  readonly modal?: boolean;
  readonly defaultLabel?: string;
  readonly error?: string;
  readonly nextFocusRef?: React.RefObject<HTMLElement | null>;
}

/**
 * Lookup Popover สำหรับเลือกสินค้าที่มีอยู่ใน location ทั้งต้นทางและปลายทาง (Store Requisition)
 *
 * ใช้ `useLocationPairProducts(fromLocationId, toLocationId, workflowId)` เพื่อดึงเฉพาะ
 * สินค้าที่มีในทั้งสอง location และอยู่ในชุดสินค้าที่ workflow นั้นเลือกไว้ พร้อม
 * server-side search และ infinite scroll (perpage 30) disabled เมื่อคลังต้นทาง/ปลายทาง
 * หรือ workflow ยังไม่ครบ รองรับ `excludeIds` กัน duplicate ใน item list
 *
 * @param value - product_id ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่ง id และ object LocationPairProduct
 * @returns JSX popover element ของ location pair product lookup
 * @example
 * ```tsx
 * <Controller name="product_id" control={control} render={({ field }) => (
 *   <LookupLocationPairProduct
 *     fromLocationId={fromId}
 *     toLocationId={toId}
 *     workflowId={workflowId}
 *     value={field.value}
 *     onValueChange={field.onChange}
 *   />
 * )} />
 * ```
 */
export function LookupLocationPairProduct({
  fromLocationId,
  toLocationId,
  workflowId,
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  excludeIds,
  popoverWidth = "w-[26.25rem]",
  modal,
  defaultLabel,
  error,
  nextFocusRef,
}: LookupLocationPairProductProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");

  const excludedSet = excludeIds ? new Set(excludeIds) : undefined;

  const useListHook = (
    params: LookupListParams,
    options?: { enabled?: boolean },
  ) =>
    useLocationPairProducts(
      fromLocationId || undefined,
      toLocationId || undefined,
      workflowId || undefined,
      params,
      options,
    );

  const {
    items: products,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupPagination<LocationPairProduct>({
    useListHook,
    getId: (p) => p.product_id,
    search,
    resetDeps: [fromLocationId, toLocationId, workflowId],
    // แถวเป็นของตาราง product_location — ดึงตาม `product_id` (`id` ได้ 0 แถว)
    selectedIds: value ? [value] : [],
    idFilterKey: "product_id",
    filter: excludedSet ? (p) => !excludedSet.has(p.product_id) : undefined,
  });

  return (
    <LookupCombobox
      resizeKey="location-pair-product"
      size={size}
      value={value}
      onValueChange={onValueChange}
      items={products}
      selectedItems={selectedItems}
      getId={(p) => p.product_id}
      getLabel={(p) => `${p.product_code} — ${p.product_name}`}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      renderItem={(p) => (
        <>
          <Badge size="xs" variant="secondary" className="shrink-0">
            {p.product_code}
          </Badge>
          <span className="flex-1 truncate text-left">{p.product_name}</span>
        </>
      )}
      placeholder={placeholder ?? tl("select", { entity: tfl("product") })}
      searchPlaceholder={tl("search", { entity: tfl("product") })}
      disabled={disabled || !fromLocationId || !toLocationId || !workflowId}
      className={cn("w-full", className)}
      popoverWidth={popoverWidth}
      popoverAlign="start"
      emptyIcon={PackageSearch}
      // ค้นแล้วไม่เจอ กับ "คลังคู่นี้ไม่มีของที่เวิร์กโฟลว์นี้ให้เบิกเลย" คนละเรื่องกัน
      // และผู้ใช้แก้คนละวิธี — อันแรกลบคำค้น อันหลังต้องไปเปลี่ยนคลัง/เวิร์กโฟลว์
      emptyTitle={
        search
          ? tl("noFound", { entity: tfl("product") })
          : tl("noProductInScope")
      }
      emptyDescription={search ? tl("noFoundDesc") : tl("noProductInScopeDesc")}
      isLoading={isLoading}
      modal={modal}
      defaultLabel={defaultLabel}
      error={error}
      nextFocusRef={nextFocusRef}
    />
  );
}
