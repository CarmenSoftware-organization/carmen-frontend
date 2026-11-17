import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, useParams } from "react-router";
import { IntlProvider } from "use-intl";
import { beforeEach, expect, it, vi } from "vitest";
import en from "@/messages/en.json";
import { Component } from "./ar-profile-detail.route";
import { readProfileExtension } from "./ar-profile-model";

const api = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));
vi.mock("./use-ar-customer", () => ({
  useArCustomer: () => ({
    data: undefined,
    isLoading: false,
    error: null,
    dataUpdatedAt: 0,
  }),
  useCreateArCustomer: () => ({ mutateAsync: api.create, isPending: false }),
  useUpdateArCustomer: () => ({ mutateAsync: api.update, isPending: false }),
  useDeleteArCustomer: () => ({ mutate: api.remove, isPending: false }),
}));
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "DEV" }));
vi.mock("@/hooks/use-can", () => ({
  useCan: () => ({ canWrite: true, can: () => true, isAdmin: true }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({
    buCode: "DEV",
    dateFormat: "dd/MM/yyyy",
    dateTimeFormat: "dd/MM/yyyy HH:mm",
  }),
}));
vi.mock("@/hooks/use-credit-term", () => ({
  useCreditTerm: () => ({
    data: { data: [{ id: "net-30", value: 30, is_active: true }] },
    isLoading: false,
  }),
}));
vi.mock("@/hooks/use-tax-profile", () => ({
  useTaxProfileById: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccountById: () => ({ data: undefined }),
}));
vi.mock("@/components/lookup/lookup-tax-profile", () => ({
  LookupTaxProfile: ({
    value,
    onValueChange,
    disabled,
  }: {
    value: string;
    onValueChange: (value: string) => void;
    disabled: boolean;
  }) => (
    <select
      aria-label="Tax profile lookup"
      value={value}
      disabled={disabled}
      onChange={(event) => onValueChange(event.target.value)}
    >
      <option value="">Select</option>
      <option value="vat-7">VAT 7%</option>
    </select>
  ),
}));
vi.mock("@/components/lookup/lookup-credit-term", () => ({
  LookupCreditTerm: () => <span>Net 30</span>,
}));
vi.mock("@/components/lookup/lookup-chart-of-account-by-id", () => ({
  LookupChartOfAccountById: () => <span>AR Account</span>,
}));
vi.mock("./ar-customer-lookup", () => ({ ArCustomerLookup: () => null }));
vi.mock("./ar-contract.route", () => ({ ContractList: () => null }));
vi.mock("./ar-profile-attachments", () => ({ ProfileAttachments: () => null }));
vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  api.create.mockResolvedValue({ data: { id: "created-profile" } });
});

function ProfileRoute() {
  const { id } = useParams();
  return id === "new" ? <Component /> : <div>Saved profile destination</div>;
}

it("keeps the actual form after API create succeeds but mock storage fails, then retries local save without creating a second customer", async () => {
  const router = createMemoryRouter(
    [
      {
        path: "/accounting/accounts-receivable/profile/:id",
        element: <ProfileRoute />,
      },
    ],
    { initialEntries: ["/accounting/accounts-receivable/profile/new"] },
  );
  render(
    <IntlProvider locale="en" messages={en} timeZone="Asia/Bangkok">
      <RouterProvider router={router} />
    </IntlProvider>,
  );
  const labels = en.accounting.arProfile;
  const fill = (label: string, value: string) =>
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`, "i")), {
      target: { value },
    });
  fill(labels.code, "TEST-LOCAL-FAIL");
  fill(labels.companyName, "Test Company");
  fill(labels.registeredName, "Test Company Ltd.");
  fill(labels.telephone, "0812345678");
  fill(labels.taxId, "1234567890123");
  fill(labels.addressLine1, "1 Test Road");
  fill(labels.subDistrict, "Watthana");
  fill(labels.district, "Watthana");
  fill(labels.province, "Bangkok");
  fill(labels.postalCode, "10110");
  fill(labels.billingEmail, "billing@example.com");
  fireEvent.change(screen.getByLabelText("Tax profile lookup"), {
    target: { value: "vat-7" },
  });
  screen
    .getAllByLabelText(labels.sameAsTax)
    .forEach((checkbox) => fireEvent.click(checkbox));

  const write = vi
    .spyOn(sessionStorage, "setItem")
    .mockImplementationOnce(() => {
      throw new DOMException("Full", "QuotaExceededError");
    });
  fireEvent.submit(document.getElementById("ar-profile-form")!);
  await waitFor(() => expect(api.create).toHaveBeenCalledTimes(1));
  await waitFor(() =>
    expect(screen.getByText(labels.partialSave)).toBeVisible(),
  );
  expect(router.state.location.pathname).toBe(
    "/accounting/accounts-receivable/profile/new",
  );
  expect(
    screen.getByLabelText(new RegExp(`^${labels.companyName}`, "i")),
  ).toHaveValue("Test Company");
  expect(
    screen.getByLabelText(new RegExp(`^${labels.companyName}`, "i")),
  ).toBeDisabled();
  expect(
    screen.getByLabelText(new RegExp(`^${labels.telephone}`, "i")),
  ).toHaveValue("0812345678");
  expect(readProfileExtension("DEV", "created-profile")).toEqual({});
  write.mockRestore();

  fireEvent.submit(document.getElementById("ar-profile-form")!);
  await screen.findByText("Saved profile destination");
  expect(api.create).toHaveBeenCalledTimes(1);
  expect(api.update).not.toHaveBeenCalled();
  expect(router.state.location.pathname).toBe(
    "/accounting/accounts-receivable/profile/created-profile",
  );
  expect(readProfileExtension("DEV", "created-profile")).toEqual(
    expect.objectContaining({
      telephone: "0812345678",
      billingEmail: "billing@example.com",
    }),
  );
});
