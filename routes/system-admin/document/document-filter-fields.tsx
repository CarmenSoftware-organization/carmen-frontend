import { useTranslations } from "use-intl";
import { DatePicker } from "@/components/ui/date-picker";
import type { FilterFieldDef } from "@/types/list-filter";
import type { DocumentListParams } from "@/types/document";
import { DOCUMENT_REFERENCE_MODULE_KEY } from "./document-reference-labels";

/** ค่า sentinel ในตัวกรองโมดูล = ไฟล์ที่ไม่มี reference_type (อัปโหลดโดยตรง) */
export const DIRECT_UPLOAD_VALUE = "__direct__";

/**
 * 8 ถังชนิดไฟล์ — ต้องตรงกับ content_kinds ฝั่ง backend และ `getFileTypeInfo`
 * ใน use-document-table.tsx (label ใช้ key เดิมใต้ systemAdmin.document)
 */
const KIND_OPTIONS = [
  "spreadsheet",
  "pdf",
  "image",
  "archive",
  "txt",
  "doc",
  "code",
  "file",
] as const;
const KIND_LABEL_KEY: Record<(typeof KIND_OPTIONS)[number], string> = {
  spreadsheet: "xls",
  pdf: "pdf",
  image: "image",
  archive: "archive",
  txt: "txt",
  doc: "doc",
  code: "code",
  file: "file",
};

const NS = "systemAdmin.document";

const pad = (n: number) => String(n).padStart(2, "0");

/** ตัวกรอง "อัปโหลดก่อนวันที่" — เก็บใน URL เป็น YYYY-MM-DD (วันตามเวลาท้องถิ่น ไม่เลื่อนตาม UTC) */
function CreatedBeforeControl({
  value,
  onChange,
}: {
  readonly value: string;
  readonly onChange: (v: string) => void;
}) {
  const t = useTranslations(NS);
  return (
    <DatePicker
      // ต่อเวลาท้องถิ่นเพื่อไม่ให้ new Date("YYYY-MM-DD") ตีเป็น UTC แล้ววันเพี้ยน
      value={value ? `${value}T00:00:00` : ""}
      onValueChange={(iso) => {
        if (!iso) return onChange("");
        const d = new Date(iso);
        onChange(
          `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
        );
      }}
      placeholder={t("filterCreatedBefore")}
      className="w-full"
    />
  );
}

/** reference คงที่ (module-level) ตามที่ `useListFilters` ต้องการ */
export const DOCUMENT_FILTER_FIELDS: FilterFieldDef[] = [
  {
    key: "module",
    section: "listView.sectionDocument",
    control: "multi-select",
    labelKey: `${NS}.filterModule`,
    searchable: true,
    options: [
      { labelKey: `${NS}.summary.directUpload`, value: DIRECT_UPLOAD_VALUE },
      ...Object.entries(DOCUMENT_REFERENCE_MODULE_KEY).map(([type, key]) => ({
        labelKey: `modules.${key}`,
        value: type,
      })),
    ],
  },
  {
    key: "kind",
    section: "listView.sectionDocument",
    control: "multi-select",
    labelKey: "field.type",
    options: KIND_OPTIONS.map((k) => ({
      labelKey: `${NS}.${KIND_LABEL_KEY[k]}`,
      value: k,
    })),
  },
  {
    key: "created_before",
    section: "listView.sectionDate",
    control: "custom",
    labelKey: `${NS}.filterCreatedBefore`,
    render: (value, onChange) => (
      <CreatedBeforeControl value={value} onChange={onChange} />
    ),
  },
];

const csv = (v: string | undefined) => {
  const list = v
    ?.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return list?.length ? list : [];
};

/**
 * แปลงค่าตัวกรองใน URL (`lf.values`) เป็น query param ของ GET /documents
 * - module: sentinel `__direct__` → include_unreferenced=true, ที่เหลือ → reference_types
 * - kind: เฉพาะค่าที่อยู่ใน 8 ถัง (ค่าแปลกจากลิงก์เก่าถูกทิ้ง ไม่ส่งไปให้ 400)
 * - created_before: เฉพาะรูป YYYY-MM-DD
 */
export function documentFiltersToParams(
  values: Record<string, string>,
): Pick<
  DocumentListParams,
  | "reference_types"
  | "content_kinds"
  | "include_unreferenced"
  | "created_before"
> {
  const modules = csv(values.module);
  const types = modules.filter((m) => m !== DIRECT_UPLOAD_VALUE);
  const kinds = csv(values.kind).filter((k) =>
    (KIND_OPTIONS as readonly string[]).includes(k),
  );
  const before = values.created_before?.trim();
  return {
    reference_types: types.length ? types.join(",") : undefined,
    include_unreferenced: modules.includes(DIRECT_UPLOAD_VALUE)
      ? "true"
      : undefined,
    content_kinds: kinds.length ? kinds.join(",") : undefined,
    created_before:
      before && /^\d{4}-\d{2}-\d{2}$/.test(before) ? before : undefined,
  };
}
