import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { renderHook } from "@testing-library/react";
import { useModuleTile } from "@/hooks/use-module-tile";
import { DocumentListHeader } from "../document-list-header";

// ModuleTileIcon อ่าน pathname ผ่าน useModuleTile → ต้องมี router context
function renderHeader(ui: React.ReactElement) {
  return render(
    <MemoryRouter initialEntries={["/procurement/purchase-request"]}>
      {ui}
    </MemoryRouter>,
  );
}

describe("DocumentListHeader", () => {
  it("renders the title and description", () => {
    renderHeader(
      <DocumentListHeader title="Purchase Requests" description="All PRs" />,
    );
    expect(
      screen.getByRole("heading", { name: "Purchase Requests" }),
    ).toBeInTheDocument();
    expect(screen.getByText("All PRs")).toBeInTheDocument();
  });

  it("renders the count badge when count > 0", () => {
    renderHeader(
      <DocumentListHeader
        title="Purchase Requests"
        description="All PRs"
        count={1284}
      />,
    );
    expect(screen.getByText("1,284")).toBeInTheDocument();
  });

  it("hides the count badge when count is 0 or omitted", () => {
    const { rerender } = renderHeader(
      <DocumentListHeader title="Purchase Requests" description="All PRs" />,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter initialEntries={["/procurement/purchase-request"]}>
        <DocumentListHeader
          title="Purchase Requests"
          description="All PRs"
          count={0}
        />
      </MemoryRouter>,
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });
});

describe("useModuleTile — accounting modules borrow the accounting tile", () => {
  it.each([
    ["/general-ledger/journal-voucher", "generalLedger"],
    ["/general-ledger", "generalLedger"],
    ["/accounts-payable/invoice", "accountsPayable"],
    ["/accounts-receivable/receipt/rc-1", "accountsReceivable"],
    ["/asset/register", "asset"],
  ])("%s → %s in the accounting palette", (pathname, name) => {
    const { result } = renderHook(() => useModuleTile(), {
      wrapper: ({ children }) => (
        <MemoryRouter initialEntries={[pathname]}>{children}</MemoryRouter>
      ),
    });
    expect(result.current).toEqual({ name, parentName: "accounting" });
  });
});
