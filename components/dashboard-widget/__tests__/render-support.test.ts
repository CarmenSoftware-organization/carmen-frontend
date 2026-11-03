import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { availableRenders, defaultRenderFor } from "../render-support";

describe("availableRenders", () => {
  // ชุดจริง = สิ่งที่ backend บอกว่าสมเหตุสมผล ∩ การ์ดที่ frontend มี
  it("intersects the backend set with the cards that exist", () => {
    // categorical วาดเป็นตารางได้ตั้งแต่มี adapter สร้างคอลัมน์จาก [{label, value}]
    expect(availableRenders("categorical", ["bar", "pie", "table"])).toEqual([
      "pie",
      "bar",
      "table",
    ]);
    // sparkline ยังไม่มีการ์ด ส่วน bar อ่าน time_series ได้แล้ว
    expect(
      availableRenders("time_series", ["line", "area", "bar", "sparkline"]),
    ).toEqual(["bar", "line", "area"]);
    // scalar วาดได้ทั้ง kpi และ gauge ตั้งแต่มี GaugeCard
    expect(availableRenders("scalar", ["kpi", "gauge"])).toEqual([
      "kpi",
      "gauge",
    ]);
  });

  it("drops a render the backend does not advertise", () => {
    // ranked วาด pie ได้ทางเทคนิค (payload มี label+value) แต่ BE ไม่ประกาศไว้
    expect(availableRenders("ranked", ["bar", "table"])).toEqual([
      "bar",
      "table",
    ]);
    expect(availableRenders("ranked", ["bar"])).toEqual(["bar"]);
  });

  it("falls back to card capability when the backend sends no set", () => {
    expect(availableRenders("categorical")).toEqual(["pie", "bar", "table"]);
    expect(availableRenders("scalar_delta")).toEqual(["kpi", "gauge"]);
    expect(availableRenders("time_series", [])).toEqual([
      "bar",
      "line",
      "area",
    ]);
  });

  it("draws a matrix as grouped bars, lines or a table — not a heatmap", () => {
    // เทียบงวด / เทียบ location — heatmap ยังไม่มีการ์ด
    expect(
      availableRenders("matrix", ["bar", "line", "table", "heatmap"]),
    ).toEqual(["bar", "line", "table"]);
    expect(availableRenders("matrix", ["heatmap", "table"])).toEqual(["table"]);
  });

  it("returns nothing for a shape no card can draw", () => {
    expect(availableRenders("matrix", ["heatmap"])).toEqual([]);
    expect(availableRenders(undefined)).toEqual([]);
    expect(availableRenders("nonsense")).toEqual([]);
  });
});

describe("defaultRenderFor", () => {
  it("keeps the picker's existing defaults", () => {
    expect(defaultRenderFor("categorical", ["bar", "pie", "table"])).toBe("pie");
    // bar อ่าน time_series ได้แล้วและมาก่อน line ในลำดับ — default ต้องไม่เปลี่ยน
    expect(
      defaultRenderFor("time_series", ["line", "area", "bar", "sparkline"]),
    ).toBe("line");
    expect(defaultRenderFor("ranked", ["bar", "table"])).toBe("bar");
    expect(defaultRenderFor("time_series")).toBe("line");
    expect(defaultRenderFor("scalar_delta")).toBe("kpi");
    expect(
      defaultRenderFor("matrix", ["bar", "line", "table", "heatmap"]),
    ).toBe("bar");
  });

  it("does not pick a preferred render the backend excluded", () => {
    expect(defaultRenderFor("categorical", ["bar", "table"])).toBe("bar");
  });

  it("falls back to kpi when nothing is drawable", () => {
    expect(defaultRenderFor("matrix", ["heatmap"])).toBe("kpi");
  });
});

// เมนูสลับกราฟตั้งชื่อปุ่มด้วย `chartType.<type>` ที่ประกอบตอน runtime — คีย์ที่ขาด
// จึงไม่มีอะไรจับได้ นอกจากผู้ใช้เห็น "dashboard.savedWidget.chartType.gauge" บนจอ
// (เกิดมาแล้วตอนเพิ่มการ์ด gauge) เทสต์นี้กันซ้ำตอนเพิ่ม sparkline/heatmap
describe("chart type labels", () => {
  const SHAPES = [
    "scalar",
    "scalar_delta",
    "categorical",
    "time_series",
    "ranked",
    "matrix",
    "table",
  ];
  const offered = [...new Set(SHAPES.flatMap((s) => availableRenders(s)))];

  it.each([
    ["en", en],
    ["th", th],
  ])("%s has a label for every render the menu can offer", (_locale, msgs) => {
    const labels = (
      msgs as unknown as {
        dashboard: { savedWidget: { chartType: Record<string, string> } };
      }
    ).dashboard.savedWidget.chartType;
    for (const type of offered) {
      expect(labels[type], `missing chartType.${type}`).toBeTruthy();
    }
  });
});
