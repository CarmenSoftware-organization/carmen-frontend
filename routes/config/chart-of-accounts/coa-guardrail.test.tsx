import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { CoaDeleteGuardrailDialog } from "./coa-delete-guardrail-dialog";
import { CoaStatCards } from "./coa-stat-cards";
import {
  ACCOUNT_NATURE,
  CHART_OF_ACCOUNT_TYPE,
  type ChartOfAccount,
} from "@/types/chart-of-accounts";

const mockUnusedAccount: ChartOfAccount = {
  id: "acc-1",
  doc_version: 1,
  code: "109000",
  description_1: "Draft Petty Cash",
  description_2: "เงินสดย่อยทดสอบ",
  nature: ACCOUNT_NATURE.DEBIT,
  type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  category: "asset",
  is_active: true,
  is_used: false,
};

const mockUsedAccount: ChartOfAccount = {
  id: "acc-2",
  doc_version: 1,
  code: "101000",
  description_1: "Operating Cash Account",
  nature: ACCOUNT_NATURE.DEBIT,
  type: CHART_OF_ACCOUNT_TYPE.BALANCE_SHEET,
  category: "asset",
  is_active: true,
  is_used: true,
};

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <IntlProvider locale="en" messages={en}>
      {ui}
    </IntlProvider>,
  );
}

describe("Delete Guardrail Rule (FRD Section 6.2 Rule 7 / VAL-11 & VAL-12)", () => {
  it("บล็อกการลบรหัสบัญชีที่มีประวัติรายการ (is_used === true) และแสดง Warning Modal", () => {
    renderWithIntl(
      <CoaDeleteGuardrailDialog
        account={mockUsedAccount}
        open={true}
        onOpenChange={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );

    // Warning Modal Title
    expect(screen.getByText("Cannot Delete Account Code")).toBeDefined();
    // Prompt to set In-Active instead
    expect(
      screen.getByText(/has existing document postings or transaction records/i),
    ).toBeDefined();
    expect(screen.getByRole("button", { name: "Understood" })).toBeDefined();
  });

  it("อนุญาตให้ลบรหัสบัญชีที่ยังไม่เคยถูกใช้งาน (is_used === false) ผ่าน Confirm Dialog", () => {
    renderWithIntl(
      <CoaDeleteGuardrailDialog
        account={mockUnusedAccount}
        open={true}
        onOpenChange={vi.fn()}
        onConfirmDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Delete Account")).toBeDefined();
    expect(
      screen.getByText(/This account has no recorded transactions/i),
    ).toBeDefined();
  });
});

describe("Dashboard KPI StatCards (FRD Section 5.1 / FE-COA-09)", () => {
  it("นับยอดรวม, Active, Inactive, Req Dept, Req Dim ถูกต้อง", () => {
    const list: ChartOfAccount[] = [
      mockUnusedAccount,
      mockUsedAccount,
      {
        ...mockUnusedAccount,
        id: "acc-3",
        is_active: false,
        is_require_cost_center: true,
      },
      {
        ...mockUnusedAccount,
        id: "acc-4",
        dimension_required: true,
      },
    ];

    renderWithIntl(<CoaStatCards accounts={list} totalRecords={4} />);

    expect(screen.getByText("Total Accounts")).toBeDefined();
    expect(screen.getByText("Active Accounts")).toBeDefined();
    expect(screen.getByText("Inactive Accounts")).toBeDefined();
    expect(screen.getByText("Req. Cost Center")).toBeDefined();
    expect(screen.getByText("Req. Dimension")).toBeDefined();
  });
});
