import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TableCard, WidgetRouter } from "../dashboard-widget-grid";
import type { ResolvedWidget } from "../dashboard-widget-grid";
import { WidgetParamsBadges } from "../widget-status";

vi.mock("use-intl", () => ({
  useTranslations: () =>
    Object.assign(
      (key: string, values?: Record<string, unknown>) =>
        values ? `${key}:${JSON.stringify(values)}` : key,
      { has: () => true },
    ),
  useLocale: () => "en",
}));

// movement by location × 2 periods — rows = series (งวด), cols = แกน x (location)
const movement = {
  rows: ["2601", "2602"],
  cols: ["Kitchen", "Main Store"],
  values: [
    [120, 0],
    [80, 45.5],
  ],
};

function widgetOf(type: string): ResolvedWidget {
  return {
    id: "w-m",
    dataset_id: "inventory.movement-by-location-period",
    widget_type: type,
    title: "Movement",
    order_index: 0,
    params: {},
    meta: {
      id: "inventory.movement-by-location-period",
      name: "Movement by location — by period",
      shape: "matrix",
      category: "movement",
      unit: "",
    },
    data: movement,
  } as ResolvedWidget;
}

const wrap = { wrapper: MemoryRouter };
const sub = () => "document";

describe("matrix cards", () => {
  it.each(["bar", "line"])(
    "%s card lists every series in its legend",
    (type) => {
      const { container } = render(
        <WidgetRouter
          widget={widgetOf(type)}
          moduleName="inventory"
          subTileFor={sub}
        />,
        wrap,
      );
      const legend = [...container.querySelectorAll("ul li")].map(
        (li) => li.textContent,
      );
      expect(legend).toEqual(["2601", "2602"]);
    },
  );

  it("table puts the buckets in rows and one column per period", () => {
    const { getByText } = render(
      <TableCard
        widget={widgetOf("table")}
        moduleName="inventory"
        subTileFor={sub}
      />,
      wrap,
    );
    expect(getByText("2601")).toBeTruthy();
    expect(getByText("2602")).toBeTruthy();
    expect(getByText("Main Store")).toBeTruthy();
    expect(getByText("45.5")).toBeTruthy();
  });

  it("an empty comparison says no data instead of drawing nothing", () => {
    const empty = {
      ...widgetOf("bar"),
      data: { rows: [], cols: [], values: [] },
    } as ResolvedWidget;
    const { getByText } = render(
      <WidgetRouter widget={empty} moduleName="inventory" subTileFor={sub} />,
      wrap,
    );
    expect(getByText("noData")).toBeTruthy();
  });
});

describe("WidgetParamsBadges", () => {
  it("shows the compared periods and how many entities are filtered", () => {
    const { container } = render(
      <WidgetParamsBadges
        params={{ periods: "@current_period,2601", locations: "a,b,a" }}
      />,
    );
    const chips = [...container.querySelectorAll("span")].map(
      (s) => s.textContent,
    );
    expect(chips).toContain("current_period · 2601");
    expect(chips).toContain('locations:{"count":2}');
  });

  it("shows period vs compare_to for a vs-period KPI", () => {
    const { container } = render(
      <WidgetParamsBadges params={{ period: "2602", compare_to: "2601" }} />,
    );
    expect(container.textContent).toContain("2602 vs 2601");
  });

  it("stays out of the way when nothing is picked", () => {
    const { container } = render(
      <WidgetParamsBadges params={{ locations: "" }} />,
    );
    expect(container.innerHTML).toBe("");
  });
});
