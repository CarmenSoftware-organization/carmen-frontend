import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { IntlProvider } from "use-intl";

const get = vi.fn();
vi.mock("@/lib/http-client", () => ({
  httpClient: { get: (...args: unknown[]) => get(...args) },
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: "CARMEN-FIFO", dateFormat: "dd/MM/yyyy" }),
}));

import en from "@/messages/en.json";
import { PrPricelistDialog } from "./pr-pricelist-dialog";

const bu = en.procurement.purchaseRequest.betterUnit;

// ขอ 10 KG ที่ 100/KG · กล่อง 3 KG ราคา 270 = 90/KG แต่ต้องซื้อ 4 กล่อง = 12 KG
const kgLine = {
  vendor_id: "v-kg",
  vendor_name: "Vendor KG",
  pricelist_detail_id: "kg",
  pricelist_no: "PL-kg",
  price: 100,
  currency: "THB",
  unit_name: "KG",
  base_price: 100,
  base_currency: "THB",
  exchange_rate: 1,
  effective_date: { from: "2026-11-01", to: "2026-11-30" },
};
const boxOffer = {
  ...kgLine,
  vendor_id: "v-box",
  vendor_name: "Vendor Box",
  pricelist_detail_id: "box",
  pricelist_no: "PL-box",
  unit_name: "Box",
  price: 270,
  order_qty: 4,
  base_qty: 12,
  extra_base_qty: 2,
  base_unit_name: "KG",
  price_per_base_unit: 90,
  total_price: 1080,
  saving_per_base_unit: 10,
};

function respond(betterUnit: unknown[]) {
  get.mockResolvedValue({
    ok: true,
    json: () =>
      Promise.resolve({
        data: {
          selected: kgLine,
          lists: [],
          suggests: {
            next_lowest_moq: [],
            most_value_moq: [],
            better_unit: betterUnit,
          },
          last_price: null,
        },
      }),
  });
}

function renderDialog() {
  return render(
    <IntlProvider locale="en" messages={en} timeZone="Asia/Bangkok">
      <PrPricelistDialog
        open
        onOpenChange={vi.fn()}
        productId="prod1"
        productName="Pork neck"
        unitId="u-kg"
        currencyId="cur1"
        atDate="2026-11-09"
        requestedQty={10}
        requestedUnitName="KG"
        approvedQty={0}
        approvedUnitName="KG"
        onSelect={vi.fn()}
      />
    </IntlProvider>,
  );
}

describe("PrPricelistDialog — cheaper in another unit", () => {
  beforeEach(() => get.mockReset());

  it("shows the other-unit offer: quantity rounded up, price per base unit, saving and extra", async () => {
    respond([boxOffer]);
    renderDialog();

    const note = await screen.findByRole("note", { name: bu.title });
    expect(note).toHaveTextContent("4 Box from Vendor Box (PL-box)");
    expect(note).toHaveTextContent("270.00 THB per Box");
    expect(note).toHaveTextContent("total 1,080.00 THB");
    expect(note).toHaveTextContent("= 90.00 THB per KG");
    expect(note).toHaveTextContent("10.00 THB less per KG");
    expect(note).toHaveTextContent("2 KG more than ordered");
  });

  it("asks with the line's unit and quantity — the backend needs both to convert", async () => {
    respond([]);
    renderDialog();

    await waitFor(() => expect(get).toHaveBeenCalled());
    const url = String(get.mock.calls[0][0]);
    expect(url).toContain("unit_id=u-kg");
    expect(url).toContain("qty=10");
  });

  it("shows nothing extra when no other unit is cheaper", async () => {
    respond([]);
    renderDialog();

    await screen.findByText("Vendor KG");
    expect(
      screen.queryByRole("note", { name: bu.title }),
    ).not.toBeInTheDocument();
  });
});
