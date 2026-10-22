import { describe, expect, it } from "vitest";
import { interfaceEntitlement } from "../use-interface-entitlement";

const FULL_POS = ["interface", "interface.pos", "interface.pos.simphony"];

describe("interfaceEntitlement", () => {
  it("ไม่มีข้อมูล license เลย = none", () => {
    expect(interfaceEntitlement(undefined, undefined, "pos", "simphony")).toBe(
      "none",
    );
  });

  it("สัญญาว่าง = none", () => {
    expect(interfaceEntitlement([], [], "pos", "simphony")).toBe("none");
  });

  it("มีสายคีย์ครบ = entitled", () => {
    expect(interfaceEntitlement(FULL_POS, [], "pos", "simphony")).toBe("entitled");
  });

  it("มีแต่ leaf ไม่มีบรรพบุรุษ = none", () => {
    expect(
      interfaceEntitlement(["interface.pos.simphony"], [], "pos", "simphony"),
    ).toBe("none");
  });

  it("brand อื่นใน category เดียวกันไม่ได้ตามไปด้วย", () => {
    expect(interfaceEntitlement(FULL_POS, [], "pos", "square")).toBe("none");
  });

  it("category ไม่ตรงกับ brand = none", () => {
    expect(interfaceEntitlement(FULL_POS, [], "pms", "simphony")).toBe("none");
  });

  it("leaf อยู่ใน expired แต่บรรพบุรุษยัง active = expired", () => {
    expect(
      interfaceEntitlement(
        ["interface", "interface.pos"],
        ["interface.pos.simphony"],
        "pos",
        "simphony",
      ),
    ).toBe("expired");
  });

  it("ทั้งสายอยู่ใน expired = expired", () => {
    expect(interfaceEntitlement([], FULL_POS, "pos", "simphony")).toBe("expired");
  });

  it("leaf อยู่ใน expired แต่บรรพบุรุษไม่อยู่ในทั้งสองรายการ = none", () => {
    // ปิดช่องโหว่: ถ้า impl ตรวจ expired path ด้วยแค่ leaf key (ไม่รวม chain) เคสนี้จะ
    // หลุดเป็น "expired" ทั้งที่บรรพบุรุษไม่เคยอยู่ใน features หรือ expiredFeatures เลย
    expect(
      interfaceEntitlement([], ["interface.pos.simphony"], "pos", "simphony"),
    ).toBe("none");
  });
});
