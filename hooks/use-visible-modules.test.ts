import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { LucideIcon } from "lucide-react";
import { annotate, markAll, useVisibleModules } from "./use-visible-modules";
import { PERMISSIONS } from "@/constant/permissions";
import type { ModuleDto } from "@/constant/module-list";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";

// ใช้ dummy icon เพราะ ModuleDto ต้องการ LucideIcon แต่ที่นี่ไม่ได้ทดสอบการ render ไอคอน
const DummyIcon = (() => null) as unknown as LucideIcon;

const PERMISSION = PERMISSIONS.procurement.purchase_request.view; // "procurement.purchase_request.view"
const FEATURE = "procurement.purchase_request"; // featureKeyOf(PERMISSION)

function leaf(overrides: Partial<ModuleDto> = {}): ModuleDto {
  return {
    name: "leaf",
    path: "/procurement/purchase-request",
    icon: DummyIcon,
    permission: PERMISSION,
    ...overrides,
  };
}

const licensedAll = () => true;
const licensedNone = () => false;
const canAll = () => true;
const canNone = () => false;

describe("annotate — non-admin", () => {
  it("leaf with permission the user has AND the feature licensed: neither denied nor locked", () => {
    const [result] = annotate([leaf()], canAll, licensedAll);
    expect(result.denied).toBe(false);
    expect(result.locked).toBe(false);
  });

  it("leaf with permission the user lacks: denied true, locked follows license independently", () => {
    const [result] = annotate([leaf()], canNone, licensedAll);
    expect(result.denied).toBe(true);
    expect(result.locked).toBe(false);
  });

  it("leaf the user has permission for, but the BU has not licensed: locked true, denied false", () => {
    const [result] = annotate([leaf()], canAll, licensedNone);
    expect(result.denied).toBe(false);
    expect(result.locked).toBe(true);
  });

  it("leaf without a permission requirement: always denied=false, locked=false regardless of can/isLicensed", () => {
    const [result] = annotate(
      [leaf({ permission: undefined })],
      canNone,
      licensedNone,
    );
    expect(result.denied).toBe(false);
    expect(result.locked).toBe(false);
  });

  it("parent denied is true only when every child is denied", () => {
    const modules: ModuleDto[] = [
      {
        name: "parent",
        path: "/procurement",
        icon: DummyIcon,
        subModules: [
          leaf({ name: "a", path: "/procurement/a" }),
          leaf({ name: "b", path: "/procurement/b" }),
        ],
      },
    ];
    const allDenied = annotate(modules, canNone, licensedAll);
    expect(allDenied[0].denied).toBe(true);

    // user has permission for only one child ("a") — parent should not be denied
    const can = (p: string) => p === leaf({ name: "a" }).permission;
    const oneAllowed = annotate(modules, can, licensedAll);
    expect(oneAllowed[0].denied).toBe(false);
  });

  it("parent locked is true only when every child is locked (same rule as denied)", () => {
    const modules: ModuleDto[] = [
      {
        name: "parent",
        path: "/procurement",
        icon: DummyIcon,
        subModules: [
          leaf({ name: "a", path: "/procurement/a" }),
          leaf({ name: "b", path: "/procurement/b" }),
        ],
      },
    ];
    const allLocked = annotate(modules, canAll, licensedNone);
    expect(allLocked[0].locked).toBe(true);

    // license covers feature "a" but not "b" — some locked, not all
    const isLicensed = (f: string) => f === FEATURE;
    const someLocked = annotate(
      [
        {
          name: "parent",
          path: "/procurement",
          icon: DummyIcon,
          subModules: [
            leaf({
              name: "a",
              path: "/procurement/a",
              permission: PERMISSION,
            }),
            leaf({
              name: "b",
              path: "/procurement/b",
              permission: PERMISSIONS.vendor_management.vendor.view,
            }),
          ],
        },
      ],
      canAll,
      isLicensed,
    );
    expect(someLocked[0].locked).toBe(false);
  });
});

describe("markAll — admin", () => {
  it("denied is always false regardless of license", () => {
    const [result] = markAll([leaf()], licensedNone);
    expect(result.denied).toBe(false);
  });

  it("REQUIRED: admin + BU without a license still gets locked=true — admin bypasses permission, never license", () => {
    const [result] = markAll([leaf()], licensedNone);
    expect(result.locked).toBe(true);
  });

  it("admin + BU with the feature licensed is not locked", () => {
    const [result] = markAll([leaf()], licensedAll);
    expect(result.locked).toBe(false);
  });

  it("leaf without a permission requirement is never locked, even with no license data", () => {
    const [result] = markAll([leaf({ permission: undefined })], licensedNone);
    expect(result.locked).toBe(false);
  });

  it("parent locked is true only when every child is locked", () => {
    const modules: ModuleDto[] = [
      {
        name: "parent",
        path: "/procurement",
        icon: DummyIcon,
        subModules: [
          leaf({ name: "a", path: "/procurement/a" }),
          leaf({ name: "b", path: "/procurement/b" }),
        ],
      },
    ];
    const allLocked = markAll(modules, licensedNone);
    expect(allLocked[0].locked).toBe(true);

    const isLicensed = (f: string) => f === FEATURE; // only "a" is licensed
    const someLocked = markAll(
      [
        {
          name: "parent",
          path: "/procurement",
          icon: DummyIcon,
          subModules: [
            leaf({ name: "a", path: "/procurement/a", permission: PERMISSION }),
            leaf({
              name: "b",
              path: "/procurement/b",
              permission: PERMISSIONS.vendor_management.vendor.view,
            }),
          ],
        },
      ],
      isLicensed,
    );
    expect(someLocked[0].locked).toBe(false);
  });

  it("enforcement switch off (isLicensed always true) locks nothing, even for admin", () => {
    const [result] = markAll([leaf()], licensedAll);
    expect(result.locked).toBe(false);
  });
});

// Wiring test ผ่าน useVisibleModules จริง (ไม่ mock use-can/use-license ตรง ๆ เพื่อเลี่ยง
// vi.mock hoisting ชนกับ export ของ use-license.ts เช่น featureKeyOf) — mock ที่
// @/hooks/use-profile ชั้นเดียว ตามแบบ route-guard.test.tsx เพื่อยืนยันว่า
// useVisibleModules ต่อสาย isAdmin → markAll / non-admin → annotate ถูกจริง
const profile = vi.fn();
vi.mock("@/hooks/use-pos-status", () => ({
  usePosStatus: () => ({
    enabledBrands: [],
    isEnabled: true,
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => profile(),
}));

const licenseQuery = vi.fn();
vi.mock("@/hooks/use-license-query", () => ({
  useLicenseQuery: () => licenseQuery(),
}));

const BU_ID = "bu-1";

function setupProfile({
  systemLevel = "user",
  permissions = [] as string[],
  buLicense,
}: {
  systemLevel?: string;
  permissions?: string[];
  buLicense?: {
    state: string;
    end_date: string | null;
    features: string[];
    seat: { used: number; cap: number; pending_invites: number };
  };
}) {
  profile.mockReturnValue({
    defaultBu: { id: BU_ID, system_level: systemLevel, permissions },
  });
  licenseQuery.mockReturnValue({
    data: buLicense ? { business_unit: { [BU_ID]: buLicense } } : undefined,
  });
}

describe("useVisibleModules — wiring (isAdmin → markAll, else → annotate)", () => {
  it("non-admin without permission and without license: denied true, locked true", () => {
    setRuntimeConfigForTests({
      BACKEND_URL: "",
      X_APP_ID: "app-1",
      LICENSE_ENFORCEMENT: true,
    });
    setupProfile({
      systemLevel: "user",
      permissions: [],
      buLicense: {
        state: "none",
        end_date: null,
        features: [],
        seat: { used: 0, cap: 0, pending_invites: 0 },
      },
    });
    const { result } = renderHook(() => useVisibleModules([leaf()]));
    expect(result.current[0].denied).toBe(true);
    expect(result.current[0].locked).toBe(true);
  });

  it("REQUIRED: admin + BU without a license still gets locked=true via the real hook wiring", () => {
    setRuntimeConfigForTests({
      BACKEND_URL: "",
      X_APP_ID: "app-1",
      LICENSE_ENFORCEMENT: true,
    });
    setupProfile({
      systemLevel: "admin",
      permissions: [],
      buLicense: {
        state: "none",
        end_date: null,
        features: [],
        seat: { used: 0, cap: 0, pending_invites: 0 },
      },
    });
    const { result } = renderHook(() => useVisibleModules([leaf()]));
    // admin ข้าม permission ได้ → denied false เสมอ
    expect(result.current[0].denied).toBe(false);
    // แต่ข้าม license ไม่ได้ → locked ต้องยังเป็น true
    expect(result.current[0].locked).toBe(true);
  });

  it("enforcement switch off: nothing is locked even for a non-admin user with no license", () => {
    setRuntimeConfigForTests({
      BACKEND_URL: "",
      X_APP_ID: "app-1",
      LICENSE_ENFORCEMENT: false,
    });
    setupProfile({
      systemLevel: "user",
      permissions: [PERMISSION],
      buLicense: {
        state: "none",
        end_date: null,
        features: [],
        seat: { used: 0, cap: 0, pending_invites: 0 },
      },
    });
    const { result } = renderHook(() => useVisibleModules([leaf()]));
    expect(result.current[0].locked).toBe(false);
  });
});
