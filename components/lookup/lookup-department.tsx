import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import { LookupCombobox } from "./lookup-combobox";

interface LookupDepartmentProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
  readonly readOnly?: boolean;
}

/**
 * Lookup Popover สำหรับเลือกแผนก (Department)
 *
 * ดึงข้อมูลผ่าน Lookup API (`useLookupResource`, scope `all` = ทั้ง BU) พร้อม server-side search
 * ใช้ `LookupCombobox` เป็น UI หลัก
 * เหมาะสำหรับใช้ในฟอร์ม PR/PO/SR เพื่อกำหนดแผนกที่รับผิดชอบ
 *
 * @param value - id ของ department ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่งเฉพาะ id
 * @param disabled - ปิดการใช้งาน lookup
 * @param placeholder - ข้อความ placeholder ตอนยังไม่เลือก
 * @param className - className เพิ่มเติม
 * @returns JSX popover element ของ department lookup
 * @example
 * ```tsx
 * <Controller
 *   name="department_id"
 *   control={form.control}
 *   render={({ field }) => (
 *     <LookupDepartment value={field.value} onValueChange={field.onChange} />
 *   )}
 * />
 * ```
 */
export function LookupDepartment({
  value,
  onValueChange,
  disabled,
  placeholder,
  className,
  size,
  error,
  readOnly,
}: LookupDepartmentProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  // Lazy: ยิงรายการตอนเปิด popover ครั้งแรก — ชื่อของค่าที่เลือกไว้ดึงตาม id แยก
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("department", {
      search,
      // ของเดิมเห็นทั้ง BU — `mine` (ค่าเริ่มต้นของ backend) คืนเฉพาะแผนกที่ assign ให้ user
      scope: "all",
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="department"
      size={size}
      value={value}
      onValueChange={(id) => onValueChange(id)}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      getId={(d) => d.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tfl("department") })}
      searchPlaceholder={tl("search", { entity: tfl("department") })}
      disabled={disabled}
      className={className}
      isLoading={isLoading}
      error={error}
      readOnly={readOnly}
    />
  );
}
