import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import { cloneElement, isValidElement, type ReactNode } from "react";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { KpiCard, TableCard, WidgetRouter } from "../dashboard-widget-grid";
import type { ResolvedWidget } from "../dashboard-widget-grid";
import type { DatasetMeta } from "@/types/dashboard-widget";

// jsdom ไม่มีขนาดจริง — ResponsiveContainer จะไม่วาดกราฟเลย ให้กล่องคงที่แทน
// การ์ดที่เหลือ (แกน ป้าย series) เป็นของจริงทั้งหมด
vi.mock("recharts", async (orig) => {
  const actual = await orig<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: ReactNode }) =>
      isValidElement(children)
        ? cloneElement(
            children as React.ReactElement<Record<string, unknown>>,
            {
              width: 600,
              height: 400,
            },
          )
        : null,
  };
});

function widgetOf(
  type: string,
  meta: Partial<DatasetMeta>,
  data: unknown,
): ResolvedWidget {
  return {
    id: "w1",
    dataset_id: meta.id ?? "ds",
    widget_type: type,
    title: "T",
    order_index: 0,
    params: {},
    meta: {
      id: "ds",
      name: "Dataset",
      shape: "categorical",
      category: "workflow",
      ...meta,
    },
    data,
  } as ResolvedWidget;
}

function renderIn(ui: React.ReactElement, messages = en, locale = "en") {
  return render(
    <IntlProvider locale={locale} messages={messages}>
      <MemoryRouter>{ui}</MemoryRouter>
    </IntlProvider>,
  );
}

const headers = (c: HTMLElement) =>
  [...c.querySelectorAll("thead th")].map((th) => th.textContent?.trim());
const firstColumn = (c: HTMLElement) =>
  [...c.querySelectorAll("tbody tr")].map((tr) =>
    tr.querySelector("td")?.textContent?.trim(),
  );

const sub = () => "document";

describe("table headers follow the dataset dimension", () => {
  it("names the columns 'Status | Count' and translates the codes", () => {
    const w = widgetOf(
      "table",
      { shape: "categorical", unit: "items", dimension: "status" },
      [
        { label: "in_progress", value: 13 },
        { label: "sent_or_print", value: 2 },
      ],
    );
    const { container } = renderIn(
      <TableCard widget={w} moduleName="procurement" subTileFor={sub} />,
    );
    expect(headers(container)).toEqual(["Status", "Count"]);
    expect(firstColumn(container)).toEqual(["In Progress", "Sent or print"]);
  });

  it("rounds ranked days instead of printing 28.148", () => {
    const w = widgetOf(
      "table",
      { shape: "ranked", unit: "days", dimension: "document" },
      [{ rank: 1, label: "PR26100001", value: 28.148 }],
    );
    const { container } = renderIn(
      <TableCard widget={w} moduleName="procurement" subTileFor={sub} />,
    );
    expect(headers(container)).toEqual(["#", "Document no.", "Days"]);
    expect(container.textContent).toContain("28.1");
    expect(container.textContent).not.toContain("28.148");
  });

  it("keeps the generic headers when the backend sends no dimension", () => {
    const w = widgetOf("table", { shape: "categorical", unit: "items" }, [
      { label: "draft", value: 1 },
    ]);
    const { container } = renderIn(
      <TableCard widget={w} moduleName="procurement" subTileFor={sub} />,
    );
    expect(headers(container)).toEqual([
      en.dashboardWidget.tableCol.label,
      "Count",
    ]);
  });

  it("puts a comparison's statuses in rows and its periods in columns", () => {
    const w = widgetOf(
      "table",
      {
        shape: "matrix",
        unit: "items",
        dimension: "status",
        series_dimension: "period",
      },
      {
        rows: ["2609", "2610"],
        cols: ["committed", "in_progress", "voided"],
        values: [
          [4, 0, 4],
          [17, 2, 13],
        ],
      },
    );
    const { container } = renderIn(
      <TableCard widget={w} moduleName="inventory" subTileFor={sub} />,
    );
    expect(headers(container)).toEqual(["Status", "2609", "2610"]);
    expect(firstColumn(container)).toEqual([
      "Committed",
      "In Progress",
      "Voided",
    ]);
  });

  // vendor × เดือน: 10 vendor กับเดือนเดียว เคยเป็นตารางกว้าง 10 คอลัมน์ 1 แถว
  it("turns a wide matrix so the longer side runs down the rows", () => {
    const w = widgetOf(
      "table",
      {
        shape: "matrix",
        unit: "฿",
        dimension: "month",
        series_dimension: "vendor",
      },
      {
        rows: ["Vendor A", "Vendor B", "Vendor C"],
        cols: ["2026-10"],
        values: [[1200], [800], [50]],
      },
    );
    const { container } = renderIn(
      <TableCard widget={w} moduleName="procurement" subTileFor={sub} />,
    );
    expect(headers(container)).toEqual(["Vendor", "2026-10"]);
    expect(firstColumn(container)).toEqual([
      "Vendor A",
      "Vendor B",
      "Vendor C",
    ]);
    expect(container.textContent).toContain("1,200");
  });
});

describe("chart cards", () => {
  const series = [
    { date: "2026-10-06", value: 18 },
    { date: "2026-10-08", value: 8 },
    { date: "2026-10-14", value: 12 },
  ];

  // เคยวาดเป็นเส้นเหมือน line เป๊ะ — ปุ่ม Area ไม่มีผล
  it("fills the area under the line for an area widget", () => {
    const meta = {
      shape: "time_series" as const,
      unit: "items",
      dimension: "date",
    };
    const area = renderIn(
      <WidgetRouter
        widget={widgetOf("area", meta, series)}
        moduleName="procurement"
        subTileFor={sub}
      />,
    );
    expect(area.container.querySelector(".recharts-area-area")).not.toBeNull();
    area.unmount();

    const line = renderIn(
      <WidgetRouter
        widget={widgetOf("line", meta, series)}
        moduleName="procurement"
        subTileFor={sub}
      />,
    );
    expect(line.container.querySelector(".recharts-area-area")).toBeNull();
    expect(line.container.querySelector(".recharts-line")).not.toBeNull();
  });

  it("draws a saved line over statuses as bars instead", () => {
    const w = widgetOf(
      "line",
      {
        shape: "matrix",
        unit: "items",
        dimension: "status",
        series_dimension: "period",
      },
      { rows: ["2609"], cols: ["draft", "voided"], values: [[1, 2]] },
    );
    const { container } = renderIn(
      <WidgetRouter widget={w} moduleName="procurement" subTileFor={sub} />,
    );
    expect(container.querySelector(".recharts-line")).toBeNull();
    expect(container.querySelector(".recharts-bar")).not.toBeNull();
  });

  it("translates matrix bar categories and drops zero labels when dense", () => {
    const days = Array.from({ length: 31 }, (_, i) =>
      String(i + 1).padStart(2, "0"),
    );
    const dense = widgetOf(
      "bar",
      {
        shape: "matrix",
        unit: "items",
        dimension: "day",
        series_dimension: "period",
      },
      {
        rows: ["2609", "2610"],
        cols: days,
        values: [days.map((_, i) => (i === 0 ? 3 : 0)), days.map(() => 0)],
      },
    );
    const a = renderIn(
      <WidgetRouter widget={dense} moduleName="procurement" subTileFor={sub} />,
    );
    const labelsOf = (c: HTMLElement) =>
      [...c.querySelectorAll(".recharts-label-list text")].map(
        (t) => t.textContent,
      );
    expect(labelsOf(a.container).filter((v) => v === "0")).toEqual([]);
    expect(labelsOf(a.container)).toContain("3");
    a.unmount();

    const short = widgetOf(
      "bar",
      {
        shape: "matrix",
        unit: "items",
        dimension: "status",
        series_dimension: "period",
      },
      { rows: ["2609"], cols: ["in_progress", "voided"], values: [[0, 4]] },
    );
    const b = renderIn(
      <WidgetRouter widget={short} moduleName="procurement" subTileFor={sub} />,
    );
    // รายการสั้นยังโชว์ 0 ให้รู้ว่า "ไม่มี" ไม่ใช่ "หาย"
    expect(labelsOf(b.container)).toContain("0");
    expect(b.container.textContent).toContain("In Progress");
    expect(b.container.textContent).not.toContain("in_progress");
  });

  it("writes the KPI unit in the UI language", () => {
    const w = widgetOf(
      "kpi",
      { shape: "scalar", unit: "items" },
      { value: 33 },
    );
    const { container } = renderIn(
      <KpiCard widget={w} moduleName="procurement" subTileFor={sub} />,
      th as unknown as typeof en,
      "th",
    );
    expect(container.textContent).toContain("รายการ");
    expect(container.textContent).not.toContain("items");
  });
});
