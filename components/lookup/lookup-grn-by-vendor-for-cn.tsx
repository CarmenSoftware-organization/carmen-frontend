import { useState } from "react";
import { useTranslations } from "use-intl";
import { ClipboardList } from "lucide-react";
import { useGoodsReceiveNoteByVendorForCn } from "@/hooks/use-goods-receive-note";
import { useLookupPagination } from "@/hooks/use-lookup-pagination";
import type { LookupListParams } from "@/hooks/use-entities-by-ids";
import type { GoodsReceiveNote } from "@/types/goods-receive-note";
import { Badge } from "@/components/ui/badge";
import { LookupCombobox } from "./lookup-combobox";

interface LookupGrnByVendorForCnProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (grn: GoodsReceiveNote) => void;
  readonly vendorId?: string;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
  readonly readOnly?: boolean;
  /**
   * ป้ายของ `value` ที่รู้อยู่แล้วจากเอกสาร — list โหลดทีละหน้า ค่าที่อยู่หลังหน้าแรก
   * จะหาชื่อไม่เจอแล้วขึ้น placeholder ทั้งที่มีค่าอยู่
   */
  readonly defaultLabel?: string;
}

export function LookupGrnByVendorForCn({
  value,
  onValueChange,
  onItemChange,
  vendorId,
  disabled,
  placeholder,
  className,
  size,
  error,
  readOnly,
  defaultLabel,
}: LookupGrnByVendorForCnProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");

  const useListByVendor = (
    params: LookupListParams,
    options?: { enabled?: boolean },
  ) => useGoodsReceiveNoteByVendorForCn(vendorId, params, options);

  const {
    items: grns,
    selectedItems,
    isLoading,
    isLoadingMore,
    hasMore,
    loadMore,
  } = useLookupPagination<GoodsReceiveNote>({
    useListHook: useListByVendor,
    search,
    resetDeps: [vendorId],
    // endpoint vendor/:id/cn รับ `id|string:` (probe T02) — ใบที่เลือกไว้ขึ้นเลขเสมอ
    selectedIds: value ? [value] : [],
  });

  return (
    <LookupCombobox
      resizeKey="grn-by-vendor-for-cn"
      size={size}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      items={grns}
      selectedItems={selectedItems}
      getId={(g) => g.id}
      getLabel={(g) => g.invoice_no || g.grn_no}
      defaultLabel={defaultLabel}
      getSearchValue={(g) => `${g.grn_no} ${g.invoice_no ?? ""}`}
      renderItem={(g) => (
        <>
          <Badge size="xs" variant="secondary" className="shrink-0">
            {g.grn_no}
          </Badge>
          <span className="flex-1 truncate text-left">{g.invoice_no}</span>
        </>
      )}
      renderSelected={(g) => g.grn_no}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      placeholder={placeholder ?? tl("select", { entity: tfl("grn") })}
      searchPlaceholder={tl("search", { entity: tfl("grn") })}
      disabled={disabled || !vendorId}
      isLoading={isLoading}
      className={className}
      popoverWidth="w-90"
      popoverAlign="start"
      emptyIcon={ClipboardList}
      emptyTitle={tl("noFound", { entity: tfl("grn") })}
      emptyDescription={tl("noFoundDesc")}
      error={error}
      readOnly={readOnly}
    />
  );
}
