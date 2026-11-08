import { describe, it, expect } from "vitest";
import {
  isCategoricalData,
  isMatrixData,
  isScalarDeltaData,
  isTimeSeriesData,
  type CategoricalPoint,
  type MatrixData,
  type TimeSeriesPoint,
} from "@/types/dashboard-widget";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import { sampleAxis, sampleWidget } from "../widget-sample-data";

const TODAY = new Date(2026, 10, 8); // 8 พ.ย. 2026
const nameOf = (dim: string | undefined, letter: string) =>
  dim ? `${dim}:${letter}` : letter;

const ds = (over: Partial<DashboardDataset>): DashboardDataset => ({
  id: "x.sample",
  name: "Sample",
  description: "",
  shape: "categorical",
  category: "workflow",
  unit: "items",
  ...over,
});

describe("sampleWidget", () => {
  it("gives every shape data its card can read", () => {
    const of = (shape: string, over: Partial<DashboardDataset> = {}) =>
      sampleWidget(ds({ shape, ...over }), nameOf, TODAY).data;
    expect(isScalarDeltaData(of("scalar"))).toBe(true);
    const delta = of("scalar_delta") as { value: number; prev: number };
    expect(typeof delta.prev).toBe("number");
    expect(isCategoricalData(of("categorical"))).toBe(true);
    expect(isCategoricalData(of("ranked"))).toBe(true);
    expect(isTimeSeriesData(of("time_series"))).toBe(true);
    expect(isMatrixData(of("matrix"))).toBe(true);
    // ตาราง: ไม่รู้คอลัมน์จริง — ตัวอย่างเป็นแถว label/value ให้ TableCard ตั้งหัวเอง
    const table = sampleWidget(ds({ shape: "table" }), nameOf, TODAY);
    expect(table.meta.shape).toBe("categorical");
    expect(isCategoricalData(table.data)).toBe(true);
  });

  it("is stable for one dataset and differs between datasets", () => {
    const a1 = sampleWidget(ds({ id: "a" }), nameOf, TODAY).data;
    const a2 = sampleWidget(ds({ id: "a" }), nameOf, TODAY).data;
    const b = sampleWidget(ds({ id: "b" }), nameOf, TODAY).data;
    expect(a2).toEqual(a1);
    expect(b).not.toEqual(a1);
  });

  it("labels the axis by the dataset dimension", () => {
    const status = sampleWidget(ds({ dimension: "status" }), nameOf, TODAY)
      .data as CategoricalPoint[];
    expect(status.map((p) => p.label)).toEqual([
      "draft",
      "in_progress",
      "approved",
      "completed",
    ]);
    const vendors = sampleWidget(ds({ dimension: "vendor" }), nameOf, TODAY)
      .data as CategoricalPoint[];
    expect(vendors.map((p) => p.label)).toEqual([
      "vendor:A",
      "vendor:B",
      "vendor:C",
      "vendor:D",
    ]);
    const perDay = sampleWidget(
      ds({ shape: "matrix", dimension: "day", series_dimension: "period" }),
      nameOf,
      TODAY,
    ).data as MatrixData;
    expect(perDay.rows).toEqual(["2610", "2611"]);
    expect(perDay.cols).toEqual(["01", "02", "03", "04", "05", "06", "07"]);
    expect(perDay.values).toHaveLength(2);
  });

  it("ends a time series on today and keeps the dataset's meta", () => {
    const w = sampleWidget(
      ds({ shape: "time_series", unit: "฿", dimension: "date" }),
      nameOf,
      TODAY,
    );
    const points = w.data as TimeSeriesPoint[];
    expect(points).toHaveLength(10);
    expect(points.at(-1)?.date).toBe("2026-11-08");
    expect(w.meta.unit).toBe("฿");
    expect(w.meta.dimension).toBe("date");
  });
});

describe("sampleAxis", () => {
  it("walks months oldest first up to this month", () => {
    expect(sampleAxis("month", 3, TODAY, nameOf)).toEqual([
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
  });
});
