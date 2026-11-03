import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WidgetParamFields } from "../widget-param-fields";

// คำแปลจริงของ dashboard.savedWidget (ป้ายเดียวกับ status group)
const SAVED_WIDGET: Record<string, string> = { visAll: "All", visMine: "Mine" };

vi.mock("use-intl", () => ({
  useTranslations: (ns: string) =>
    Object.assign(
      (key: string) =>
        ns === "dashboard.savedWidget" ? (SAVED_WIDGET[key] ?? key) : key,
      {
        has: (key: string) =>
          ns === "dashboard.savedWidget.timeRange" && key === "1month",
      },
    ),
}));

describe("WidgetParamFields — owner scope", () => {
  // Radix Select ใน jsdom (แบบเดียวกับ dimension-page.test.tsx)
  Object.defineProperties(HTMLElement.prototype, {
    hasPointerCapture: { value: () => false, configurable: true },
    setPointerCapture: { value: () => {}, configurable: true },
    releasePointerCapture: { value: () => {}, configurable: true },
    scrollIntoView: { value: () => {}, configurable: true },
  });

  it("labels @everyone / @current_user as All / Mine, not the raw tokens", async () => {
    render(
      <WidgetParamFields
        params={[
          {
            name: "owner_visibility",
            label: "Created by",
            type: "text",
            required: true,
            default: "@everyone",
            options: ["@everyone", "@current_user"],
          },
        ]}
        values={{ owner_visibility: "@everyone" }}
        onChange={() => {}}
      />,
    );
    expect(screen.getByText("Created by")).toBeTruthy();
    await userEvent.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    expect(options).toEqual(["All", "Mine"]);
  });

  it("still reads other @ tokens as time ranges", async () => {
    render(
      <WidgetParamFields
        params={[
          {
            name: "time_range",
            label: "Time range",
            type: "text",
            required: false,
            default: "@1month",
            options: ["@1month", "@today"],
          },
        ]}
        values={{ time_range: "@1month" }}
        onChange={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("combobox"));
    const options = screen.getAllByRole("option").map((o) => o.textContent);
    // tRange มีคำแปลของ 1month (ใน mock คืน key) · @today ไม่มี → ค่าดิบ
    expect(options).toEqual(["1month", "@today"]);
  });
});
