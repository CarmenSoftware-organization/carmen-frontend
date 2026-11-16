import { describe, expect, it } from "vitest";
import { decimalsFor, formatQtyFixed } from "./recipe-ingredients-cost";

describe("decimalsFor", () => {
  it("ใช้ทศนิยมของค่าที่ละเอียดที่สุดในคอลัมน์", () => {
    expect(decimalsFor([0.4, 0.04, 0.005, 3])).toBe(3);
  });

  it("จำนวนเต็มทั้งคอลัมน์ = ไม่มีทศนิยม", () => {
    expect(decimalsFor([400, 40, 3])).toBe(0);
  });

  it("ไม่เกิน 5 ตำแหน่ง และศูนย์ท้ายไม่นับ", () => {
    expect(decimalsFor([0.1234567])).toBe(5);
    expect(decimalsFor(["2.50000"])).toBe(1);
  });

  it("ค่าว่าง/ไม่ใช่ตัวเลขไม่นับ", () => {
    expect(decimalsFor([null, undefined, "", "abc", 0.25])).toBe(2);
    expect(decimalsFor([])).toBe(0);
  });
});

describe("formatQtyFixed", () => {
  it("เติมศูนย์ท้ายให้ครบตำแหน่งของคอลัมน์", () => {
    const dp = decimalsFor([0.4, 0.04, 0.005, 3]);
    expect([0.4, 0.04, 0.005, 3].map((n) => formatQtyFixed(n, dp))).toEqual([
      "0.400",
      "0.040",
      "0.005",
      "3.000",
    ]);
  });

  it("ค่าว่าง/ไม่ใช่ตัวเลข = ข้อความว่าง", () => {
    expect(formatQtyFixed(null, 2)).toBe("");
    expect(formatQtyFixed("", 2)).toBe("");
    expect(formatQtyFixed("abc", 2)).toBe("");
  });
});
