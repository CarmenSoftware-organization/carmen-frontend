import type { FilterFieldDef } from "@/types/list-filter";
import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useCostCenterGroup } from "@/routes/config/shared/use-cost-center-group";
import type { CostCenterGroup } from "@/types/cost-center-group";

// ไม่กรอง is_active — ให้เลือก group ที่ปิดไปแล้วได้ เพื่อหา cost center ที่ค้างอยู่ใต้มัน
const GROUP_ENTITY = defineEntitySource<CostCenterGroup>({
  fieldKey: "cost_center_group_id",
  useListHook: useCostCenterGroup,
  getLabel: (g) => `${g.code} · ${g.name}`,
  serverFilter: null,
});

export const COST_CENTER_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "cost_center_group_id",
    control: "entity",
    entity: GROUP_ENTITY,
    labelKey: "field.costCenterGroup",
  },
  {
    key: "filter",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.active", value: "is_active|bool:true" },
      { labelKey: "status.inactive", value: "is_active|bool:false" },
    ],
  },
];
