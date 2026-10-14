import type { FilterFieldDef } from "@/types/list-filter";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useConfigLocation } from "@/hooks/use-location";
import { useCategory } from "@/hooks/use-category";
import { useSubCategory } from "@/hooks/use-sub-category";
import { useItemGroup } from "@/hooks/use-item-group";
import { useAdjustmentType } from "@/hooks/use-adjustment-type";
import type { Location } from "@/types/location";
import type {
  CategoryDto,
  ItemGroupDto,
  SubCategoryDto,
} from "@/types/category";
import type { AdjustmentType } from "@/types/adjustment-type";
import type {
  MappingMovement,
  MappingStatus,
  MappingType,
} from "@/types/chart-of-account-mapping";
import type { AccountMappingListParams } from "./use-account-mapping";

/*
 * endpoint นี้ไม่ใช้ `filter=` แบบ clause แต่รับ query param แยก key ละค่าเดียว
 * ค่าใน URL จึงเป็นค่าดิบ (entity ใช้ `bareIds`) แล้ว `filtersToParams` แปลงเป็น
 * param ตรง ๆ — ไม่ส่ง `lf.filterParam` ให้ backend
 *
 * ตัวเลือกค่าเดียว (status / location_type / movement) ใช้ control "status"
 * ซึ่งเลือกได้ทีละค่าอยู่แล้ว ส่วน entity เลือกได้หลายค่าโดยธรรมชาติของ control
 * → ส่งทุก id คั่นด้วย `,` (backend รับหลาย id ต่อ key แบบ OR) chip จึงตรงกับผลจริง
 *
 * ไม่กรอง is_active (`serverFilter: null`) — แถว mapping อาจอ้างของที่ถูกปิดไปแล้ว
 */

const LOCATION_ENTITY = defineEntitySource<Location>({
  fieldKey: "location_id",
  useListHook: useConfigLocation,
  getLabel: (l) => `${l.code} - ${l.name}`,
  serverFilter: null,
  bareIds: true,
});
const CATEGORY_ENTITY = defineEntitySource<CategoryDto>({
  fieldKey: "category_id",
  useListHook: useCategory,
  getLabel: (c) => `${c.code} - ${c.name}`,
  serverFilter: null,
  bareIds: true,
});
const SUB_CATEGORY_ENTITY = defineEntitySource<SubCategoryDto>({
  fieldKey: "sub_category_id",
  useListHook: useSubCategory,
  getLabel: (c) => `${c.code} - ${c.name}`,
  serverFilter: null,
  bareIds: true,
});
const ITEM_GROUP_ENTITY = defineEntitySource<ItemGroupDto>({
  fieldKey: "product_item_group_id",
  useListHook: useItemGroup,
  getLabel: (c) => `${c.code} - ${c.name}`,
  serverFilter: null,
  bareIds: true,
});
const ADJUSTMENT_TYPE_ENTITY = defineEntitySource<AdjustmentType>({
  fieldKey: "adjustment_type_id",
  useListHook: useAdjustmentType,
  getLabel: (a) => `${a.code} - ${a.name}`,
  serverFilter: null,
  bareIds: true,
});

const NS = "config.chartOfAccountMapping";

const COMMON_FIELDS: FilterFieldDef[] = [
  {
    key: "status",
    control: "status",
    labelKey: `${NS}.status`,
    options: [
      { labelKey: `${NS}.statusIncomplete`, value: "incomplete" },
      { labelKey: `${NS}.statusOverridden`, value: "overridden" },
      { labelKey: `${NS}.statusDefault`, value: "default" },
      { labelKey: `${NS}.statusUnreviewed`, value: "unreviewed" },
    ],
  },
  {
    key: "location_type",
    control: "status",
    labelKey: `${NS}.locationType`,
    // consignment ไม่มีแถว mapping
    options: [
      { labelKey: "config.location.typeInventory", value: "inventory" },
      { labelKey: "config.location.typeDirect", value: "direct" },
    ],
  },
  {
    key: "location_id",
    control: "entity",
    entity: LOCATION_ENTITY,
    labelKey: "field.location",
  },
  {
    key: "category_id",
    control: "entity",
    entity: CATEGORY_ENTITY,
    labelKey: "field.category",
  },
  {
    key: "sub_category_id",
    control: "entity",
    entity: SUB_CATEGORY_ENTITY,
    labelKey: "field.subCategory",
  },
  {
    key: "product_item_group_id",
    control: "entity",
    entity: ITEM_GROUP_ENTITY,
    labelKey: "field.itemGroup",
  },
];

/** ตัวกรองแท็บ AP — movement ฝั่ง AP มีแค่ GRN / CN */
const AP_FIELDS: FilterFieldDef[] = [
  ...COMMON_FIELDS,
  {
    key: "movement",
    control: "status",
    labelKey: `${NS}.movement`,
    options: [
      { labelKey: `${NS}.movementGrn`, value: "grn" },
      { labelKey: `${NS}.movementCn`, value: "cn" },
    ],
  },
];

/** ตัวกรองแท็บ GL — movement ฝั่ง GL + ประเภทการปรับปรุง */
const GL_FIELDS: FilterFieldDef[] = [
  ...COMMON_FIELDS,
  {
    key: "movement",
    control: "status",
    labelKey: `${NS}.movement`,
    options: [
      { labelKey: `${NS}.movementAdjustment`, value: "adjustment" },
      { labelKey: `${NS}.movementSrIn`, value: "sr_in" },
      { labelKey: `${NS}.movementSrOut`, value: "sr_out" },
    ],
  },
  {
    key: "adjustment_type_id",
    control: "entity",
    entity: ADJUSTMENT_TYPE_ENTITY,
    labelKey: `${NS}.adjustmentType`,
  },
];

/**
 * ตัวกรองของแต่ละแท็บ — reference คงที่ (module-level) ตามที่ `useListFilters` ต้องการ
 */
export function coamFilterFields(tab: MappingType): FilterFieldDef[] {
  return tab === "GL" ? GL_FIELDS : AP_FIELDS;
}

/** key ที่มีเฉพาะแท็บ GL หรือค่าที่ต่างกันระหว่างแท็บ — ล้างทิ้งตอนสลับแท็บ */
export const TAB_SCOPED_FILTER_KEYS = [
  "movement",
  "adjustment_type_id",
] as const;

const first = (v: string | undefined) =>
  v
    ?.split(",")
    .map((s) => s.trim())
    .find(Boolean) || undefined;

/** id ทั้งหมดของ entity filter คั่นด้วย `,` — backend รับได้สูงสุด 100 id ต่อ key */
const ids = (v: string | undefined) => {
  const list = v
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list?.length ? list.join(",") : undefined;
};

const pick = <T extends string>(
  v: string | undefined,
  allowed: readonly T[],
): T | undefined => {
  const value = first(v);
  return value && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : undefined;
};

const STATUSES: readonly MappingStatus[] = [
  "incomplete",
  "overridden",
  "default",
  "unreviewed",
];
const MOVEMENTS: Record<MappingType, readonly MappingMovement[]> = {
  AP: ["grn", "cn"],
  GL: ["adjustment", "sr_in", "sr_out"],
};

/**
 * แปลงค่าตัวกรองใน URL (`lf.values`) เป็น query param ของ endpoint — ค่าที่ไม่อยู่ใน
 * ตัวเลือกของแท็บ (เช่น movement ของอีกแท็บจากลิงก์เก่า) ถูกทิ้ง ไม่ส่งไปให้ 400
 */
export function filtersToParams(
  values: Record<string, string>,
  tab: MappingType,
): Omit<AccountMappingListParams, "mapping_type"> {
  return {
    status: pick(values.status, STATUSES),
    location_type: pick(values.location_type, ["inventory", "direct"] as const),
    location_id: ids(values.location_id),
    category_id: ids(values.category_id),
    sub_category_id: ids(values.sub_category_id),
    product_item_group_id: ids(values.product_item_group_id),
    movement: pick(values.movement, MOVEMENTS[tab]),
    adjustment_type_id:
      tab === "GL" ? ids(values.adjustment_type_id) : undefined,
  };
}
