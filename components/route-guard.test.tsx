import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { RouteGuard } from "./route-guard";
import { PERMISSIONS } from "@/constant/permissions";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";
import type { RuntimeConfig } from "@/lib/runtime-config";
import type { BusinessUnitLicense } from "@/types/license";

// t(key) → key
vi.mock("@/hooks/use-pos-status", () => ({
  usePosStatus: () => ({
    enabledBrands: [],
    isEnabled: true,
    isLoading: false,
  }),
}));

vi.mock("use-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const routeLeaf = vi.fn();
// mock บางส่วน — คุมแค่ `findRouteLeaf` แต่ต้องคง `moduleList` ตัวจริงไว้ เพราะ
// `RouteGuard` เรียก `useLandingPath()` ซึ่งเดิน `moduleList` ทั้งก้อนหา leaf แรก
// ที่เข้าได้ (ปลายทางของปุ่มในกล่อง) — mock ทั้งโมดูลจะทำให้ export นั้นหายไป
vi.mock("@/constant/module-list", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/constant/module-list")>()),
  findRouteLeaf: () => routeLeaf(),
}));

const profile = vi.fn();
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => profile(),
}));

const licenseQuery = vi.fn();
vi.mock("@/hooks/use-license-query", () => ({
  useLicenseQuery: () => licenseQuery(),
}));

const BU_ID = "bu-1";
const PERMISSION = PERMISSIONS.procurement.purchase_request.view; // "procurement.purchase_request.view"
const FEATURE = "procurement.purchase_request"; // featureKeyOf(PERMISSION)
const MODULE = "procurement"; // module ของ FEATURE — backend ส่งมาคู่กันเสมอ

const baseConfig: RuntimeConfig = {
  BACKEND_URL: "",
  X_APP_ID: "app-1",
};

function license(
  overrides: Partial<BusinessUnitLicense> = {},
): BusinessUnitLicense {
  return {
    state: "active",
    end_date: "2027-01-01T00:00:00.000Z",
    // ต้องมีทั้ง module และ resource — `evaluateLicense` ของ backend ตรวจทั้งคู่
    // (สัญญาข้อ 4.4) และ `resolveLicense` เลียนแบบพฤติกรรมนั้น
    features: [MODULE, FEATURE],
    seat: { used: 0, cap: 0, pending_invites: 0 },
    ...overrides,
  };
}

function setup({
  permissions = [] as string[],
  systemLevel = "user",
  buLicense,
  enforced,
}: {
  permissions?: string[];
  systemLevel?: string;
  buLicense?: BusinessUnitLicense;
  enforced: boolean;
}) {
  setRuntimeConfigForTests({ ...baseConfig, LICENSE_ENFORCEMENT: enforced });
  profile.mockReturnValue({
    defaultBu: { id: BU_ID, system_level: systemLevel, permissions },
  });
  licenseQuery.mockReturnValue({
    data: buLicense ? { business_unit: { [BU_ID]: buLicense } } : undefined,
  });
}

function renderGuard() {
  return render(
    <MemoryRouter initialEntries={["/procurement/purchase-request"]}>
      <RouteGuard>
        <div>protected content</div>
      </RouteGuard>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  routeLeaf.mockReturnValue({
    name: "purchaseRequest",
    path: "/procurement/purchase-request",
    icon: () => null,
    permission: PERMISSION,
  });
});

describe("RouteGuard — permission (no license involved)", () => {
  it("renders children when the leaf requires no permission", () => {
    routeLeaf.mockReturnValue({
      name: "dashboard",
      path: "/procurement/purchase-request",
      icon: () => null,
    });
    setup({ enforced: true });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("blocks with the generic message when the user lacks permission", () => {
    setup({ permissions: [], systemLevel: "user", enforced: false });
    renderGuard();
    expect(screen.queryByText("protected content")).toBeNull();
    expect(screen.getByText("pageDescription")).toBeInTheDocument();
  });

  it("renders children when the user has the permission", () => {
    setup({ permissions: [PERMISSION], systemLevel: "user", enforced: false });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("admin bypasses permission entirely", () => {
    setup({ permissions: [], systemLevel: "admin", enforced: false });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});

describe("RouteGuard — license (checked before permission)", () => {
  it("does not block on a missing license when the enforcement switch is off, even with empty features", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: license({ state: "none", features: [] }),
      enforced: false,
    });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("blocks with the license message when enforcement is on and the feature is not in the contract", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: license({ state: "none", features: [] }),
      enforced: true,
    });
    renderGuard();
    expect(screen.queryByText("protected content")).toBeNull();
    expect(screen.getByText("licenseDescription")).toBeInTheDocument();
    // "ติดต่อผู้ดูแลเพื่อขอสิทธิ์" ขัดกับคำอธิบาย license (ให้ติดต่อฝ่ายขาย)
    expect(screen.queryByText("contactAdmin")).toBeNull();
  });

  it("บล็อกเพราะสิทธิ์ (ไม่ใช่ license) ยังแสดง contactAdmin ตามเดิม", () => {
    setup({ permissions: [], systemLevel: "user", enforced: false });
    renderGuard();
    expect(screen.getByText("pageDescription")).toBeInTheDocument();
    expect(screen.getByText("contactAdmin")).toBeInTheDocument();
  });

  it("blocks on a missing license even for a BU admin — no admin bypass for license", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "admin",
      buLicense: license({ state: "none", features: [] }),
      enforced: true,
    });
    renderGuard();
    expect(screen.queryByText("protected content")).toBeNull();
    expect(screen.getByText("licenseDescription")).toBeInTheDocument();
  });

  it("does not block a read when the license is expired — reads stay allowed", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: license({
        state: "expired",
        end_date: "2020-01-01T00:00:00.000Z",
      }),
      enforced: true,
    });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("does not block a read when the license is inactive — reads stay allowed", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: license({ state: "inactive" }),
      enforced: true,
    });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it('does not block when state is "unresolved", even with enforcement on', () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: license({ state: "unresolved", end_date: null, features: [] }),
      enforced: true,
    });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("does not block when the license block is entirely absent (old gateway) — treated as unlimited", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: undefined,
      enforced: true,
    });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });

  it("renders children when enforcement is on and the feature is licensed and active", () => {
    setup({
      permissions: [PERMISSION],
      systemLevel: "user",
      buLicense: license({ state: "active" }),
      enforced: true,
    });
    renderGuard();
    expect(screen.getByText("protected content")).toBeInTheDocument();
  });
});
