import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import ModuleApp from "./module-app";

// t(key) → key
vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// ตรรกะ denied/locked เทสต์แยกไว้แล้วที่ hooks/use-visible-modules.test.ts —
// ที่นี่ mock ทั้ง hook เพื่อทดสอบแค่ว่า ModuleApp render กุญแจ + เรียก
// dispatchPermissionDenied ด้วย reason ที่ถูกต้อง (ตามแบบ side-main.test.tsx)
const visibleModules = vi.fn();
vi.mock("@/hooks/use-visible-modules", () => ({
  useVisibleModules: () => visibleModules(),
}));

const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...args: unknown[]) =>
    dispatchPermissionDenied(...args),
}));

function mod(overrides: Record<string, unknown> = {}) {
  return {
    name: "procurementModule",
    path: "/procurement",
    denied: false,
    locked: false,
    permission: "procurement.purchase_request.view",
    ...overrides,
  };
}

async function renderAndOpen() {
  render(
    <MemoryRouter>
      <ModuleApp />
    </MemoryRouter>,
  );
  await userEvent.click(screen.getByRole("button", { name: "modules" }));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ModuleApp launcher — plain access (neither locked nor denied)", () => {
  it("renders a navigable Link tile", async () => {
    visibleModules.mockReturnValue([mod()]);
    await renderAndOpen();
    const link = screen.getByRole("link", { name: /procurementModule/i });
    expect(link).toHaveAttribute("href", "/procurement");
  });

  it("renders the four accounting modules as their own tiles", async () => {
    visibleModules.mockReturnValue([
      mod({
        name: "generalLedger",
        path: "/general-ledger",
        tileParent: "accounting",
      }),
      mod({
        name: "accountsPayable",
        path: "/accounts-payable",
        tileParent: "accounting",
      }),
      mod({
        name: "accountsReceivable",
        path: "/accounts-receivable",
        tileParent: "accounting",
      }),
      mod({ name: "asset", path: "/asset", tileParent: "accounting" }),
    ]);

    await renderAndOpen();

    expect(screen.queryByRole("link", { name: /^accounting$/i })).toBeNull();
    expect(
      screen.getByRole("link", { name: /generalLedger/i }),
    ).toHaveAttribute("href", "/general-ledger");
    expect(
      screen.getByRole("link", { name: /accountsPayable/i }),
    ).toHaveAttribute("href", "/accounts-payable");
    expect(
      screen.getByRole("link", { name: /accountsReceivable/i }),
    ).toHaveAttribute("href", "/accounts-receivable");
    expect(screen.getByRole("link", { name: /^asset$/i })).toHaveAttribute(
      "href",
      "/asset",
    );
  });
});

describe("ModuleApp launcher — locked (BU has not licensed the feature)", () => {
  it("renders a button (not a Link) with the Lock icon, dimmed", async () => {
    visibleModules.mockReturnValue([mod({ locked: true })]);
    await renderAndOpen();
    expect(
      screen.queryByRole("link", { name: /procurementModule/i }),
    ).toBeNull();
    const button = screen.getByRole("button", { name: /procurementModule/i });
    expect(button.querySelector("svg.lucide-lock")).not.toBeNull();
    expect(button.className).toMatch(/opacity-50/);
  });

  it('clicking it dispatches permission-denied with reason "license"', async () => {
    visibleModules.mockReturnValue([mod({ locked: true })]);
    await renderAndOpen();
    await userEvent.click(
      screen.getByRole("button", { name: /procurementModule/i }),
    );
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.purchase_request.view",
      undefined,
      "license",
    );
  });
});

describe("ModuleApp launcher — denied only (RBAC), not locked", () => {
  it("renders a button without the Lock icon and dispatches reason permission", async () => {
    visibleModules.mockReturnValue([mod({ denied: true })]);
    await renderAndOpen();
    const button = screen.getByRole("button", { name: /procurementModule/i });
    expect(button.querySelector("svg.lucide-lock")).toBeNull();
    await userEvent.click(button);
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.purchase_request.view",
      undefined,
      "permission",
    );
  });
});

describe("ModuleApp launcher — locked wins over denied when both are true", () => {
  it("still shows the Lock icon and dispatches reason license", async () => {
    visibleModules.mockReturnValue([mod({ denied: true, locked: true })]);
    await renderAndOpen();
    const button = screen.getByRole("button", { name: /procurementModule/i });
    expect(button.querySelector("svg.lucide-lock")).not.toBeNull();
    await userEvent.click(button);
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.purchase_request.view",
      undefined,
      "license",
    );
  });
});
