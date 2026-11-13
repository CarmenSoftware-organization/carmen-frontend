import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import type { LucideIcon } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { SideMain } from "./side-main";

// t(key) → key (namespace ไม่สำคัญสำหรับเทสต์นี้)
vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

// jsdom ไม่มี window.matchMedia — SidebarProvider ใช้ useIsMobile() (hooks/use-mobile.ts)
// ซึ่งเรียก matchMedia ตอน mount เสมอ ไม่ว่าจะทดสอบอะไรก็ตาม
beforeEach(() => {
  window.matchMedia =
    window.matchMedia ??
    ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }));
});

// vi.hoisted เพราะ vi.mock ถูก hoist ไปบนสุดของไฟล์ — ตัวแปรที่ mock factory
// อ้างถึงต้องมาจากที่นี่ ไม่ใช่ const ธรรมดาข้างล่าง (จะเจอ TDZ error)
const { DummyIcon } = vi.hoisted(() => ({
  DummyIcon: (() => null) as unknown as LucideIcon,
}));

// SideMain หา activeModule จาก pathname ผ่าน `findActiveModule` — ให้สองโมดูลพอ
vi.mock("@/constant/module-list", () => {
  const moduleList = [
    {
      name: "procurementModule",
      path: "/procurement",
      icon: DummyIcon,
      subModules: [],
    },
    { name: "accounting", path: "/accounting", icon: DummyIcon },
  ];
  return {
    moduleList,
    findActiveModule: (pathname: string) =>
      moduleList.find((mod) => pathname.startsWith(mod.path)),
    findAccountingSection: () => ({
      name: "generalLedger",
      path: "/accounting",
      icon: DummyIcon,
    }),
  };
});

// Mock ทั้ง hook ที่ระดับนี้ — ตรรกะการคำนวณ denied/locked เทสต์แยกไว้แล้วที่
// hooks/use-visible-modules.test.ts ตรง ๆ กับ annotate/markAll; ที่นี่ทดสอบแค่ว่า
// SideMain render กุญแจ + เรียก dispatchPermissionDenied ด้วย reason ที่ถูกต้องหรือไม่
const visibleSubs = vi.fn();
vi.mock("@/hooks/use-visible-modules", () => ({
  useVisibleModules: () => visibleSubs(),
}));

const dispatchPermissionDenied = vi.fn();
vi.mock("@/components/permission-denied-dialog", () => ({
  dispatchPermissionDenied: (...args: unknown[]) =>
    dispatchPermissionDenied(...args),
}));

function sub(overrides: Record<string, unknown> = {}) {
  return {
    name: "subA",
    path: "/procurement/sub-a",
    icon: DummyIcon,
    denied: false,
    locked: false,
    permission: "procurement.purchase_request.view",
    ...overrides,
  };
}

function renderSideMain(pathname = "/procurement") {
  return render(
    <MemoryRouter initialEntries={[pathname]}>
      <SidebarProvider>
        <SideMain />
      </SidebarProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SideMain — plain access (neither locked nor denied)", () => {
  it("renders a navigable Link, not a button", () => {
    visibleSubs.mockReturnValue([sub()]);
    renderSideMain();
    const link = screen.getByRole("link", { name: /subA/i });
    expect(link).toHaveAttribute("href", "/procurement/sub-a");
    expect(screen.queryByRole("button", { name: /subA/i })).toBeNull();
  });
});

describe("SideMain — locked (BU has not licensed the feature)", () => {
  it("renders a button (not a Link) with the Lock icon", () => {
    visibleSubs.mockReturnValue([sub({ locked: true })]);
    renderSideMain();
    expect(screen.queryByRole("link", { name: /subA/i })).toBeNull();
    const button = screen.getByRole("button", { name: /subA/i });
    expect(button.querySelector("svg.lucide-lock")).not.toBeNull();
  });

  it('clicking it dispatches permission-denied with reason "license"', async () => {
    visibleSubs.mockReturnValue([sub({ locked: true })]);
    renderSideMain();
    await userEvent.click(screen.getByRole("button", { name: /subA/i }));
    expect(dispatchPermissionDenied).toHaveBeenCalledTimes(1);
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.purchase_request.view",
      undefined,
      "license",
    );
  });
});

describe("SideMain — denied only (RBAC), not locked", () => {
  it("renders a button without the Lock icon", () => {
    visibleSubs.mockReturnValue([sub({ denied: true })]);
    renderSideMain();
    const button = screen.getByRole("button", { name: /subA/i });
    expect(button.querySelector("svg.lucide-lock")).toBeNull();
  });

  it('clicking it dispatches permission-denied with reason "permission"', async () => {
    visibleSubs.mockReturnValue([sub({ denied: true })]);
    renderSideMain();
    await userEvent.click(screen.getByRole("button", { name: /subA/i }));
    expect(dispatchPermissionDenied).toHaveBeenCalledTimes(1);
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.purchase_request.view",
      undefined,
      "permission",
    );
  });
});

describe("SideMain — locked wins over denied when both are true", () => {
  it("still shows the Lock icon", () => {
    visibleSubs.mockReturnValue([sub({ denied: true, locked: true })]);
    renderSideMain();
    const button = screen.getByRole("button", { name: /subA/i });
    expect(button.querySelector("svg.lucide-lock")).not.toBeNull();
  });

  it('still dispatches reason "license", not "permission"', async () => {
    visibleSubs.mockReturnValue([sub({ denied: true, locked: true })]);
    renderSideMain();
    await userEvent.click(screen.getByRole("button", { name: /subA/i }));
    expect(dispatchPermissionDenied).toHaveBeenCalledWith(
      "procurement.purchase_request.view",
      undefined,
      "license",
    );
  });
});

describe("SideMain — เมนูย่อยอีกชั้น", () => {
  const parent = () =>
    sub({
      name: "workflow",
      path: "/procurement/sub-a",
      subModules: [
        { name: "childA", path: "/procurement/sub-a/child-a", icon: DummyIcon },
        { name: "childB", path: "/procurement/sub-a/child-b", icon: DummyIcon },
      ],
    });

  const activeNames = () =>
    Array.from(document.querySelectorAll('[data-active="true"]')).map((el) =>
      el.textContent?.trim(),
    );

  it("ลูกทุกตัวถูก render เป็นลิงก์ของตัวเอง", () => {
    visibleSubs.mockReturnValue([parent()]);
    renderSideMain("/procurement/sub-a");
    expect(screen.getByRole("link", { name: /childA/i })).toHaveAttribute(
      "href",
      "/procurement/sub-a/child-a",
    );
    expect(screen.getByRole("link", { name: /childB/i })).toHaveAttribute(
      "href",
      "/procurement/sub-a/child-b",
    );
  });

  it("อยู่หน้าของลูก = ลูกตัวนั้นสว่างตัวเดียว ตัวแม่ไม่สว่าง", () => {
    visibleSubs.mockReturnValue([parent()]);
    renderSideMain("/procurement/sub-a/child-a");
    expect(activeNames()).toEqual(["childA"]);
  });

  it("อยู่หน้าของแม่ = แม่สว่าง ลูกไม่สว่างสักตัว", () => {
    visibleSubs.mockReturnValue([parent()]);
    renderSideMain("/procurement/sub-a");
    expect(activeNames()).toEqual(["workflow"]);
  });

  it("หน้าลูกที่ลึกลงไปอีก (เช่น /child-a/123) ยังนับเป็นลูกตัวนั้น", () => {
    visibleSubs.mockReturnValue([parent()]);
    renderSideMain("/procurement/sub-a/child-a/123");
    expect(activeNames()).toEqual(["childA"]);
  });
});

describe("SideMain — Accounting", () => {
  const accountingSubs = [
    sub({ name: "glDashboard", path: "/accounting" }),
    sub({ name: "journalVoucher", path: "/accounting/journal-voucher" }),
    sub({ name: "templateVoucher", path: "/accounting/template-voucher" }),
  ];

  it.each([
    ["/accounting", "glDashboard"],
    ["/accounting/journal-voucher", "journalVoucher"],
    ["/accounting/template-voucher/123", "templateVoucher"],
  ])("highlights only %s's menu item", (pathname, expected) => {
    visibleSubs.mockReturnValue(accountingSubs);
    renderSideMain(pathname);
    expect(
      Array.from(document.querySelectorAll('[data-active="true"]')).map((el) =>
        el.textContent?.trim(),
      ),
    ).toEqual([expected]);
  });
});
