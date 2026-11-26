import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { SlaStatus } from "../sla-status";

// ใช้ข้อความจริง เพื่อจับกรณีย้าย key ออกจาก namespace `common` แล้วลืมตามแก้
const NOW = new Date("2026-11-26T09:00:00Z");
const at = (hoursFromNow: number) =>
  new Date(NOW.getTime() + hoursFromNow * 3_600_000).toISOString();

function renderSla(
  dueAt: string | null,
  minutes: number | null,
  locale: "en" | "th" = "en",
) {
  return render(
    <IntlProvider locale={locale} messages={locale === "en" ? en : th}>
      <SlaStatus dueAt={dueAt} minutes={minutes} now={NOW} />
    </IntlProvider>,
  );
}

describe("SlaStatus", () => {
  it("shows the time left in muted text while well within the SLA", () => {
    const { container } = renderSla(at(18.4), 1440);
    const el = container.querySelector("span");
    expect(el).toHaveTextContent("SLA 18h left");
    expect(el).toHaveClass("text-muted-foreground");
  });

  it("turns amber with a quarter of the SLA or less left", () => {
    const { container } = renderSla(at(5), 1440);
    expect(container.querySelector("span")).toHaveClass("text-warning-ink");
  });

  it("turns red with the overdue time once past due", () => {
    const { container } = renderSla(at(-83.5), 1440);
    const el = container.querySelector("span");
    expect(el).toHaveTextContent("SLA over 3d");
    expect(el).toHaveClass("text-destructive");
  });

  it("reads in Thai with the number and unit kept together", () => {
    const { container } = renderSla(at(-83.5), 1440, "th");
    expect(container.querySelector("span")?.textContent).toBe(
      "SLA เกิน 3 วัน",
    );
  });

  it("shows nothing when the stage has no SLA or the row carries none", () => {
    expect(renderSla(null, null).container).toBeEmptyDOMElement();
    expect(renderSla(at(5), null).container).toBeEmptyDOMElement();
    expect(renderSla(null, 1440).container).toBeEmptyDOMElement();
  });
});
