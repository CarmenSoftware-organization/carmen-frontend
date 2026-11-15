import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { TaxProfileDialog } from "./tax-profile-dialog";

const update = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/use-tax-profile", () => ({
  useCreateTaxProfile: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateTaxProfile: () => ({ mutate: update, isPending: false }),
}));

describe("TaxProfileDialog", () => {
  it("edits the documented fields without rewriting existing WHT metadata", async () => {
    const account = "019638a6-2a00-7c4f-8e46-9b7a52c80c4d";
    render(
      <IntlProvider locale="en" messages={en}>
        <TaxProfileDialog
          open
          onOpenChange={() => {}}
          taxProfile={{
            id: "wht",
            doc_version: 7,
            name: "Service WHT",
            tax_rate: 3,
            is_active: true,
            tax_type: "wht",
            chart_of_accounts_id: account,
            wht_pnd_form: "pnd_53",
            wht_income_type: "Service fee",
          }}
        />
      </IntlProvider>,
    );
    expect(screen.getByRole("textbox", { name: /^Name/ })).toHaveValue(
      "Service WHT",
    );
    expect(screen.getByRole("spinbutton", { name: /^Tax Rate/ })).toHaveValue(
      3,
    );
    expect(
      screen.queryByRole("combobox", { name: "Tax Type" }),
    ).not.toBeInTheDocument();
    expect(screen.queryAllByRole("combobox")).toHaveLength(0);
    expect(
      screen.queryByRole("combobox", { name: "PND Form" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Income Type")).not.toBeInTheDocument();
    expect(screen.queryByText("Posting Account")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith(
        {
          id: "wht",
          doc_version: 7,
          name: "Service WHT",
          tax_rate: 3,
          is_active: true,
        },
        expect.any(Object),
      ),
    );
  });
});
