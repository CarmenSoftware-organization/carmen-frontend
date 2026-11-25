import type { DimensionDataType } from "@/types/accounting-master";

export const DIMENSION_DATA_TYPES: {
  value: DimensionDataType;
  label: string;
  /** ชื่อสั้นสำหรับคอลัมน์ในตาราง — label เต็มยาวจนตัดกลางคำ 3 บรรทัด */
  short: string;
}[] = [
  { value: "string", label: "Text (Max 20 digits)", short: "Text" },
  { value: "number", label: "Number (Max 20 digits)", short: "Number" },
  { value: "date", label: "Date", short: "Date" },
  {
    value: "lookup",
    label: "List (Master List Code & Description)",
    short: "List",
  },
  { value: "boolean", label: "Boolean (True / False)", short: "Boolean" },
];
