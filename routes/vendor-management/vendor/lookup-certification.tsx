import { useState } from "react";
import { useTranslations } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import {
  ACTIVE_ONLY_FILTER,
  useLookupPagination,
} from "@/hooks/use-lookup-pagination";
import type { Certification } from "@/types/certification";
import { useCertification } from "../shared/use-certification";

interface LookupCertificationProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (cert: Certification) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly error?: string;
  /** อยู่ใน Dialog — ให้ popover เลื่อนด้วยล้อเมาส์ได้ */
  readonly modal?: boolean;
}

/**
 * master certificate — ค้นที่ server โหลดทีละหน้า · certificate ที่ผูกไว้แม้ master
 * ถูกปิดใช้งานแล้วยังขึ้นชื่อ (ดึงตาม id) ไม่งั้นช่องว่างแล้วติด required จน Save ไม่ได้
 */
export function LookupCertification({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  error,
  modal,
}: LookupCertificationProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupPagination<Certification>({
      useListHook: useCertification,
      search,
      serverFilter: ACTIVE_ONLY_FILTER,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="certification"
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
      placeholder={placeholder ?? tl("select", { entity: tfl("certificate") })}
      searchPlaceholder={tl("search", { entity: tfl("certificate") })}
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
