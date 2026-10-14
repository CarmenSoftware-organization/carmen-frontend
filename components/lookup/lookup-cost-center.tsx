import { useState } from "react";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { useCostCenter, useCostCenterById } from "@/hooks/use-cost-center";
import type { CostCenter } from "@/types/cost-center";

interface LookupCostCenterProps {
  readonly value: string | null;
  readonly onValueChange: (id: string | null, item?: CostCenter) => void;
  readonly defaultLabel?: string;
  readonly disabled?: boolean;
  readonly error?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly modal?: boolean;
  readonly allowDeselect?: boolean;
}

/**
 * Lookup เลือก cost center (GL master) — ใช้ใน location form และ sheet แก้ account mapping
 *
 * Lazy: ยิงรายการเมื่อเปิด popover หรือมีค่าอยู่แล้ว; แสดงเฉพาะที่ active
 * ค่าที่เลือกไว้แต่ inactive/อยู่เกิน 100 แรก ดึงชื่อตาม id ให้เอง — `defaultLabel` ไม่บังคับ
 * (ส่งมาเมื่อผู้เรียกมีชื่ออยู่แล้ว จะได้ข้ามการยิง GET ตาม id)
 */
export function LookupCostCenter({
  value,
  onValueChange,
  defaultLabel,
  disabled,
  error,
  size,
  modal,
  allowDeselect,
}: LookupCostCenterProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data, isLoading } = useCostCenter(
    {
      perpage: 100,
      search: search || undefined,
      filter: "is_active|bool:true",
    },
    { enabled: open || !!value },
  );
  const items = data?.data ?? [];
  // ค่าที่บันทึกไว้อาจ inactive หรืออยู่เกิน 100 แรก → ดึงตาม id เพื่อทำ label
  // (ไม่ดึงถ้ามี defaultLabel จากผู้เรียก หรือหาเจอในรายการแล้ว)
  const missing =
    !!value && !defaultLabel && !isLoading && !items.some((c) => c.id === value);
  const { data: selected } = useCostCenterById(missing ? value : undefined);

  return (
    <LookupCombobox<CostCenter>
      value={value ?? ""}
      onValueChange={(id, item) => onValueChange(id || null, item)}
      items={items}
      selectedItems={selected ? [selected] : undefined}
      getId={(c) => c.id}
      getLabel={(c) => `${c.code} · ${c.name}`}
      getSearchValue={(c) => `${c.code} ${c.name}`}
      defaultLabel={defaultLabel}
      isLoading={isLoading}
      onOpenChange={setOpen}
      onSearchChange={setSearch}
      serverSideSearch
      disabled={disabled}
      error={error}
      size={size}
      modal={modal}
      allowDeselect={allowDeselect}
    />
  );
}
