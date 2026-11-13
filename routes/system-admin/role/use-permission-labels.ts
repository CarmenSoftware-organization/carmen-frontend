import { useTranslations } from "use-intl";
import {
  ACTION_TKEY,
  CATEGORY_META,
  MODULE_RESOURCE_KEY,
  resourceLabelKeys,
  titleCase,
  type GroupedResource,
} from "./permission-catalog";

/**
 * ชื่อที่แสดงของหมวด / resource / action ของสิทธิ์ สำหรับตัวเลือกสิทธิ์
 */
export function usePermissionLabels() {
  const t = useTranslations("systemAdmin.role");
  const tRes = useTranslations("systemAdmin.role.resources");

  const categoryLabel = (category: string) => {
    const meta = CATEGORY_META[category];
    return meta ? t(meta.tkey) : category;
  };
  const resourceLabel = (r: GroupedResource) => {
    if (r.resourceKey === MODULE_RESOURCE_KEY) return t("moduleAccess");
    const key = resourceLabelKeys(r.category, r.resourceKey).find((k) =>
      tRes.has(k),
    );
    return key ? tRes(key) : titleCase(r.resourceKey);
  };
  const actionLabel = (action: string) =>
    ACTION_TKEY[action] ? t(ACTION_TKEY[action]) : titleCase(action);

  return { categoryLabel, resourceLabel, actionLabel };
}
