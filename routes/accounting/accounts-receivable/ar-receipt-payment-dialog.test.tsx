import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { IntlProvider } from "use-intl";
import { expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import { ReceiptPaymentDialog } from "./ar-receipt-dialogs";
import { newReceiptPayment } from "./ar-receipt-model";

const master = vi.hoisted(() => ({
  account: {
    id: "17171717-1717-4717-8717-171717171717",
    code: "1112-01",
    description_1: "Bank THB",
  },
  costCenterId: "28282828-2828-4828-8828-282828282828",
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    dateFormat: "dd/MM/yyyy",
    dateTimeFormat: "dd/MM/yyyy HH:mm",
  }),
}));
vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccountById: (id: string) => ({
    data: id === master.account.id ? master.account : undefined,
    isLoading: false,
  }),
}));
vi.mock("@/components/lookup/lookup-chart-of-account", () => ({
  LookupChartOfAccount: ({
    value,
    onValueChange,
  }: {
    value: string;
    onValueChange: (code: string, account: typeof master.account) => void;
  }) => (
    <>
      <span data-testid="selected-account-code">{value}</span>
      <button
        type="button"
        onClick={() => onValueChange(master.account.code, master.account)}
      >
        Select GL bank account
      </button>
    </>
  ),
}));
vi.mock("@/components/lookup/lookup-cost-center", () => ({
  LookupCostCenter: ({
    value,
    onValueChange,
  }: {
    value: string | null;
    onValueChange: (id: string) => void;
  }) => (
    <>
      <span data-testid="selected-cost-center">{value}</span>
      <button type="button" onClick={() => onValueChange(master.costCenterId)}>
        Select GL cost center
      </button>
    </>
  ),
}));
vi.mock("@/components/lookup/lookup-department", () => ({
  LookupDepartment: () => <span>Wrong department master</span>,
}));

it("saves the picked account UUID and GL cost-center UUID, and normalizes actual calendar selections to date-only values", async () => {
  const save = vi.fn();
  const payment = {
    ...newReceiptPayment("2026-11-17", "cheque"),
    amount: 100,
    chequeNo: "CHQ-001",
  };
  render(
    <IntlProvider locale="en" messages={messages} timeZone="Asia/Bangkok">
      <ReceiptPaymentDialog
        payment={payment}
        currency="THB"
        close={vi.fn()}
        save={save}
      />
    </IntlProvider>,
  );
  expect(screen.queryByText("Wrong department master")).not.toBeInTheDocument();
  await userEvent.click(
    screen.getByRole("button", { name: "Select GL bank account" }),
  );
  expect(screen.getByTestId("selected-account-code")).toHaveTextContent(
    master.account.code,
  );
  await userEvent.click(
    screen.getByRole("button", { name: "Select GL cost center" }),
  );
  expect(screen.getByTestId("selected-cost-center")).toHaveTextContent(
    master.costCenterId,
  );
  async function pickDate(label: string, day: string) {
    const field = screen
      .getByText(label, { exact: true })
      .closest('[data-slot="field"]')!;
    await userEvent.click(within(field as HTMLElement).getByRole("button"));
    const calendar = screen.getByRole("grid");
    const target = within(calendar)
      .getAllByRole("button")
      .find((button) => button.textContent === day)!;
    await userEvent.click(target);
  }
  await pickDate("Payment Date", "18");
  await pickDate("Cheque Date", "19");
  fireEvent.submit(
    screen.getByRole("button", { name: "Save" }).closest("form")!,
  );
  expect(save).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({
      accountId: master.account.id,
      accountLabel: `${master.account.code} · ${master.account.description_1}`,
      costCenterId: master.costCenterId,
      date: "2026-11-18",
      chequeDate: "2026-11-19",
    }),
  );
  expect(save.mock.calls[0][0].accountId).not.toBe(master.account.code);
});
