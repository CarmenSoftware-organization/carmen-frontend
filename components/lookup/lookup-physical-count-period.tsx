import { useState } from "react";
import { useTranslations } from "use-intl";
import { usePhysicalCountPeriod } from "@/hooks/use-physical-count-period";
import { useLookupPagination } from "@/hooks/use-lookup-pagination";
import { formatDate } from "@/lib/date-utils";
import type { PhysicalCountPeriod } from "@/types/physical-count-period";
import { LookupCombobox } from "./lookup-combobox";

interface LookupPhysicalCountPeriodProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (item: PhysicalCountPeriod) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

function formatPeriodLabel(period: PhysicalCountPeriod): string {
  const inv = period.tb_inventory_period;
  if (!inv) return period.id;
  const from = formatDate(inv.start_at, "DD MMM YYYY");
  const to = formatDate(inv.end_at, "DD MMM YYYY");
  return `${from} — ${to}`;
}

export function LookupPhysicalCountPeriod({
  value,
  onValueChange,
  onItemChange,
  disabled,
  placeholder,
  className,
  size,
  error,
}: LookupPhysicalCountPeriodProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกดึงตาม id แยก (selectedIds)
  const [hasOpened, setHasOpened] = useState(false);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupPagination<PhysicalCountPeriod>({
      useListHook: usePhysicalCountPeriod,
      // search ของ endpoint ไม่ครอบเลขงวด/วันที่ (ได้ 0 แถว) — ค้นในรายการที่โหลดมาแทน
      search: "",
      // ห้ามส่ง is_active (400) · เรียงงวดล่าสุดก่อนที่ server
      sort: "tb_inventory_period.start_at:desc",
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
      // ซ่อนงวดที่ยังไม่เริ่ม (ค่าที่เลือกไว้ผ่านเสมอ)
      // แถวที่ไม่มี relation tb_inventory_period ตัดทิ้ง (ค่าที่เลือกไว้ยังผ่านเสมอ)
      filter: (p) =>
        !!p.tb_inventory_period &&
        new Date(p.tb_inventory_period.start_at) <= today,
    });

  return (
    <LookupCombobox
      resizeKey="physical-count-period"
      size={size}
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
      getId={(p) => p.id}
      getLabel={formatPeriodLabel}
      getSearchValue={(p) =>
        `${p.tb_inventory_period?.period ?? ""} ${formatPeriodLabel(p)}`
      }
      placeholder={
        placeholder ?? tl("select", { entity: tfl("physicalCountPeriod") })
      }
      searchPlaceholder={tl("search", { entity: tfl("physicalCountPeriod") })}
      disabled={disabled}
      className={className}
      isLoading={isLoading}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      error={error}
    />
  );
}
