import { describe, it, expect } from "vitest";
import {
  CONFIG_SECTIONS,
  SEEDED_ITEMS,
  SEEDED_KEYS,
  groupConfigForRender,
  resolveConfigOptions,
} from "./company-profile-config-registry";
import { mergeSeededConfig } from "./company-profile-form-schema";
import {
  printFormConfigKey,
  PRINT_FORM_DOCUMENT_TYPES,
} from "@/lib/print-form-config";
import type { BusinessUnitConfigItem } from "@/types/business-unit";

describe("config registry", () => {
  it("SEEDED_ITEMS flattens every section's items", () => {
    const count = CONFIG_SECTIONS.reduce((n, s) => n + s.items.length, 0);
    expect(SEEDED_ITEMS).toHaveLength(count);
  });

  it("has no duplicate keys", () => {
    expect(SEEDED_KEYS.size).toBe(SEEDED_ITEMS.length);
  });

  it("registers pr.allow-duplicate.product as boolean defaulting to false", () => {
    const pr = SEEDED_ITEMS.find((i) => i.key === "pr.allow-duplicate.product");
    expect(pr).toBeDefined();
    expect(pr?.datatype).toBe("boolean");
    expect(pr?.defaultValue).toBe("false");
    expect(pr?.labelKey).toBe("config.prAllowDuplicateProduct");
  });

  it("puts the PR item under a section with id 'pr'", () => {
    const pr = CONFIG_SECTIONS.find((s) => s.id === "pr");
    expect(pr).toBeDefined();
    expect(pr?.items.some((i) => i.key === "pr.allow-duplicate.product")).toBe(
      true,
    );
  });
});

describe("groupConfigForRender", () => {
  it("puts the seeded PR item in the pr section with absolute index and labelKey", () => {
    const merged = mergeSeededConfig([]); // → one entry per seeded section
    const groups = groupConfigForRender(merged);
    expect(groups.sections).toHaveLength(CONFIG_SECTIONS.length);
    expect(groups.sections[0].id).toBe("pr");
    expect(groups.sections[0].entries).toHaveLength(1);
    expect(groups.sections[0].entries[0].index).toBe(0);
    expect(groups.sections[0].entries[0].item.key).toBe(
      "pr.allow-duplicate.product",
    );
    expect(groups.sections[0].entries[0].labelKey).toBe(
      "config.prAllowDuplicateProduct",
    );
    expect(groups.other).toHaveLength(0);
  });

  it("keeps unknown backend items in 'other' and preserves absolute indices", () => {
    const backend: BusinessUnitConfigItem[] = [
      { key: "x.unknown", label: "X", datatype: "string", value: "1" },
    ];
    const merged = mergeSeededConfig(backend); // [x.unknown(0), pr(1)]
    const groups = groupConfigForRender(merged);
    expect(groups.other).toHaveLength(1);
    expect(groups.other[0].index).toBe(0);
    expect(groups.other[0].item.key).toBe("x.unknown");
    expect(groups.sections[0].entries[0].index).toBe(1);
  });

  it("omits a section when none of its items are present", () => {
    const groups = groupConfigForRender([]); // no items at all
    expect(groups.sections).toHaveLength(0);
    expect(groups.other).toHaveLength(0);
  });
});

describe("SI config registry", () => {
  it("registers si.cost-from as an enum defaulting to last_cost under section 'si'", () => {
    const si = CONFIG_SECTIONS.find((s) => s.id === "si");
    expect(si).toBeDefined();
    const item = si?.items.find((i) => i.key === "si.cost-from");
    expect(item).toBeDefined();
    expect(item?.datatype).toBe("enum");
    expect(item?.defaultValue).toBe("last_cost");
    expect(item?.labelKey).toBe("config.siCostFrom");
  });

  it("declares 3 options in order, with average gated on both average costing methods", () => {
    const item = SEEDED_ITEMS.find((i) => i.key === "si.cost-from");
    expect(item?.options?.map((o) => o.value)).toEqual([
      "average",
      "last_receiving",
      "last_cost",
    ]);
    const avg = item?.options?.find((o) => o.value === "average");
    expect(avg?.visibleWhenCalcMethod).toEqual([
      "average",
      "average_per_location",
    ]);
    expect(avg?.labelKey).toBe("config.siCostFromOptions.average");
    // non-conditional options have no gate
    expect(
      item?.options?.find((o) => o.value === "last_cost")
        ?.visibleWhenCalcMethod,
    ).toBeUndefined();
  });
});

describe("groupConfigForRender — enum options", () => {
  it("attaches registry options to the SI enum entry", () => {
    const merged = mergeSeededConfig([]); // seeds ทั้ง PR + SI
    const groups = groupConfigForRender(merged);
    const si = groups.sections.find((s) => s.id === "si");
    expect(si).toBeDefined();
    const entry = si?.entries.find((e) => e.item.key === "si.cost-from");
    expect(entry?.options?.map((o) => o.value)).toEqual([
      "average",
      "last_receiving",
      "last_cost",
    ]);
  });

  it("leaves options undefined for non-enum (boolean PR) entries", () => {
    const merged = mergeSeededConfig([]);
    const groups = groupConfigForRender(merged);
    const pr = groups.sections.find((s) => s.id === "pr");
    const entry = pr?.entries.find(
      (e) => e.item.key === "pr.allow-duplicate.product",
    );
    expect(entry?.options).toBeUndefined();
  });
});

describe("resolveConfigOptions", () => {
  const opts = [
    { value: "average", labelKey: "a", visibleWhenCalcMethod: "average" },
    { value: "last_receiving", labelKey: "b" },
    { value: "last_cost", labelKey: "c" },
  ];

  it("shows all options when calc method is average", () => {
    expect(
      resolveConfigOptions(opts, "average", "last_cost").map((o) => o.value),
    ).toEqual(["average", "last_receiving", "last_cost"]);
  });

  it("hides average when calc method is not average", () => {
    expect(
      resolveConfigOptions(opts, "fifo", "last_cost").map((o) => o.value),
    ).toEqual(["last_receiving", "last_cost"]);
  });

  it("hides average when calc method is null", () => {
    expect(
      resolveConfigOptions(opts, null, "last_cost").map((o) => o.value),
    ).toEqual(["last_receiving", "last_cost"]);
  });

  it("keeps average when it is the stored current value even if calc method differs", () => {
    expect(
      resolveConfigOptions(opts, "fifo", "average").map((o) => o.value),
    ).toEqual(["average", "last_receiving", "last_cost"]);
  });
});

describe("PO config registry", () => {
  it("registers po.group-by-pr-comment as a boolean defaulting to false under section 'po'", () => {
    const po = CONFIG_SECTIONS.find((s) => s.id === "po");
    expect(po).toBeDefined();
    const item = po?.items.find((i) => i.key === "po.group-by-pr-comment");
    expect(item).toBeDefined();
    expect(item?.datatype).toBe("boolean");
    expect(item?.defaultValue).toBe("false");
    expect(item?.labelKey).toBe("config.poGroupByPrComment");
    expect(item?.options).toBeUndefined();
  });
});

describe("Print Form config registry", () => {
  const section = CONFIG_SECTIONS.find((s) => s.id === "printForm");
  // ทุกแถวเลือก template จาก platform ตาม report_group — รวม Recipe (ไม่มีตัวเลือกตายตัวแล้ว)
  const templateItems = section?.items;

  it("registers one enum item per printable document type", () => {
    expect(section).toBeDefined();
    expect(templateItems).toHaveLength(PRINT_FORM_DOCUMENT_TYPES.length);
    expect(templateItems?.map((i) => i.key)).toEqual(
      PRINT_FORM_DOCUMENT_TYPES.map(printFormConfigKey),
    );
  });

  it("defaults every item to empty (use the system default) with no static options", () => {
    for (const item of templateItems ?? []) {
      expect(item.datatype).toBe("enum");
      expect(item.defaultValue).toBe("");
      expect(item.options).toBeUndefined();
    }
  });

  it("points each item at its report_group and its own label key", () => {
    expect(templateItems?.map((i) => [i.optionsGroup, i.labelKey])).toEqual([
      ["PR", "config.printFormPr"],
      ["PO", "config.printFormPo"],
      ["GRN", "config.printFormGrn"],
      ["SR", "config.printFormSr"],
      ["CN", "config.printFormCn"],
      ["SI", "config.printFormSi"],
      ["SO", "config.printFormSo"],
      ["IA", "config.printFormIa"],
      ["PC", "config.printFormPc"],
      ["SC", "config.printFormSc"],
      ["RFP", "config.printFormRfp"],
      ["EOP", "config.printFormEop"],
      ["RECIPE", "config.printFormRecipe"],
    ]);
  });

  it("exposes optionsGroup on rendered entries", () => {
    const groups = groupConfigForRender(mergeSeededConfig([]));
    const rendered = groups.sections.find((s) => s.id === "printForm");
    expect(
      rendered?.entries.find((e) => e.item.key === "print-form.pr")
        ?.optionsGroup,
    ).toBe("PR");
  });
});

// เดิมหน้าสูตรมี dropdown แนวกระดาษ / เนื้อหาของตัวเอง — ผู้ใช้ 2026-11-08: ให้เลือก template ที่ admin
// ทำใน platform เหมือนแถวอื่น แบบไม่พิมพ์วิธีทำ / วัตถุดิบไปทำเป็น template แยกเอา
describe("Recipe print form", () => {
  it("is a platform template picker like the other documents, with no fixed options", () => {
    const recipe = SEEDED_ITEMS.find((i) => i.key === "print-form.recipe");
    expect(recipe).toMatchObject({
      datatype: "enum",
      defaultValue: "",
      optionsGroup: "RECIPE",
      code: "RECIPE",
    });
    expect(recipe?.options).toBeUndefined();
    expect(SEEDED_KEYS.has("recipe.print-orientation")).toBe(false);
    expect(SEEDED_KEYS.has("recipe.print-content")).toBe(false);
  });
});
