import { describe, expect, it } from "vitest";
import { router } from "@/routes/router";

const ACCOUNTING_PATHS = [
  "general-ledger",
  "accounts-payable",
  "accounts-receivable",
  "asset",
  "accounting/*",
];

describe("protected routes", () => {
  it("renders the four accounting modules inside the protected application shell", () => {
    const appRoot = router.routes[0];
    const protectedShell = appRoot.children?.find((route) =>
      route.children?.some((child) => child.path === "dashboard"),
    );

    for (const path of ACCOUNTING_PATHS) {
      expect(
        protectedShell?.children?.some((route) => route.path === path),
      ).toBe(true);
      expect(appRoot.children?.some((route) => route.path === path)).toBe(
        false,
      );
    }
  });
});
