import type {
  DimensionDataType,
  DimensionDateFormat,
} from "@/types/accounting-master";

export const DIMENSION_DATA_TYPES: {
  value: DimensionDataType;
  label: string;
}[] = [
  { value: "string", label: "Text (Max 20 digits)" },
  { value: "number", label: "Number (Max 20 digits)" },
  { value: "date", label: "Date" },
  { value: "lookup", label: "List (Master List Code & Description)" },
  { value: "boolean", label: "Boolean (True / False)" },
];

export const DIMENSION_DATE_FORMATS: DimensionDateFormat[] = [
  "DD/MM/YYYY",
  "YYYY-MM-DD",
  "DD-MMM-YYYY",
];
