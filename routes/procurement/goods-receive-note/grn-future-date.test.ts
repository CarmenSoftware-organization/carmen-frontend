import { describe, it, expect } from "vitest";
import { isFutureReceiveDate } from "./grn-future-date";

// สร้างวันที่ด้วยเวลาเครื่อง (เหมือนที่ปฏิทินเลือก) แล้วแปลงเป็น ISO — เทสต์จึงไม่ขึ้นกับ TZ ที่รัน
const localDay = (y: number, m: number, d: number) =>
  new Date(y, m - 1, d).toISOString();
const today = new Date(2026, 9, 21, 10, 4);

describe("isFutureReceiveDate", () => {
  it("วันที่หลังวันนี้ = ยังมาไม่ถึง (เคส BLAVG GRN261100001 ลงวันที่ 11/11 ตอน 21/10)", () => {
    expect(isFutureReceiveDate(localDay(2026, 11, 11), today)).toBe(true);
    expect(isFutureReceiveDate(localDay(2026, 10, 22), today)).toBe(true);
  });

  it("รับวันนี้ไม่ถาม แม้เวลาบนใบจะเป็นเที่ยงคืน", () => {
    expect(isFutureReceiveDate(localDay(2026, 10, 21), today)).toBe(false);
  });

  it("วันที่ผ่านมาแล้วไม่ถาม", () => {
    expect(isFutureReceiveDate(localDay(2026, 10, 20), today)).toBe(false);
    expect(isFutureReceiveDate(localDay(2025, 1, 1), today)).toBe(false);
  });

  it("ยังไม่กรอก หรือค่าเพี้ยน ไม่ถาม", () => {
    expect(isFutureReceiveDate(null, today)).toBe(false);
    expect(isFutureReceiveDate(undefined, today)).toBe(false);
    expect(isFutureReceiveDate("", today)).toBe(false);
    expect(isFutureReceiveDate("not-a-date", today)).toBe(false);
  });
});
