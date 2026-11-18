import { describe, it, expect } from "vitest";
import { createTranslator } from "use-intl";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { formatMetric, makeWidgetLabels } from "../widget-labels";

type Messages = typeof en;

function labelsFor(locale: "en" | "th", messages: Messages, currencyCode = "") {
  const t = createTranslator({
    locale,
    messages,
    namespace: "dashboardWidget",
  });
  const tStatus = createTranslator({ locale, messages, namespace: "status" });
  return makeWidgetLabels(
    t as unknown as Parameters<typeof makeWidgetLabels>[0],
    tStatus as unknown as Parameters<typeof makeWidgetLabels>[1],
    currencyCode,
  );
}

describe("formatMetric", () => {
  it("rounds to the unit's default decimals", () => {
    expect(formatMetric(28.148, "days")).toBe("28.1"); // วันรออนุมัติ เดิมโชว์ 28.148
    expect(formatMetric(13, "items")).toBe("13");
    expect(formatMetric(24594.6, "currency")).toBe("24,595");
    expect(formatMetric(24594.6, "฿")).toBe("24,595"); // backend รุ่นก่อนเปลี่ยนเป็น token
    expect(formatMetric(0.028512, "rate")).toBe("0.0285");
  });

  it("lets the widget's decimals win and keeps trailing zeros", () => {
    expect(formatMetric(31, "rate", 2)).toBe("31.00");
    expect(formatMetric(28.148, "days", 0)).toBe("28");
  });

  it("keeps the old formatting for a unit it does not know", () => {
    expect(formatMetric(1.23456, "widgets")).toBe((1.23456).toLocaleString());
    expect(formatMetric(1.23456, undefined)).toBe((1.23456).toLocaleString());
  });
});

describe("makeWidgetLabels", () => {
  const l = labelsFor("en", en);

  it("names the axis from the dataset dimension, generic when unknown", () => {
    expect(l.dimension("status")).toBe("Status");
    expect(l.dimension("day")).toBe("Day");
    expect(l.dimension(undefined)).toBe(en.dashboardWidget.tableCol.label);
    expect(l.dimension("brand_new_token")).toBe(
      en.dashboardWidget.tableCol.label,
    );
  });

  it("titles the value column by unit instead of 'Value (items)'", () => {
    expect(l.valueHeader("items")).toBe("Count");
    // ไม่รู้สกุลของ BU = ไม่พิมพ์สกุล (ห้ามเดาเป็นบาท)
    expect(l.valueHeader("currency")).toBe("Amount");
    expect(l.valueHeader("days")).toBe("Days");
    expect(l.valueHeader("widgets")).toBe(
      `${en.dashboardWidget.tableCol.value} (widgets)`,
    );
    expect(l.valueHeader(undefined)).toBe(en.dashboardWidget.tableCol.value);
  });

  it("translates status and priority codes, keeps real names as stored", () => {
    expect(l.category("status", "in_progress")).toBe("In Progress");
    expect(l.category("status", "sent_or_print")).toBe("Sent or print");
    expect(l.category("status", "discontinued")).toBe("Discontinued");
    expect(l.category("priority", "high")).toBe("High");
    expect(l.category("status", "unknown")).toBe("Not specified");
    expect(l.category("vendor", "acme_trading co.")).toBe("acme_trading co.");
    // ไม่รู้มิติ (backend รุ่นเก่า) = humanize แบบเดิม
    expect(l.category(undefined, "in_progress")).toBe("In Progress");
  });

  it("writes a number with its unit", () => {
    expect(l.withUnit(1200, "currency")).toBe("1,200");
    expect(l.withUnit(13, "items")).toBe("13 items");
    expect(l.withUnit(28.148, "days")).toBe("28.1 days");
    expect(l.withUnit(5, "qty")).toBe("5");
    expect(l.withUnit(5, "widgets")).toBe("5 widgets");
    expect(l.unitSuffix("currency")).toBe("");
  });

  // ยอดเงินเป็นสกุลหลักของ BU — พิมพ์รหัสสกุลของ BU นั้น ไม่ล็อก ฿
  it("prints money in the BU's base currency, whichever it is", () => {
    const usd = labelsFor("en", en, "USD");
    expect(usd.withUnit(1200, "currency")).toBe("1,200 USD");
    expect(usd.unitSuffix("currency")).toBe("USD");
    expect(usd.valueHeader("currency")).toBe("Amount (USD)");
    // "฿" จาก backend รุ่นเก่าก็คือสกุลหลักเหมือนกัน — ไม่ใช่บาทตามตัวอักษร
    expect(usd.withUnit(1200, "฿")).toBe("1,200 USD");
    const thb = labelsFor("th", th as unknown as Messages, "THB");
    expect(thb.valueHeader("currency")).toBe("ยอดเงิน (THB)");
  });

  it("speaks Thai on the Thai UI", () => {
    const tl = labelsFor("th", th as unknown as Messages);
    expect(tl.dimension("location")).toBe("สถานที่");
    expect(tl.valueHeader("items")).toBe("จำนวน");
    expect(tl.category("status", "approved")).toBe("อนุมัติ");
    expect(tl.withUnit(13, "items")).toBe("13 รายการ");
  });

  // token ชุดเดียวกับ micro-data service/dashboard/dimension.go — token ที่ไม่มีคำแปล
  // จะตกไปเป็นหัวกลาง "Name" เงียบ ๆ
  it.each([
    ["en", en],
    ["th", th],
  ])("%s has a header for every backend dimension token", (_l, msgs) => {
    const dims = (msgs as Messages).dashboardWidget.dimension as Record<
      string,
      string
    >;
    for (const token of [
      "status",
      "priority",
      "vendor",
      "department",
      "location",
      "product",
      "product_category",
      "item_group",
      "unit",
      "business_type",
      "reason",
      "tax_rate",
      "currency",
      "cuisine",
      "recipe_category",
      "recipe",
      "equipment_category",
      "document",
      "period",
      "day",
      "month",
      "date",
    ]) {
      expect(dims[token], `missing dimension.${token}`).toBeTruthy();
    }
  });
});
