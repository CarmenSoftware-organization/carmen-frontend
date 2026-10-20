import { defineEntitySource } from "@/components/filter/entity-filter-source";
import { useLocation } from "@/hooks/use-location";
import type { Location } from "@/types/location";
import type { FilterFieldDef } from "@/types/list-filter";

// ไม่กรอง is_active — ประวัติต้องย้อนดูใบของคลังที่ปิดไปแล้วได้
const LOCATION_ENTITY = defineEntitySource<Location>({
  fieldKey: "location_id",
  useListHook: useLocation,
  getLabel: (l) => `${l.code} - ${l.name}`,
  serverFilter: null,
});

/**
 * ตัวกรองของแท็บ History — ค่าสถานะคือ enum_spot_check_status ที่ server รับจริง
 * (`voided`/`cancelled` อยู่ใน type ฝั่ง FE แต่ส่งไปได้ 400 ทั้ง request)
 */
export const SC_HISTORY_FILTER_FIELDS: readonly FilterFieldDef[] = [
  {
    key: "filter",
    section: "listView.sectionDocument",
    control: "status",
    labelKey: "common.status",
    options: [
      { labelKey: "status.pending", value: "doc_status|string:pending" },
      {
        labelKey: "status.in_progress",
        value: "doc_status|string:in_progress",
      },
      { labelKey: "status.completed", value: "doc_status|string:completed" },
      { labelKey: "status.void", value: "doc_status|string:void" },
    ],
  },
  {
    key: "method",
    section: "listView.sectionDocument",
    control: "multi-select",
    labelKey: "field.method",
    options: [
      {
        labelKey: "inventoryManagement.spotCheck.methodRandom",
        value: "method|string:random",
      },
      {
        labelKey: "inventoryManagement.spotCheck.methodHighValue",
        value: "method|string:high_value",
      },
      {
        labelKey: "inventoryManagement.spotCheck.methodManual",
        value: "method|string:manual",
      },
    ],
  },
  {
    key: "location",
    section: "listView.sectionDocument",
    control: "entity",
    entity: LOCATION_ENTITY,
    labelKey: "field.location",
  },
  {
    key: "start_date",
    section: "listView.sectionDate",
    control: "date-range",
    labelKey: "field.startDate",
    fieldKey: "start_date",
  },
];
