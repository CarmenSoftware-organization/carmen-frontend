import {
  createStatusConfig,
  createStatusFilterOptions,
} from "@/constant/status-config";
import { LIST_PAGE_KEYS, type ListPageKey } from "@/constant/list-page-keys";
import type { JvTemplateType } from "./jv-template-types";

export type JvTemplatePageKind = "all" | "recurring" | "allocation";

export const JV_TEMPLATE_PAGES: Record<
  JvTemplatePageKind,
  {
    path: string;
    fixedType: JvTemplateType | null;
    creatableTypes: JvTemplateType[];
    listPageKey: ListPageKey;
    /** คีย์ใต้ namespace `accounting.jvTemplate` */
    titleKey: string;
  }
> = {
  all: {
    path: "/accounting/template-voucher",
    fixedType: null,
    creatableTypes: ["recurring", "allocation", "amortize"],
    listPageKey: LIST_PAGE_KEYS.JV_TEMPLATE,
    titleKey: "titleAll",
  },
  recurring: {
    path: "/accounting/recurring-voucher",
    fixedType: "recurring",
    creatableTypes: ["recurring"],
    listPageKey: LIST_PAGE_KEYS.JV_TEMPLATE_RECURRING,
    titleKey: "titleRecurring",
  },
  allocation: {
    path: "/accounting/allocation-voucher",
    fixedType: "allocation",
    creatableTypes: ["allocation"],
    listPageKey: LIST_PAGE_KEYS.JV_TEMPLATE_ALLOCATION,
    titleKey: "titleAllocation",
  },
};

/** ชนิดของ template — ชนิดเอกสาร ไม่ใช่สถานะ จึงไม่มีสี */
export const JV_TEMPLATE_TYPE_CONFIG = createStatusConfig(
  ["recurring", "allocation", "amortize"] as const,
  {
    recurring: { label: "Recurring" },
    allocation: { label: "Allocation" },
    amortize: { label: "Amortize" },
  },
);

export const JV_TEMPLATE_TYPE_OPTIONS = createStatusFilterOptions(
  "template_type",
  JV_TEMPLATE_TYPE_CONFIG,
);

/** ตัวกรอง active/inactive — รูปแบบ clause boolean เดียวกับ `ACTIVE_ONLY_FILTER` */
export const JV_TEMPLATE_ACTIVE_OPTIONS = [
  { label: "Active", value: "is_active|boolean:true", statusKey: "active" },
  { label: "Inactive", value: "is_active|boolean:false", statusKey: "inactive" },
];

export function jvTemplateDetailPath(
  kind: JvTemplatePageKind,
  id: string,
): string {
  return `${JV_TEMPLATE_PAGES[kind].path}/${id}`;
}
