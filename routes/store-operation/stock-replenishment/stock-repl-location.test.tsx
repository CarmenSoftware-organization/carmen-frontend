import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { Location } from "@/types/stock-replenishment";
import { StockReplLocation } from "./stock-repl-location";

const product = (id: string, name: string) => ({
  id,
  name,
  category: { id: "c1", name: "Cat" },
  sub_category: { id: "s1", name: "Sub" },
  item_group: { id: "g1", name: "Group" },
  on_hand_qty: 0,
  min_qty: 20,
  max_qty: 100,
  par_qty: 30,
  reorder_qty: 100,
  status: "critical" as const,
  product_location_id: `pl-${id}`,
  code: `code-${id}`,
  local_name: null,
});

const location: Location = {
  location_id: "loc-1",
  location_code: "1AG01",
  location_name: "A&G-Accounting",
  products_location: [
    product("p1", "Item One"),
    product("p2", "Item Two"),
    product("p3", "Item Three"),
  ],
};

function renderLocation(selectedIds: Set<string>, onChange = vi.fn()) {
  render(
    <IntlProvider locale="en" messages={en}>
      <TooltipProvider>
        <StockReplLocation
          location={location}
          selectedIds={selectedIds}
          open
          onOpenChange={() => {}}
          onSelectionChange={onChange}
        />
      </TooltipProvider>
    </IntlProvider>,
  );
  return onChange;
}

describe("StockReplLocation — selection", () => {
  it("ติ๊ก product ตัวเดียวได้ ไม่พ่วงทั้ง location", () => {
    const onChange = renderLocation(new Set());

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Item Two" }));

    expect(onChange).toHaveBeenCalledWith("loc-1", new Set(["p2"]));
  });

  it("เอาออกทีละตัวจากที่เลือกครบได้", () => {
    const onChange = renderLocation(new Set(["p1", "p2", "p3"]));

    fireEvent.click(screen.getByRole("checkbox", { name: "Select Item Two" }));

    expect(onChange).toHaveBeenCalledWith("loc-1", new Set(["p1", "p3"]));
  });

  it("ติ๊กที่แถว location = เลือกครบทุก product", () => {
    const onChange = renderLocation(new Set());

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: en.storeOperation.stockReplenishment.selectAllIn.replace(
          "{location}",
          "A&G-Accounting",
        ),
      }),
    );

    expect(onChange).toHaveBeenCalledWith("loc-1", new Set(["p1", "p2", "p3"]));
  });
});
