import { describe, expect, it } from "vitest";
import { buildPrAiQuery as build } from "./build-pr-ai-query";

const TEMPLATE = [
  "You are helping a hotel purchasing officer in Thailand review a purchase request.",
  "Prices are for wholesale / foodservice supply, not retail.",
  "",
  "For each item below, give a typical wholesale price range for that pack size and",
  "say whether the quoted price looks reasonable. Answer as a short table.",
  "If you are not confident about Thai market prices, say so instead of guessing.",
  "Do not invent supplier names.",
  "",
  "{items}",
].join("\n");

const buildPrAiQuery = (items: Parameters<typeof build>[1]) =>
  build(TEMPLATE, items);

const ITEM = {
  productName: "Oseki Sake 1.8L",
  productLocalName: "เหล้าสาเก โอเซกิ",
  qty: 12,
  unitName: "BTL",
  price: 520,
  currencyCode: "THB",
};

describe("buildPrAiQuery", () => {
  it("ส่งจำนวน หน่วย และราคาที่จะจ่ายไปด้วย — ไม่ใช่แค่ชื่อสินค้า", () => {
    const q = buildPrAiQuery([ITEM]);
    expect(q).toContain("Oseki Sake 1.8L (เหล้าสาเก โอเซกิ)");
    expect(q).toContain("12 BTL");
    expect(q).toContain("520.00 THB");
  });

  it("มีบริบทว่าเป็นโรงแรมในไทย ซื้อขายส่ง", () => {
    const q = buildPrAiQuery([ITEM]);
    expect(q).toContain("hotel purchasing officer in Thailand");
    expect(q).toContain("wholesale");
  });

  it("สั่งให้ยอมรับว่าไม่รู้ และห้ามแต่งชื่อผู้ขาย", () => {
    const q = buildPrAiQuery([ITEM]);
    expect(q).toContain("say so instead of guessing");
    expect(q).toContain("Do not invent supplier names");
  });

  it("ไม่ส่งชื่อคลังออกไป แม้ผู้เรียกจะเผลอใส่มา", () => {
    const q = buildPrAiQuery([
      { ...ITEM, ...({ locationName: "F&B Main Kitchen" } as object) },
    ]);
    expect(q).not.toContain("F&B Main Kitchen");
  });

  it("ยังไม่มีราคา/จำนวน → ขีด ไม่ใช่ 0.00 หรือ undefined", () => {
    const q = buildPrAiQuery([{ productName: "Old ginger" }]);
    expect(q).toContain("| Old ginger | — | — |");
  });

  it("ราคาไม่ใส่ตัวคั่นหลักพัน — AI อ่านเป็นทศนิยมได้", () => {
    const q = buildPrAiQuery([{ ...ITEM, price: 12345.5 }]);
    expect(q).toContain("12345.50 THB");
    expect(q).not.toContain("12,345");
  });

  it("ข้ามแถวที่ไม่มีชื่อสินค้า", () => {
    const q = buildPrAiQuery([{ productName: "" }, ITEM]);
    expect(q).toContain("| 1 | Oseki Sake 1.8L");
  });
});
