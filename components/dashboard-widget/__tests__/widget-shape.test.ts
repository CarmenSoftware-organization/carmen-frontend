import { describe, it, expect } from "vitest";
import type { DatasetParam } from "@/types/dashboard-widget";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import {
  defaultParamsFor,
  defaultWidgetTypeFor,
  inferSubTile,
  joinPicked,
  periodCodeOf,
  selectablePeriods,
  shouldShowAllOption,
  splitPicked,
  SUPPORTED_SHAPES,
} from "../widget-shape";

const ds = (
  shape: string,
  supported_renders?: readonly string[],
): DashboardDataset => ({
  id: "x.y",
  name: "X",
  description: "",
  shape,
  category: "workflow",
  unit: "items",
  supported_renders,
});

describe("defaultWidgetTypeFor", () => {
  // ค่าเริ่มต้นต้องไม่เปลี่ยนจากของเดิมที่เคย hardcode ไว้ฝั่ง frontend
  it.each([
    ["scalar", "kpi"],
    ["scalar_delta", "kpi"],
    ["time_series", "line"],
    ["categorical", "pie"],
    ["ranked", "bar"],
    ["table", "table"],
  ])("maps %s → %s", (shape, expected) => {
    expect(defaultWidgetTypeFor(ds(shape))).toBe(expected);
  });

  it("falls back to kpi for an unknown shape", () => {
    expect(defaultWidgetTypeFor(ds("nonsense"))).toBe("kpi");
  });

  // backend เป็นเจ้าของชุดที่อนุญาต — ถ้าตัดตัวไหนออก frontend ต้องไม่เลือกตัวนั้น
  it("obeys supported_renders when the backend narrows the set", () => {
    expect(defaultWidgetTypeFor(ds("categorical", ["bar", "table"]))).toBe(
      "bar",
    );
  });

  it("only yields widget types that WidgetRouter has a case for", () => {
    const renderable = new Set(["kpi", "pie", "bar", "line", "area", "table"]);
    for (const shape of SUPPORTED_SHAPES) {
      expect(renderable).toContain(defaultWidgetTypeFor(ds(shape)));
    }
  });

  // matrix มีการ์ดแล้ว (แท่งจัดกลุ่ม / หลายเส้น / ตาราง) — dataset เทียบงวดต้องเลือกได้
  it("offers matrix in the picker now that cards draw it", () => {
    expect(SUPPORTED_SHAPES).toContain("matrix");
  });
});

describe("defaultParamsFor", () => {
  const params: readonly DatasetParam[] = [
    {
      name: "granularity",
      label: "Granularity",
      type: "text",
      required: false,
      default: "day",
      options: ["day", "week", "month"],
    },
    {
      name: "days",
      label: "Look-back (days)",
      type: "int",
      required: false,
      default: 30,
    },
    {
      name: "status",
      label: "PR status",
      type: "text",
      required: false,
      default: "",
      options: ["draft"],
    },
  ];

  it("seeds every param from its default", () => {
    expect(defaultParamsFor(params)).toEqual({
      granularity: "day",
      days: 30,
      status: "",
    });
  });

  it("keeps an empty-string default (status = ทุกสถานะ)", () => {
    expect(defaultParamsFor(params).status).toBe("");
  });

  it("returns {} for a dataset with no params", () => {
    expect(defaultParamsFor([])).toEqual({});
    expect(defaultParamsFor()).toEqual({});
  });

  it("skips params that declare no default", () => {
    const noDefault: readonly DatasetParam[] = [
      { name: "x", label: "X", type: "text", required: true },
    ];
    expect(defaultParamsFor(noDefault)).toEqual({});
  });
});

describe("inferSubTile", () => {
  it.each([
    ["lab.pr-created-series", "purchaseRequest"],
    ["lab.po-spend-series", "purchaseOrder"],
    ["lab.pr-amount-by-department", "purchaseRequest"],
    ["inventory.physical-count-pending", "physicalCount"],
    ["workflow.grn-pending", "goodsReceiveNote"],
    // encapsulated document.* family (PR/PO/SR/GRN)
    ["document.pr-by-status", "purchaseRequest"],
    ["document.po-created-series", "purchaseOrder"],
    ["document.sr-count", "storeRequisition"],
    ["document.grn-pending", "goodsReceiveNote"],
  ])("maps %s → %s", (id, expected) => {
    expect(inferSubTile(id)).toBe(expected);
  });
});

describe("shouldShowAllOption", () => {
  const P = (o: Partial<DatasetParam>): DatasetParam => ({
    name: "x",
    label: "X",
    type: "text",
    required: false,
    ...o,
  });

  it("shows All for a non-required param with empty-string default (status)", () => {
    expect(shouldShowAllOption(P({ default: "", options: ["draft"] }))).toBe(
      true,
    );
  });

  it("shows All for a non-required param with no default", () => {
    expect(shouldShowAllOption(P({ options: ["a", "b"] }))).toBe(true);
  });

  it("hides All for a param with a meaningful default (time_range token)", () => {
    expect(
      shouldShowAllOption(
        P({ default: "@1month", options: ["@today", "@1month"] }),
      ),
    ).toBe(false);
  });

  it("hides All for a required param", () => {
    expect(
      shouldShowAllOption(P({ required: true, default: "", options: ["a"] })),
    ).toBe(false);
  });
});

describe("splitPicked / joinPicked", () => {
  // ค่าของ param แบบเลือกจากรายการเดินทางเป็น string คั่น "," (template ฝั่ง platform รับแค่
  // string|number) — UI ต้องนับจำนวนที่เลือกได้ถูกแม้ค่ามีช่องว่าง/ซ้ำ/ลงท้ายด้วย ","
  it("splits, trims, drops empties and duplicates", () => {
    expect(splitPicked(" a, b,,a,")).toEqual(["a", "b"]);
    expect(splitPicked("")).toEqual([]);
    expect(splitPicked(undefined)).toEqual([]);
  });

  it("round-trips through the stored value", () => {
    expect(joinPicked(splitPicked("2602,@previous_period"))).toBe(
      "2602,@previous_period",
    );
    expect(joinPicked([])).toBe("");
  });
});

describe("defaultWidgetTypeFor with default_render", () => {
  // เทียบงวดรายวัน = matrix ที่ควรเริ่มเป็นเส้นซ้อน ส่วน matrix อื่นเริ่มเป็นแท่งจัดกลุ่ม
  it("starts where the dataset says when that card exists", () => {
    const daily = {
      ...ds("matrix", ["bar", "line", "table", "heatmap"]),
      default_render: "line",
    };
    expect(defaultWidgetTypeFor(daily)).toBe("line");
    expect(
      defaultWidgetTypeFor(ds("matrix", ["bar", "line", "table", "heatmap"])),
    ).toBe("bar");
  });

  it("ignores a default the frontend cannot draw", () => {
    const heat = {
      ...ds("matrix", ["bar", "line", "table", "heatmap"]),
      default_render: "heatmap",
    };
    expect(defaultWidgetTypeFor(heat)).toBe("bar");
  });
});

describe("selectablePeriods", () => {
  const tokenCode = { "@current_period": "2610", "@previous_period": "2609" };
  const options = [
    "@current_period",
    "@previous_period",
    "2610",
    "2609",
    "2608",
  ];

  it("hides the codes the picked tokens point at", () => {
    expect(
      selectablePeriods(
        options,
        ["@current_period", "@previous_period"],
        tokenCode,
      ),
    ).toEqual(["2608"]);
  });

  it("hides the token when its code is picked", () => {
    expect(selectablePeriods(options, ["2610"], tokenCode)).toEqual([
      "@previous_period",
      "2609",
      "2608",
    ]);
  });

  it("offers everything when nothing is picked", () => {
    expect(selectablePeriods(options, [], tokenCode)).toEqual(options);
  });

  it("only hides the token itself while its code is still loading", () => {
    expect(selectablePeriods(options, ["@current_period"], {})).toEqual([
      "@previous_period",
      "2610",
      "2609",
      "2608",
    ]);
    expect(periodCodeOf("@current_period", {})).toBe("@current_period");
  });
});
