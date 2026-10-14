import { useState } from "react";
import { useTranslations } from "use-intl";
import { useLookupResource } from "@/hooks/use-lookup-resource";
import { lookupLabel } from "@/types/lookup";
import type { NotificationTemplateType } from "@/types/noti-tmpl";
import { LookupCombobox } from "./lookup-combobox";

interface LookupNotificationTemplateProps {
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly channelType: NotificationTemplateType;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly size?: "xs" | "sm" | "default";
  readonly error?: string;
}

export function LookupNotificationTemplate({
  value,
  onValueChange,
  channelType,
  disabled,
  placeholder,
  className,
  size,
  error,
}: LookupNotificationTemplateProps) {
  const tl = useTranslations("lookup");
  const tnt = useTranslations("systemAdmin.notificationTemplate");
  const [search, setSearch] = useState("");
  const [hasOpened, setHasOpened] = useState(false);

  const { items, selectedItems, isLoading, isLoadingMore, hasMore, loadMore } =
    useLookupResource("notification_template", {
      search,
      // template ที่ stage ผูกไว้คงแสดงแม้ถูกปิดใช้งาน — มาทาง selectedItems
      serverFilter: { type: channelType },
      enabled: hasOpened,
      selectedIds: value ? [value] : [],
    });

  return (
    <LookupCombobox
      resizeKey="noti-tmpl"
      size={size}
      value={value}
      onValueChange={onValueChange}
      onOpenChange={(open) => {
        if (open) setHasOpened(true);
      }}
      items={items}
      selectedItems={selectedItems}
      renderItem={(tpl) => (
        <span className="flex-1 truncate text-left">{lookupLabel(tpl)}</span>
      )}
      getId={(tpl) => tpl.id}
      getLabel={lookupLabel}
      placeholder={placeholder ?? tl("select", { entity: tnt("entity") })}
      searchPlaceholder={tl("search", { entity: tnt("entity") })}
      disabled={disabled}
      className={className}
      isLoading={isLoading}
      serverSideSearch
      onSearchChange={setSearch}
      onLoadMore={loadMore}
      hasMore={hasMore}
      isLoadingMore={isLoadingMore}
      error={error}
      popoverWidth="w-[min(92vw,52rem)]"
    />
  );
}
