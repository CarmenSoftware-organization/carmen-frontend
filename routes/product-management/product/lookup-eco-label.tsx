import { useState } from "react";
import { useTranslations } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import {
  ACTIVE_ONLY_FILTER,
  useLookupPagination,
} from "@/hooks/use-lookup-pagination";
import type { EcoLabel } from "@/types/eco-label";
import { useEcoLabel } from "../shared/use-eco-label";

interface LookupEcoLabelProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (label: EcoLabel) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly error?: string;
  /** อยู่ใน Dialog — ให้ popover เลื่อนด้วยล้อเมาส์ได้ */
  readonly modal?: boolean;
}

/**
 * master eco label — ค้นที่ server โหลดทีละหน้า · label ที่ผูกไว้แม้ master ถูกปิด
 * ใช้งานแล้วยังขึ้นชื่อ (ดึงตาม id) ไม่งั้นช่องว่างแล้วติด required จน Save ไม่ได้
 */
export function LookupEcoLabel({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  error,
  modal,
}: LookupEcoLabelProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupPagination<EcoLabel>({
      useListHook: useEcoLabel,
      search,
      serverFilter: ACTIVE_ONLY_FILTER,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="eco-label"
      allowDeselect={false}
      modal={modal}
      value={value}
      onValueChange={(id, item) => {
        onValueChange(id);
        if (item) onItemChange?.(item);
      }}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      getId={(c) => c.id}
      getLabel={(c) => `${c.code} · ${c.name}`}
      placeholder={placeholder ?? tl("select", { entity: tfl("ecoLabel") })}
      searchPlaceholder={tl("search", { entity: tfl("ecoLabel") })}
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
