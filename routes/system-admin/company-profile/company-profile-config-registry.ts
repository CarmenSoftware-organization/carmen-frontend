import { printFormConfigKey } from "@/lib/print-form-config";
import type { PrintDocumentType } from "@/lib/print-document";
import type { BusinessUnitConfigItem } from "@/types/business-unit";

export interface ConfigOption {
  value: string;
  labelKey: string;
  visibleWhenCalcMethod?: string | readonly string[];
}

/**
 * รายการ config ที่ frontend "seed" — แสดงเสมอแม้ backend ยังไม่มีค่า
 * (default = defaultValue) พอ user เปิดแล้ว save ค่าจะถูกเขียนลง backend
 */
export interface SeededConfigItem {
  key: string;
  datatype: string;
  defaultValue: string;
  label: string;
  labelKey: string;
  /** i18n key ของคำอธิบายสั้นใต้ป้าย (ไม่มี = ไม่โชว์) */
  descKey?: string;
  /** รหัสเอกสารที่โชว์เป็นป้ายหน้าแถว (เช่น "PR") — ไม่มี = ใช้ชื่อ section */
  code?: string;
  options?: ConfigOption[];
  /**
   * สำหรับ enum ที่ options มาจาก report-template API (ไม่ใช่ static `options`)
   * ค่าคือ `report_group` ที่ใช้กรอง เช่น "PR" — ใช้พร้อม `options` ไม่ได้
   */
  optionsGroup?: string;
}

export interface ConfigSection {
  id: string;
  titleKey: string;
  descKey: string;
  items: SeededConfigItem[];
}

export const CONFIG_SECTIONS: readonly ConfigSection[] = [
  {
    id: "pr",
    titleKey: "sections.pr",
    descKey: "sections.prDesc",
    items: [
      {
        key: "pr.allow-duplicate.product",
        datatype: "boolean",
        defaultValue: "false",
        label: "Allow selecting duplicate products",
        labelKey: "config.prAllowDuplicateProduct",
        descKey: "config.prAllowDuplicateProductDesc",
      },
    ],
  },
  {
    id: "si",
    titleKey: "sections.si",
    descKey: "sections.siDesc",
    items: [
      {
        key: "si.cost-from",
        datatype: "enum",
        defaultValue: "last_cost",
        label: "Default price for added items",
        labelKey: "config.siCostFrom",
        descKey: "config.siCostFromDesc",
        options: [
          {
            value: "average",
            labelKey: "config.siCostFromOptions.average",
            visibleWhenCalcMethod: ["average", "average_per_location"],
          },
          {
            value: "last_receiving",
            labelKey: "config.siCostFromOptions.lastReceiving",
          },
          {
            value: "last_cost",
            labelKey: "config.siCostFromOptions.lastCost",
          },
        ],
      },
    ],
  },
  {
    id: "po",
    titleKey: "sections.po",
    descKey: "sections.poDesc",
    items: [
      {
        key: "po.group-by-pr-comment",
        datatype: "boolean",
        defaultValue: "false",
        label: "Group by PR comment",
        labelKey: "config.poGroupByPrComment",
        descKey: "config.poGroupByPrCommentDesc",
      },
    ],
  },
  {
    id: "printForm",
    titleKey: "sections.printForm",
    descKey: "sections.printFormDesc",
    items: (
      [
        ["PR", "PR - Purchase Request", "config.printFormPr"],
        ["PO", "PO - Purchase Order", "config.printFormPo"],
        ["GRN", "GRN - Good Received Note", "config.printFormGrn"],
        ["SR", "SR - Store Requisition", "config.printFormSr"],
        ["CN", "CN - Credit Note", "config.printFormCn"],
        ["SI", "SI - Stock In", "config.printFormSi"],
        ["SO", "SO - Stock Out", "config.printFormSo"],
        ["IA", "IA - Inventory Adjustment", "config.printFormIa"],
        ["PC", "PC - Physical Count", "config.printFormPc"],
        ["SC", "SC - Spot Check", "config.printFormSc"],
        ["RFP", "RFP - Request For Pricing", "config.printFormRfp"],
        ["EOP", "EOP - End Of Period", "config.printFormEop"],
      ] as [PrintDocumentType, string, string][]
    ).map(([type, label, labelKey]) => ({
      key: printFormConfigKey(type),
      datatype: "enum",
      defaultValue: "",
      label,
      labelKey,
      code: type,
      optionsGroup: type,
    })),
  },
];

export const SEEDED_ITEMS: readonly SeededConfigItem[] =
  CONFIG_SECTIONS.flatMap((s) => s.items);

export const SEEDED_KEYS: ReadonlySet<string> = new Set(
  SEEDED_ITEMS.map((i) => i.key),
);

export interface ConfigSectionEntry {
  item: BusinessUnitConfigItem;
  index: number;
  labelKey: string;
  descKey?: string;
  code?: string;
  options?: ConfigOption[];
  optionsGroup?: string;
}

export interface ConfigOtherEntry {
  item: BusinessUnitConfigItem;
  index: number;
}

export interface ConfigRenderSection {
  id: string;
  titleKey: string;
  descKey: string;
  entries: ConfigSectionEntry[];
}

export interface ConfigRenderGroups {
  sections: ConfigRenderSection[];
  other: ConfigOtherEntry[];
}

/**
 * จัดกลุ่ม merged config items เพื่อ render
 *
 * คำนวณ absolute index ก่อน partition เพราะ RHF ผูกด้วย `config.${index}.value`
 * ที่ต้องอ้าง index ใน merged array (ไม่ใช่ index หลัง filter)
 *
 * @param items - merged config array (จาก mergeSeededConfig)
 * @returns กลุ่ม section (registry) + other (backend-only)
 */
export function groupConfigForRender(
  items: readonly BusinessUnitConfigItem[],
): ConfigRenderGroups {
  const indexed = items.map((item, index) => ({ item, index }));

  const sections: ConfigRenderSection[] = CONFIG_SECTIONS.map((section) => {
    const entries: ConfigSectionEntry[] = [];
    for (const seeded of section.items) {
      const found = indexed.find((e) => e.item.key === seeded.key);
      if (found) {
        entries.push({
          ...found,
          labelKey: seeded.labelKey,
          descKey: seeded.descKey,
          code: seeded.code,
          options: seeded.options,
          optionsGroup: seeded.optionsGroup,
        });
      }
    }
    return {
      id: section.id,
      titleKey: section.titleKey,
      descKey: section.descKey,
      entries,
    };
  }).filter((s) => s.entries.length > 0);

  const other: ConfigOtherEntry[] = indexed.filter(
    (e) => !SEEDED_KEYS.has(e.item.key),
  );

  return { sections, other };
}

/**
 * คืน options ที่ควรแสดงใน dropdown — ตัด option ที่มี visibleWhenCalcMethod
 * ไม่ตรงกับ calculationMethod ยกเว้น option ที่ value === currentValue
 * (คงค่าที่ backend เก็บไว้ ไม่ทำข้อมูลหาย) — visibleWhenCalcMethod รับได้ทั้ง
 * string เดี่ยว (ต้องตรงเป๊ะ) หรือ array (แสดงเมื่อ calculationMethod ตรงตัวใดตัวหนึ่ง)
 * ไม่มี visibleWhenCalcMethod เลย = แสดงเสมอ (ไม่มีเงื่อนไข)
 *
 * @param options - จาก registry (ConfigOption[])
 * @param calculationMethod - BU.calculation_method (อาจเป็น null)
 * @param currentValue - ค่าปัจจุบันของ config item
 */
export function resolveConfigOptions(
  options: readonly ConfigOption[],
  calculationMethod: string | null | undefined,
  currentValue: string,
): ConfigOption[] {
  return options.filter((o) => {
    if (!o.visibleWhenCalcMethod) return true;
    if (o.value === currentValue) return true;
    if (Array.isArray(o.visibleWhenCalcMethod)) {
      return (
        calculationMethod != null &&
        o.visibleWhenCalcMethod.includes(calculationMethod)
      );
    }
    return o.visibleWhenCalcMethod === calculationMethod;
  });
}
