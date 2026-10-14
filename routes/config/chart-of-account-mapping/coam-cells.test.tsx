import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { AccountMappingRow } from "@/types/chart-of-account-mapping";
import {
  AccountCell,
  CostCenterCell,
  IssueText,
  type MappingIssue,
} from "./coam-cells";

const row = (over: Partial<AccountMappingRow> = {}): AccountMappingRow =>
  ({
    id: "r1",
    doc_version: 1,
    movement: "grn",
    location: { id: "loc-9", code: "L9", name: "Loc 9" },
    item_group: { id: "ig-1", code: "A&B 1", name: "Group" },
    account: { code: null, name: null, source: null, issue: null },
    cost_center: {
      id: null,
      code: null,
      name: null,
      source: null,
      issue: null,
    },
    ...over,
  }) as unknown as AccountMappingRow;

const wrap = (ui: React.ReactElement) =>
  render(
    <IntlProvider locale="en" messages={en}>
      <TooltipProvider>
        <MemoryRouter>{ui}</MemoryRouter>
      </TooltipProvider>
    </IntlProvider>,
  );

const cases: [MappingIssue, string, string][] = [
  ["missing_cost_center", "/config/location/loc-9", "No cost center"],
  [
    "missing_inventory_account",
    `/product-management/category?search=${encodeURIComponent("A&B 1")}`,
    "No account",
  ],
  [
    "missing_direct_account",
    `/product-management/category?search=${encodeURIComponent("A&B 1")}`,
    "No account",
  ],
  [
    "account_not_in_coa",
    "/config/chart-of-accounts",
    "Not in chart of accounts",
  ],
];

describe("IssueText", () => {
  it.each(cases)("%s -> %s", (issue, href, label) => {
    wrap(<IssueText issue={issue} row={row()} />);
    const link = screen.getByRole("link", { name: label });
    expect(link).toHaveAttribute("href", href);
  });

  it("เข้ารหัสรหัส item group ที่มีอักขระพิเศษ", () => {
    wrap(<IssueText issue="missing_direct_account" row={row()} />);
    expect(screen.getByRole("link").getAttribute("href")).toBe(
      "/product-management/category?search=A%26B%201",
    );
  });
});

describe("AccountCell / CostCenterCell", () => {
  it("AccountCell แสดง IssueText เมื่อไม่มี code", () => {
    wrap(
      <AccountCell
        row={row({
          account: {
            code: null,
            name: null,
            source: null,
            issue: "missing_inventory_account",
          },
        })}
      />,
    );
    expect(
      screen.getByRole("link", { name: "No account" }),
    ).toBeInTheDocument();
  });

  it("AccountCell ไม่มีทั้ง code และ issue -> ว่าง", () => {
    const { container } = wrap(<AccountCell row={row()} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("AccountCell มี code + issue not_in_coa -> แสดง code และลิงก์ COA", () => {
    wrap(
      <AccountCell
        row={row({
          account: {
            code: "999",
            name: null,
            source: "category",
            issue: "account_not_in_coa",
          },
        })}
      />,
    );
    expect(screen.getByText("999")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Not in chart of accounts" }),
    ).toHaveAttribute("href", "/config/chart-of-accounts");
  });

  it("CostCenterCell แสดง IssueText เมื่อไม่มี id", () => {
    wrap(
      <CostCenterCell
        row={row({
          cost_center: {
            id: null,
            code: null,
            name: null,
            source: null,
            issue: "missing_cost_center",
          },
        })}
      />,
    );
    expect(
      screen.getByRole("link", { name: "No cost center" }),
    ).toHaveAttribute("href", "/config/location/loc-9");
  });

  it("CostCenterCell ที่ค่ามาจาก location -> ป้ายที่มาเป็นลิงก์ไปหน้า location", () => {
    wrap(
      <CostCenterCell
        row={row({
          cost_center: {
            id: "cc1",
            code: "CC1",
            name: "Kitchen",
            source: "location",
            issue: null,
          },
        })}
      />,
    );
    expect(screen.getByText("CC1")).toBeInTheDocument();
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      "/config/location/loc-9",
    );
  });
});
