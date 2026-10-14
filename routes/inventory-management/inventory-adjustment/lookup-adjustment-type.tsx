import { useState } from "react";
import { useTranslations } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { useAdjustmentType } from "@/hooks/use-adjustment-type";
import {
  ACTIVE_ONLY_FILTER,
  useLookupPagination,
} from "@/hooks/use-lookup-pagination";
import type { ADJUSTMENT_TYPE, AdjustmentType } from "@/types/adjustment-type";

interface LookupAdjustmentTypeProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  /** ชนิดของเอกสาร — รายการมีเฉพาะเหตุผลของชนิดนี้ (กรองที่ server) */
  readonly kind: ADJUSTMENT_TYPE;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly error?: string;
}

/**
 * เหตุผลการปรับปรุงสต็อก (adjustment type) ของใบ IA — ค้นที่ server โหลดทีละหน้า
 * ค่าที่ใบบันทึกไว้แม้ถูกปิดใช้งานแล้วยังขึ้นชื่อ (ดึงตาม id แยก ไม่ผ่าน filter active)
 */
export function LookupAdjustmentType({
  value,
  onValueChange,
  kind,
  disabled,
  placeholder,
  className,
  error,
}: LookupAdjustmentTypeProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupPagination<AdjustmentType>({
      useListHook: useAdjustmentType,
      search,
      serverFilter: `${ACTIVE_ONLY_FILTER},type|string:${kind}`,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="adjustment-type"
      allowDeselect={false}
      value={value}
      onValueChange={(id) => onValueChange(id)}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(at) => at.id}
      getLabel={(at) => at.name}
      getSearchValue={(at) => `${at.code} ${at.name}`}
      placeholder={placeholder ?? tfl("selectAdjustmentType")}
      searchPlaceholder={tl("search", { entity: tfl("adjustmentType") })}
      disabled={disabled}
      className={className}
      isLoading={isLoading}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      error={error}
    />
  );
}
