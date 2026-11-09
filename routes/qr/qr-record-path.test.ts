import { describe, it, expect } from "vitest";
import { qrRecordPath } from "./qr-record-path";

const ID = "0f8c6a52-3f1e-4b6a-9d1c-2a7b5e9c4d10";

describe("qrRecordPath — QR บนกระดาษ → หน้าเอกสาร", () => {
  it.each([
    ["pr", `/procurement/purchase-request/${ID}`],
    ["po", `/procurement/purchase-order/${ID}`],
    ["grn", `/procurement/goods-receive-note/${ID}`],
    ["cn", `/procurement/credit-note/${ID}`],
    ["sr", `/store-operation/store-requisition/${ID}`],
    ["pc", `/inventory-management/physical-count/${ID}`],
    ["sc", `/inventory-management/spot-check/${ID}`],
    ["rfp", `/vendor-management/request-price-list/${ID}`],
    ["vendor", `/vendor-management/vendor/${ID}`],
    ["recipe", `/operation-plan/recipe/${ID}`],
  ])("%s → หน้าของมัน", (type, path) => {
    expect(qrRecordPath(type, ID)).toBe(path);
  });

  it("SI / SO อยู่หน้าเดียวกัน แยกด้วย ?type= (ไม่ส่ง หน้าจะขึ้น error)", () => {
    expect(qrRecordPath("si", ID)).toBe(
      `/inventory-management/inventory-adjustment/${ID}?type=stock-in`,
    );
    expect(qrRecordPath("so", ID)).toBe(
      `/inventory-management/inventory-adjustment/${ID}?type=stock-out`,
    );
  });

  it("ไม่สนตัวพิมพ์เล็กใหญ่ของชนิดและ id", () => {
    expect(qrRecordPath("PR", ID.toUpperCase())).toBe(
      `/procurement/purchase-request/${ID}`,
    );
  });

  it.each([
    ["ชนิดที่ไม่รู้จัก", "eop", ID],
    ["ไม่มีชนิด", undefined, ID],
    ["id เป็นเลขที่เอกสาร ไม่ใช่ UUID", "pr", "PR2611000012"],
    ["id ที่พยายามพาไปที่อื่น", "pr", "../../dashboard"],
    ["ไม่มี id", "pr", undefined],
  ])("%s → null", (_label, type, id) => {
    expect(qrRecordPath(type, id)).toBeNull();
  });
});
