import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { TableCard } from "../dashboard-widget-grid";
import type { ResolvedWidget } from "../dashboard-widget-grid";
import type { TableData } from "@/types/dashboard-widget";

// t(key) → key (covers TableCard + WidgetHeader subtree)
vi.mock("use-intl", () => ({
  useTranslations: () =>
    Object.assign((key: string) => key, { has: () => false }),
  useLocale: () => "en",
}));

function makeWidget(data: TableData): ResolvedWidget {
  return {
    id: "w1",
    dataset_id: "document.pr-table",
    widget_type: "table",
    title: "SENT BACK PRs",
    order_index: 0,
    params: {},
    meta: {
      id: "document.pr-table",
      name: "Purchase Request table",
      shape: "table",
      category: "workflow",
    },
    data,
  } as ResolvedWidget;
}

const noop = () => "purchaseRequest";

describe("TableCard", () => {
  it("renders data-driven column headers and a cell value", () => {
    const data: TableData = {
      columns: [
        { key: "pr_number", label: "PR Number", type: "text" },
        { key: "item_name", label: "Item Name", type: "text" },
        { key: "amount", label: "Amount", type: "number" },
      ],
      rows: [
        {
          pr_number: "PR-2503001",
          item_name: "Singha Beer 320ml",
          amount: 1250,
        },
      ],
    };
    const { container } = render(
      <TableCard
        widget={makeWidget(data)}
        moduleName="procurement"
        subTileFor={noop}
      />,
      { wrapper: MemoryRouter },
    );
    expect(container.textContent).toContain("PR Number");
    expect(container.textContent).toContain("Item Name");
    expect(container.textContent).toContain("Amount");
    expect(container.textContent).toContain("PR-2503001");
    expect(container.textContent).toContain("1,250"); // numeric formatting
  });

  it("renders an icon column value as a lucide icon (undo-2)", () => {
    const data: TableData = {
      columns: [
        { key: "action_icon", label: "", type: "icon" },
        { key: "item_name", label: "Item's Name", type: "text" },
      ],
      rows: [{ action_icon: "undo-2", item_name: "Dishwashing Liquid" }],
    };
    const { container } = render(
      <TableCard
        widget={makeWidget(data)}
        moduleName="procurement"
        subTileFor={noop}
      />,
      { wrapper: MemoryRouter },
    );
    // lucide renders an <svg class="lucide lucide-undo-2 ...">
    expect(container.querySelector("svg.lucide-undo-2")).not.toBeNull();
    expect(container.textContent).toContain("Dishwashing Liquid");
  });

  it("renders the rejected icon (circle-x) from the allowlist", () => {
    const data: TableData = {
      columns: [
        { key: "action_icon", label: "", type: "icon" },
        { key: "item_name", label: "Item's Name", type: "text" },
      ],
      rows: [{ action_icon: "circle-x", item_name: "MOOZE VODKA 700ml." }],
    };
    const { container } = render(
      <TableCard
        widget={makeWidget(data)}
        moduleName="procurement"
        subTileFor={noop}
      />,
      { wrapper: MemoryRouter },
    );
    expect(container.querySelector("svg.lucide-circle-x")).not.toBeNull();
    expect(container.textContent).toContain("MOOZE VODKA 700ml.");
  });

  it("renders nothing for an icon name outside the allowlist", () => {
    const data: TableData = {
      columns: [{ key: "action_icon", label: "", type: "icon" }],
      rows: [{ action_icon: "not-a-real-icon" }],
    };
    const { container } = render(
      <TableCard
        widget={makeWidget(data)}
        moduleName="procurement"
        subTileFor={noop}
      />,
      { wrapper: MemoryRouter },
    );
    expect(container.querySelector("svg.lucide")).toBeNull();
  });

  it("shows the noData message when there are no columns", () => {
    const { container } = render(
      <TableCard
        widget={makeWidget({ columns: [], rows: [] })}
        moduleName="procurement"
        subTileFor={noop}
      />,
      { wrapper: MemoryRouter },
    );
    expect(container.textContent).toContain("noData");
  });

  it("links a cell to its row's document and keeps the carrier columns hidden", () => {
    const data: TableData = {
      columns: [
        { key: "product_code", label: "Product ID", type: "text" },
        {
          key: "last_active_type",
          label: "Type",
          type: "text",
          link: { doc_type: "last_doc_type", doc_id: "last_doc_id", title: "last_doc_no" },
        },
        { key: "last_doc_type", label: "", type: "id" },
        { key: "last_doc_id", label: "", type: "id" },
        { key: "last_doc_no", label: "", type: "id" },
      ],
      rows: [
        { product_code: "11110051", last_active_type: "EOP-OUT", last_doc_type: "stock_out", last_doc_id: "so-1", last_doc_no: "SO260100004" },
        { product_code: "T-06-A", last_active_type: "", last_doc_type: "", last_doc_id: null, last_doc_no: "" },
      ],
    };
    const { container } = render(
      <TableCard
        widget={{ ...makeWidget(data), dataset_id: "inventory.slow-moving" }}
        moduleName="inventory"
        subTileFor={noop}
      />,
      { wrapper: MemoryRouter },
    );
    const links = container.querySelectorAll("a");
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute("href")).toBe("/inventory-management/inventory-adjustment/so-1?type=stock-out");
    expect(links[0].getAttribute("title")).toBe("SO260100004");
    expect(links[0].textContent).toBe("EOP-OUT");
    expect(container.textContent).not.toContain("stock_out");
    expect(container.textContent).not.toContain("SO260100004");
  });
});
