import { describe, it, expect } from "vitest";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

/**
 * ค่าตัวเลือกของ param ที่ micro-data ประกาศไว้ (service/dashboard ณ md#41) — ฟอร์ม
 * WidgetParamFields แปลง "@token" เป็น savedWidget.timeRange.<token> และค่าอื่นเป็น
 * savedWidget.option.<value> ถ้าไม่มีคำแปลจะแสดงค่าดิบ (เช่น "@all") ใน dropdown
 * เพิ่มตัวเลือกใหม่ฝั่ง micro-data แล้วต้องเติมรายการนี้ + คำแปลทั้งสองภาษา
 */
const TIME_RANGE_TOKENS = [
  "today",
  "3days",
  "7days",
  "14days",
  "30days",
  "90days",
  "1month",
  "all",
  "current_period",
  "previous_period",
];
const OPTION_VALUES = [
  // inventory.movement-by-location-period metric
  "received",
  "issued",
  "consumption",
  "transfer_in",
  "transfer_out",
  "opening",
  "closing",
  // document.sr-top-products rank_by
  "requests",
  "qty",
  // lab series granularity
  "day",
  "week",
  "month",
];

describe.each([
  ["en", en],
  ["th", th],
])("dashboard param option labels (%s)", (_lang, messages) => {
  const saved = messages.dashboard.savedWidget as {
    timeRange: Record<string, string>;
    option: Record<string, string>;
  };

  it.each(TIME_RANGE_TOKENS)("time range @%s has a label", (token) => {
    expect(saved.timeRange[token]).toBeTruthy();
  });

  it.each(OPTION_VALUES)("option %s has a label", (value) => {
    expect(saved.option[value]).toBeTruthy();
  });
});
