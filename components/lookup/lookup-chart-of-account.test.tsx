import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LookupChartOfAccount } from "./lookup-chart-of-account";

vi.mock("use-intl", () => ({
  useTranslations: () => (key: string, params?: Record<string, string>) => {
    if (params?.entity) return `Select ${params.entity}`;
    return key;
  },
}));

vi.mock("@/hooks/use-chart-of-account", () => ({
  useChartOfAccount: () => ({
    data: { data: [] },
    isLoading: false,
  }),
}));

describe("LookupChartOfAccount", () => {
  it("renders with placeholder and matches default accounts", () => {
    const onValueChange = vi.fn();
    render(
      <LookupChartOfAccount
        value="1112-01"
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByText("1112-01 - Cash at Bank - KBANK THB")).toBeInTheDocument();
  });

  it("renders empty selection placeholder when no value provided", () => {
    render(
      <LookupChartOfAccount
        value=""
        onValueChange={() => {}}
      />,
    );

    // mock คืนชื่อคีย์ — entity ต้องมาจาก field.glAccount ไม่ใช่คำอังกฤษ hardcode
    expect(screen.getByText("Select glAccount")).toBeInTheDocument();
  });
});
