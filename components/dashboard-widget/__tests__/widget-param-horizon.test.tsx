import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetParamFields } from "../widget-param-fields";
import en from "@/messages/en.json";
import th from "@/messages/th.json";

// คำแปลสองชุดที่ token เดียวกันอ่านต่างกัน: ย้อนหลัง (timeRange) กับมองไปข้างหน้า (horizon)
const LABELS: Record<string, Record<string, string>> = {
  "dashboard.savedWidget.timeRange": { "30days": "Last 30 days" },
  "dashboard.savedWidget.horizon": { "30days": "Within 30 days" },
};

vi.mock("use-intl", () => ({
  useTranslations: (ns: string) =>
    Object.assign((key: string) => LABELS[ns]?.[key] ?? key, {
      has: (key: string) => key in (LABELS[ns] ?? {}),
    }),
}));

describe("WidgetParamFields — forward horizons", () => {
  // Radix Select ใน jsdom (แบบเดียวกับ widget-param-fields.test.tsx)
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: () => false, configurable: true },
    setPointerCapture: { value: () => {}, configurable: true },
    releasePointerCapture: { value: () => {}, configurable: true },
    scrollIntoView: { value: () => {}, configurable: true },
  });

  const optionsOf = async (name: string) => {
    const { unmount } = render(
      <WidgetParamFields
        params={[
          {
            name,
            label: name,
            type: "text",
            required: false,
            default: "@30days",
            options: ["@30days"],
          },
        ]}
        values={{ [name]: "@30days" }}
        onChange={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const out = screen.getAllByRole("option").map((o) => o.textContent);
    unmount();
    return out;
  };

  it("reads a *_within token as a horizon ahead, not a look-back", async () => {
    expect(await optionsOf("expiry_within")).toEqual(["Within 30 days"]);
    expect(await optionsOf("starts_within")).toEqual(["Within 30 days"]);
  });

  it("keeps the look-back wording for time_range", async () => {
    expect(await optionsOf("time_range")).toEqual(["Last 30 days"]);
  });

  // token ที่ backend เปิดให้ expiry_within / starts_within ต้องมีป้ายครบทั้งสองภาษา
  it.each([
    ["en", en],
    ["th", th],
  ])("has a %s horizon label for every forward token", (_lang, messages) => {
    const horizon = messages.dashboard.savedWidget.horizon as Record<
      string,
      string
    >;
    for (const key of ["7days", "14days", "30days", "90days"]) {
      expect(horizon[key]).toBeTruthy();
    }
  });
});
