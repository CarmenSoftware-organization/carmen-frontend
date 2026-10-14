import { useEffect, useState } from "react";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { useCostCenterGroup } from "@/routes/config/shared/use-cost-center-group";
import type { CostCenterGroup } from "@/types/cost-center-group";

interface LookupCostCenterGroupProps {
  readonly value: string | null;
  readonly onValueChange: (id: string | null) => void;
  /** ชื่อ group เดิมจาก list response — กันช่องว่างเมื่อ group ถูกปิดใช้ */
  readonly defaultLabel?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  /** แจ้งผู้เรียกว่าไม่มี group active เลย (โหลดเสร็จแล้ว) — ต้องเป็นฟังก์ชันอ้างอิงคงที่ */
  readonly onEmptyChange?: (empty: boolean) => void;
}

/** เลือกกลุ่มศูนย์ต้นทุน (เฉพาะที่ active) — ใช้ใน dialog ของหน้า cost center เท่านั้น */
export function LookupCostCenterGroup({
  value,
  onValueChange,
  defaultLabel,
  disabled,
  error,
  onEmptyChange,
}: LookupCostCenterGroupProps) {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCostCenterGroup({
    perpage: 100,
    search: search || undefined,
    filter: "is_active|bool:true",
  });
  const items = data?.data ?? [];
  const empty = !isLoading && !search && items.length === 0;

  useEffect(() => {
    onEmptyChange?.(empty);
  }, [empty, onEmptyChange]);

  return (
    <LookupCombobox<CostCenterGroup>
      value={value ?? ""}
      onValueChange={(id) => onValueChange(id || null)}
      items={items}
      getId={(g) => g.id}
      getLabel={(g) => `${g.code} · ${g.name}`}
      getSearchValue={(g) => `${g.code} ${g.name}`}
      defaultLabel={defaultLabel}
      isLoading={isLoading}
      onSearchChange={setSearch}
      serverSideSearch
      disabled={disabled}
      error={error}
      modal
    />
  );
}
