import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import th from "@/messages/th.json";
import { KpiCard } from "../dashboard-widget-grid";
import { datasetMessageKey } from "../use-widget-title";

type Widget = Parameters<typeof KpiCard>[0]["widget"];

function kpi(
  meta: Record<string, unknown>,
  data: { value: number; prev?: number },
  params?: Record<string, string | number>,
) {
  const widget = {
    id: "w1",
    dataset_id: "workflow.cn-pending-approval",
    title: "Card",
    widget_type: "kpi",
    params,
    meta: { id: "x.y", name: "Card", category: "workflow", ...meta },
    data,
  } as unknown as Widget;
  return render(
    <IntlProvider locale="en" messages={en}>
      <KpiCard widget={widget} moduleName="dashboard" subTileFor={() => "x"} />
    </IntlProvider>,
  );
}

// `prev` ของ backend มี 3 ความหมาย — คำบรรยายต้องตรงกับที่คำนวณจริง (meta.delta_kind)
describe("KPI delta line says what prev really is", () => {
  it("a pending tile reports the aged part, not a fake trend", () => {
    // ค้าง 10 ใบ เกิน 7 วัน 3 ใบ — เดิมขึ้น "+7 (233%) vs. previous period"
    kpi(
      { shape: "scalar_delta", unit: "items", delta_kind: "aged" },
      { value: 10, prev: 3 },
    );
    expect(screen.getByText("3 waiting 7+ days")).toBeInTheDocument();
    expect(screen.queryByText(/previous period/)).toBeNull();
    expect(screen.queryByText(/233%/)).toBeNull();
  });

  it("uses the widget's own aging threshold", () => {
    kpi(
      { shape: "scalar_delta", unit: "items", delta_kind: "aged" },
      { value: 10, prev: 2 },
      { aging_days: "14" },
    );
    expect(screen.getByText("2 waiting 14+ days")).toBeInTheDocument();
  });

  it("says nothing when no document has aged", () => {
    kpi(
      { shape: "scalar_delta", unit: "items", delta_kind: "aged" },
      { value: 10, prev: 0 },
    );
    expect(screen.queryByText(/waiting/)).toBeNull();
  });

  it("names the period a vs-period KPI was compared with", () => {
    kpi(
      { shape: "scalar_delta", unit: "items", delta_kind: "compare_period" },
      { value: 12, prev: 8 },
      { period: "@current_period", compare_to: "2610" },
    );
    expect(screen.getByText("vs. 2610")).toBeInTheDocument();
  });

  it("an 'added' tile compares with the range just before", () => {
    kpi(
      { shape: "scalar_delta", unit: "items", delta_kind: "previous_window" },
      { value: 12, prev: 8 },
    );
    expect(screen.getByText("vs. the range before")).toBeInTheDocument();
  });

  it("shows money and its delta to two decimals", () => {
    // ยอดสั่งซื้อเทียบงวด: เดิมผลต่างขึ้น "-50,809.343"
    kpi(
      { shape: "scalar_delta", unit: "currency", delta_kind: "compare_period" },
      { value: 404.55, prev: 51213.8927558 },
    );
    expect(screen.getByText("404.55")).toBeInTheDocument();
    expect(screen.getByText(/-50,809\.34 \(-99%\)/)).toBeInTheDocument();
    expect(screen.queryByText(/50,809\.343/)).toBeNull();
  });

  it("keeps the old caption for a backend that sends no kind", () => {
    kpi({ shape: "scalar_delta", unit: "items" }, { value: 12, prev: 8 });
    expect(
      screen.getByText(en.dashboardWidget.deltaCompare),
    ).toBeInTheDocument();
  });
});

// ชื่อ dataset: id เทียบงวดมีจุดสองจุด (`document.pr-count.vs-period`) เดิมหาคำแปลไม่ได้เลย
describe("dataset names", () => {
  it("maps an id to its message key", () => {
    expect(datasetMessageKey("product.total-active")).toBe(
      "product.total-active",
    );
    expect(datasetMessageKey("document.pr-count.vs-period")).toBe(
      "document.pr-count__vs-period",
    );
  });

  // dataset ที่เคยไม่มีชื่อไทย (micro-data main 2026-11-18) — เพิ่ม dataset ใหม่ฝั่ง backend
  // ต้องเติมที่นี่และในไฟล์แปลทั้งสองภาษา
  const ids = [
    "inventory.slow-moving",
    "procurement.top-purchased-products",
    "procurement.top-purchasing-vendors",
    "procurement.purchasing-value.vs-period",
    "procurement.purchasing-by-category",
    "procurement.purchasing-by-department",
    "procurement.pr-pending-by-stage",
    "procurement.po-awaiting-delivery",
    "procurement.po-expected-deliveries",
    "procurement.po-overdue",
    "procurement.po-partially-received",
    "procurement.po-over-received",
    "document.sr-top-products",
    "procurement.po-due-count",
    "procurement.pr-awaiting-po",
    "procurement.purchasing-by-category.vs-ytd",
    "document.sr-awaiting-approval",
    "inventory.physical-count-by-location",
    "inventory.physical-count-completed-locations",
    "inventory.movement-by-location.vs-ytd",
    "inventory.expiring-items-count",
    "inventory.expired-items",
    ...["pr", "po", "sr", "grn"].map((d) => `document.${d}-count.fiscal-ytd`),
    ...["pr", "po", "sr"].map((d) => `document.${d}-rejected-count`),
    ...["pr", "po", "sr", "grn"].flatMap((d) => [
      `document.${d}-by-status.by-period`,
      `document.${d}-created-series.by-period`,
      `document.${d}-count.vs-period`,
    ]),
    "procurement.pr-by-status.by-period",
    "procurement.pr-by-department.by-period",
    "inventory.physical-count-by-status.by-period",
    "inventory.spot-check-by-status.by-period",
    "inventory.stock-in-by-status.by-period",
    "inventory.stock-out-by-status.by-period",
    "inventory.issue-by-priority.by-period",
    "inventory.movement-by-location-period",
  ];
  it.each([
    ["en", en],
    ["th", th],
  ])("%s names every comparison / ranking dataset", (_l, msgs) => {
    const datasets = (
      msgs as unknown as {
        dashboard: { datasets: Record<string, Record<string, string>> };
      }
    ).dashboard.datasets;
    for (const id of ids) {
      const [mod, rest] = datasetMessageKey(id).split(/\.(.*)/s);
      expect(datasets[mod]?.[rest], id).toEqual(expect.any(String));
    }
  });
});
