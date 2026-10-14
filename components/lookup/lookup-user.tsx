import { useState } from "react";
import { useTranslations } from "use-intl";
import { UserSearch } from "lucide-react";
import { useUser } from "@/hooks/use-user";
import { useLookupPagination } from "@/hooks/use-lookup-pagination";
import type { User } from "@/types/workflows";
import { LookupCombobox } from "./lookup-combobox";

export function getUserFullName(user: User) {
  return [user.firstname, user.middlename, user.lastname]
    .filter(Boolean)
    .join(" ");
}

interface LookupUserProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly onItemChange?: (user: User) => void;
  readonly excludeIds?: Set<string>;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

/**
 * Lookup Popover สำหรับเลือกผู้ใช้งานในระบบ (User)
 *
 * ดึงทีละหน้าผ่าน `useUser` + ค้นที่ server
 * รองรับ `excludeIds` กัน duplicate (เช่นใน workflow approver list) และค้นหาด้วยชื่อ-email
 * มี `onItemChange` ส่ง object `User` เต็มสำหรับ side effects
 *
 * @param value - user_id ที่เลือกอยู่
 * @param onValueChange - callback เมื่อเปลี่ยนค่า ส่งเฉพาะ user_id
 * @returns JSX popover element ของ user lookup
 * @example
 * ```tsx
 * <Controller name="approver_id" control={control} render={({ field }) => (
 *   <LookupUser value={field.value} onValueChange={field.onChange} excludeIds={usedUserIds} />
 * )} />
 * ```
 */
export function LookupUser({
  value,
  onValueChange,
  onItemChange,
  excludeIds,
  disabled,
  placeholder,
  className,
  size,
  error,
}: LookupUserProps) {
  const tl = useTranslations("lookup");
  const tfl = useTranslations("field");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  // ทะเบียนผู้ใช้ไม่มีคอลัมน์ id / is_active — อ้างด้วย user_id และไม่กรอง active
  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupPagination<User>({
      useListHook: useUser,
      search,
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
      getId: (u) => u.user_id,
      idFilterKey: "user_id",
      filter: excludeIds ? (u) => !excludeIds.has(u.user_id) : undefined,
    });

  return (
    <LookupCombobox
      resizeKey="user"
      size={size}
      value={value}
      onValueChange={(id, user) => {
        onValueChange(id);
        if (user) onItemChange?.(user);
      }}
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
      getId={(u) => u.user_id}
      getLabel={(u) => getUserFullName(u)}
      getSearchValue={(u) => `${getUserFullName(u)} ${u.email}`}
      placeholder={placeholder ?? tl("select", { entity: tfl("user") })}
      searchPlaceholder={tl("search", { entity: tfl("user") })}
      disabled={disabled}
      className={className}
      emptyIcon={UserSearch}
      emptyTitle={tl("noFound", { entity: tfl("user") })}
      emptyDescription={tl("noFoundDesc")}
      isLoading={isLoading}
      error={error}
    />
  );
}
