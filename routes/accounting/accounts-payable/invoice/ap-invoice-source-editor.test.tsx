import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { MemoryRouter } from "react-router";
import en from "@/messages/en.json";
import { emptyLine } from "./ap-invoice-form";
import { InvoiceSourceEditor } from "./ap-invoice-source-editor";

const state = vi.hoisted(() => ({
  page: {
    // The real list omits post_type; eligibility is filtered by SQL, then checked against detail.
    data: [
      {
        id: "grn",
        grn_no: "GRN-1",
        doc_status: "committed",
        currency_id: "thb",
      },
    ],
    paginate: { page: 1, pages: 1, total: 1 },
  },
  detail: {
    id: "grn",
    grn_no: "GRN-1",
    doc_status: "committed",
    post_type: "ap",
    vendor: { id: "vendor" },
    currency: { id: "thb" },
    good_received_note_detail: [
      {
        sequence_no: 1,
        product: { id: "product", name: "Service" },
        items: [
          { id: "item", received_qty: 2, received_unit: { name: "BOX" } },
        ],
      },
    ],
  },
}));
vi.mock("@/hooks/use-goods-receive-note", () => ({
  useGoodsReceiveNote: (_params: unknown, options?: { enabled?: boolean }) => ({
    data: options?.enabled === false ? undefined : state.page,
    isLoading: false,
  }),
  useGoodsReceiveNoteById: (id?: string) => ({
    data: id ? state.detail : undefined,
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-profile", () => ({ useProfile: () => ({}) }));
vi.mock("@/components/lookup/lookup-combobox", () => ({
  LookupCombobox: ({
    items,
    onValueChange,
  }: {
    items: { id: string; grn_no: string }[];
    onValueChange: (id: string) => void;
  }) => (
    <div>
      {items.map((item) => (
        <button key={item.id} onClick={() => onValueChange(item.id)}>
          {item.grn_no}
        </button>
      ))}
    </div>
  ),
}));

const show = () => {
  const onChange = vi.fn();
  render(
    <IntlProvider locale="en" messages={en}>
      <MemoryRouter>
        <InvoiceSourceEditor
          line={emptyLine()}
          editable
          vendorId="vendor"
          currencyId="thb"
          onChange={onChange}
        />
      </MemoryRouter>
    </IntlProvider>,
  );
  return onChange;
};

describe("Invoice GRN selection", () => {
  beforeEach(() => {
    state.detail.doc_status = "committed";
    state.detail.post_type = "ap";
    state.detail.vendor.id = "vendor";
    state.detail.currency.id = "thb";
  });

  it("selects an eligible GRN even when the list response omits post_type", async () => {
    const onChange = show();
    await userEvent.click(await screen.findByRole("button", { name: "GRN-1" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Match line" }),
    );
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({
        carry: {
          sources: [
            { good_received_note_detail_item_id: "item", matched_qty: "1" },
          ],
        },
      }),
    );
  });

  it.each(["status", "postType", "vendor", "currency"])(
    "refuses an ineligible selected detail (%s)",
    async (field) => {
      if (field === "status") state.detail.doc_status = "draft";
      if (field === "postType") state.detail.post_type = "cash";
      if (field === "vendor") state.detail.vendor.id = "other-vendor";
      if (field === "currency") state.detail.currency.id = "usd";
      show();
      await userEvent.click(
        await screen.findByRole("button", { name: "GRN-1" }),
      );
      expect(screen.getByRole("alert")).toHaveTextContent("No eligible GRNs");
      expect(
        screen.queryByRole("button", { name: "Match line" }),
      ).not.toBeInTheDocument();
    },
  );
});
