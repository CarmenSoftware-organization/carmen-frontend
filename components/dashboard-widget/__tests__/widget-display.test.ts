import { describe, it, expect } from "vitest";
import {
  applyDecimals,
  fitDisplayToType,
  gaugeRange,
  gridClasses,
  gridSize,
  minSizeFor,
  sizeOptionsFor,
  thresholdColor,
} from "../widget-display";

describe("gridSize", () => {
  it("uses a sensible default per widget type when nothing is set", () => {
    expect(gridSize("kpi")).toEqual({ width: 3, height: 2 });
    expect(gridSize("bar")).toEqual({ width: 6, height: 3 });
    expect(gridSize("table")).toEqual({ width: 12, height: 4 });
  });

  it("lets the saved size win", () => {
    expect(gridSize("kpi", { width: 12, height: 4 })).toEqual({
      width: 12,
      height: 4,
    });
  });

  // ค่าที่หลุดช่วงมาจาก client เก่า/ข้อมูลที่ถูกแก้มือ ต้องไม่ทำให้กริดพัง
  it("clamps out-of-range values instead of emitting a class that does not exist", () => {
    expect(gridSize("kpi", { width: 99, height: 99 })).toEqual({
      width: 12,
      height: 6,
    });
  });

  // ขอบล่างต่อชนิดคือสิ่งที่กัน dashboard ไม่ให้เละจากการย่อของผู้ใช้
  it("never goes below the type's minimum, even from a saved value", () => {
    expect(gridSize("bar", { width: 1, height: 1 })).toEqual({
      width: 4,
      height: 3,
    });
    expect(gridSize("table", { width: 3, height: 2 })).toEqual({
      width: 6,
      height: 4,
    });
  });

  // สลับชนิดกราฟแล้วขนาดเดิมอาจเล็กเกินขอบล่างของชนิดใหม่
  it("lifts a KPI-sized widget to the chart minimum after a render switch", () => {
    const savedAsKpi = { width: 3, height: 2 };
    expect(gridSize("kpi", savedAsKpi)).toEqual({ width: 3, height: 2 });
    expect(gridSize("bar", savedAsKpi)).toEqual({ width: 4, height: 3 });
  });
});

describe("sizeOptionsFor / minSizeFor", () => {
  it("offers a per-type list whose first entry is the minimum", () => {
    for (const type of [
      "kpi",
      "gauge",
      "pie",
      "bar",
      "line",
      "area",
      "table",
    ]) {
      const options = sizeOptionsFor(type);
      expect(options.length).toBeGreaterThan(1);
      expect(minSizeFor(type)).toEqual(options[0]);
    }
  });

  it("keeps every option inside the grid and in a predictable order", () => {
    for (const type of ["kpi", "bar", "table"]) {
      const options = sizeOptionsFor(type);
      for (const [w, h] of options) {
        expect(w).toBeGreaterThanOrEqual(1);
        expect(w).toBeLessThanOrEqual(12);
        expect(h).toBeGreaterThanOrEqual(1);
        expect(h).toBeLessThanOrEqual(6);
      }
      // เรียงตามกว้างก่อนแล้วสูง — ลำดับที่คนกวาดตาใน dropdown ไม่ใช่ตามพื้นที่
      const sorted = [...options].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      expect(options).toEqual(sorted);
    }
  });

  it("gives a table more room than a KPI", () => {
    const [kpiW, kpiH] = minSizeFor("kpi");
    const [tableW, tableH] = minSizeFor("table");
    expect(tableW * tableH).toBeGreaterThan(kpiW * kpiH);
  });

  it("falls back to a usable list for an unknown type", () => {
    expect(sizeOptionsFor("nonsense").length).toBeGreaterThan(0);
  });
});

describe("gridClasses", () => {
  it("emits full literal classes (Tailwind scans source, not runtime strings)", () => {
    expect(gridClasses("kpi")).toBe("md:col-span-2 lg:col-span-3 row-span-2");
    expect(gridClasses("table")).toBe(
      "md:col-span-6 lg:col-span-12 row-span-4",
    );
  });

  it("halves the width on the medium 6-column grid, rounding up", () => {
    expect(gridClasses("bar", { width: 4, height: 3 })).toContain(
      "md:col-span-2",
    );
    expect(gridClasses("bar", { width: 9, height: 3 })).toContain(
      "md:col-span-5",
    );
  });

  // row-span คือตัวที่กันการ์ดบวมตามเพื่อนร่วมแถว
  it("always pins a row span so a card cannot stretch to its tallest neighbour", () => {
    for (const type of [
      "kpi",
      "gauge",
      "pie",
      "bar",
      "line",
      "area",
      "table",
    ]) {
      expect(gridClasses(type)).toMatch(/row-span-\d/);
    }
  });
});

describe("applyDecimals", () => {
  it("leaves the number alone when the user set nothing", () => {
    expect(applyDecimals(3.14159)).toBe(3.14159);
  });

  it("rounds to the requested places and clamps to 0-4", () => {
    expect(applyDecimals(3.14159, { decimals: 2 })).toBe(3.14);
    expect(applyDecimals(3.14159, { decimals: 0 })).toBe(3);
    expect(applyDecimals(3.14159, { decimals: 9 })).toBe(3.1416);
    expect(applyDecimals(3.14159, { decimals: -1 })).toBe(3);
  });
});

describe("gaugeRange", () => {
  it("uses the range the user set", () => {
    expect(gaugeRange(42, { min: 0, max: 100 })).toEqual({
      min: 0,
      max: 100,
      isEstimated: false,
    });
  });

  // gauge ที่ไม่รู้ปลายทางอ่านไม่ได้ — เดาให้เป็นเลขกลม แล้วบอกว่าเดา
  it("estimates a round max and flags it when unset", () => {
    const r = gaugeRange(42);
    expect(r.isEstimated).toBe(true);
    expect(r.max).toBeGreaterThan(42);
    expect(r.max % 10).toBe(0);
  });

  it("ignores a max that is not above min", () => {
    expect(gaugeRange(5, { min: 10, max: 10 }).isEstimated).toBe(true);
  });

  it("never divides by zero for a zero value", () => {
    const r = gaugeRange(0);
    expect(r.max).toBeGreaterThan(r.min);
  });
});

describe("thresholdColor", () => {
  it("uses the fallback until a threshold is crossed", () => {
    expect(
      thresholdColor(10, { thresholds: [{ value: 80, color: "red" }] }, "blue"),
    ).toBe("blue");
    expect(
      thresholdColor(80, { thresholds: [{ value: 80, color: "red" }] }, "blue"),
    ).toBe("red");
  });

  it("picks the highest crossed threshold, whatever order they are stored in", () => {
    const display = {
      thresholds: [
        { value: 90, color: "red" },
        { value: 50, color: "amber" },
      ],
    };
    expect(thresholdColor(95, display, "blue")).toBe("red");
    expect(thresholdColor(60, display, "blue")).toBe("amber");
  });
});

describe("fitDisplayToType", () => {
  // KPI 3×2 เลือกไม่ได้ในกราฟเกจ (ต่ำสุด 3×3) — ล้างให้เกจใช้ขนาดตั้งต้นของมัน
  it("drops a size the new chart type does not offer, keeping the rest", () => {
    expect(
      fitDisplayToType({ width: 3, height: 2, decimals: 1 }, "gauge"),
    ).toEqual({ decimals: 1 });
  });

  it("keeps a size the new chart type also offers", () => {
    const display = { width: 6, height: 3, min: 0, max: 10 };
    expect(fitDisplayToType(display, "gauge")).toBe(display);
  });

  it("leaves a display without a size untouched", () => {
    const display = { decimals: 2 };
    expect(fitDisplayToType(display, "table")).toBe(display);
  });
});
