import { describe, it, expect } from "vitest";
import { EMPTY_DETAIL } from "./grn-form-schema";
import { findExpiredLines, isExpiredOn } from "./grn-expiry";

// สร้างวันที่ด้วยเวลาเครื่อง (เหมือนที่ปฏิทินเลือก) แล้วแปลงเป็น ISO — เทสต์จึงไม่ขึ้นกับ TZ ที่รัน
const localDay = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d).toISOString();
const today = new Date(2026, 9, 29, 15, 30);

describe("isExpiredOn", () => {
  it("วันที่ผ่านมาแล้ว = หมดอายุ", () => {
    expect(isExpiredOn(localDay(2026, 10, 28), today)).toBe(true);
    expect(isExpiredOn(localDay(2025, 1, 1), today)).toBe(true);
  });

  it("หมดอายุวันนี้ยังไม่นับว่าหมด แม้เวลาจะผ่านไปแล้ว", () => {
    expect(isExpiredOn(localDay(2026, 10, 29), today)).toBe(false);
  });

  it("วันพรุ่งนี้ขึ้นไปไม่หมด", () => {
    expect(isExpiredOn(localDay(2026, 10, 30), today)).toBe(false);
  });

  it("ไม่ได้กรอก หรือค่าเพี้ยน ไม่นับว่าหมด", () => {
    expect(isExpiredOn(null, today)).toBe(false);
    expect(isExpiredOn(undefined, today)).toBe(false);
    expect(isExpiredOn("", today)).toBe(false);
    expect(isExpiredOn("not-a-date", today)).toBe(false);
  });
});

describe("findExpiredLines", () => {
  it("คืนเฉพาะบรรทัดที่หมดอายุแล้ว ตามลำดับในฟอร์ม", () => {
    const lines = [
      { ...EMPTY_DETAIL, product_name: "A", expired_at: localDay(2026, 10, 1) },
      { ...EMPTY_DETAIL, product_name: "B", expired_at: null },
      { ...EMPTY_DETAIL, product_name: "C", expired_at: localDay(2027, 1, 1) },
      { ...EMPTY_DETAIL, product_name: "D", expired_at: localDay(2026, 10, 28) },
    ];
    expect(findExpiredLines(lines, today).map((l) => l.product_name)).toEqual([
      "A",
      "D",
    ]);
  });

  it("ไม่มีรายการ = ไม่มีอะไรต้องถาม", () => {
    expect(findExpiredLines(undefined, today)).toEqual([]);
    expect(findExpiredLines([], today)).toEqual([]);
  });
});
