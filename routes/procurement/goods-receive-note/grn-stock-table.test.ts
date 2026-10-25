import { describe, it, expect } from "vitest";
import { grnStockVisible } from "./grn-stock-table";

/**
 * แท็บ Stock Movement เปิดเมื่อของเข้าคลังแล้ว — FIFO ลงตอน commit ส่วนต้นทุนเฉลี่ยลงตั้งแต่ save
 */
describe("grnStockVisible", () => {
  it.each(["fifo", "average", "average_per_location", undefined])(
    "ใบ committed เห็นเสมอ (%s)",
    (method) => {
      expect(grnStockVisible("committed", method)).toBe(true);
    },
  );

  it.each(["average", "average_per_location"])(
    "ใบ saved ของ %s เห็น เพราะลงสต๊อกไปแล้วตั้งแต่ตอน save",
    (method) => {
      expect(grnStockVisible("saved", method)).toBe(true);
    },
  );

  it("ใบ saved ของ FIFO ยังไม่เห็น เพราะของยังไม่เข้าคลัง", () => {
    expect(grnStockVisible("saved", "fifo")).toBe(false);
  });

  it("ไม่รู้วิธีคิดต้นทุน (profile ยังโหลดไม่เสร็จ) ถือว่ายังไม่เห็น", () => {
    expect(grnStockVisible("saved", null)).toBe(false);
  });

  it.each(["draft", "voided", undefined])("ใบ %s ไม่เห็น", (status) => {
    expect(grnStockVisible(status, "average")).toBe(false);
  });
});
