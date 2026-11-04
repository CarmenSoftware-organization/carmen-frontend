import { describe, expect, it } from "vitest";
import type { DashboardDataset } from "@/types/dashboard-dataset";
import { groupDatasetsByModule, moduleOfDataset } from "../widget-module";

const ds = (id: string, name: string, description = ""): DashboardDataset => ({
  id,
  name,
  description,
  shape: "scalar",
  category: "workflow",
  unit: "items",
});

const TH_LABEL: Record<string, string> = {
  "vendor.total-active": "ผู้ขายที่ใช้งาน",
};
const MODULE_LABEL: Record<string, string> = {
  document: "Documents",
  vendor: "Vendors",
};
const options = (query = "") => ({
  labelOf: (d: DashboardDataset) => TH_LABEL[d.id] ?? d.name,
  moduleLabelOf: (m: string) => MODULE_LABEL[m] ?? m,
  query,
  locale: "en",
});

describe("moduleOfDataset", () => {
  it("takes the id prefix before the first dot", () => {
    expect(moduleOfDataset("document.pr-count")).toBe("document");
    expect(moduleOfDataset("lab.pr-created-series")).toBe("lab");
  });

  // preset ของหน้าเว็บต้องอยู่หมวดเดียวกับ dataset ที่มันห่อ ไม่ใช่หมวด "group@document"
  it("strips a page-side `x@` prefix", () => {
    expect(moduleOfDataset("group@document.pr-count#mine")).toBe("document");
  });
});

describe("groupDatasetsByModule", () => {
  const catalogue = [
    ds("lab.pr-count-recent", "PR count (recent)"),
    ds("vendor.total-active", "Active vendors"),
    ds("zeta.thing", "Zeta thing"),
    ds("document.po-count", "PO count"),
    ds("alpha.thing", "Alpha thing"),
    ds("document.grn-count", "GRN count"),
    ds("group@document.pr-count", "PR summary"),
  ];

  it("orders known modules first, lab last among them, unknown prefixes after alphabetically", () => {
    const groups = groupDatasetsByModule(catalogue, options());
    expect(groups.map((g) => g.module)).toEqual([
      "document",
      "vendor",
      "lab",
      "alpha",
      "zeta",
    ]);
  });

  it("sorts items inside a module by their display label", () => {
    const [documents] = groupDatasetsByModule(catalogue, options());
    expect(documents.items.map((d) => d.name)).toEqual([
      "GRN count",
      "PO count",
      "PR summary",
    ]);
  });

  it("drops modules with no match and requires every search term", () => {
    const groups = groupDatasetsByModule(catalogue, options("count po"));
    expect(groups).toHaveLength(1);
    expect(groups[0].items.map((d) => d.id)).toEqual(["document.po-count"]);
  });

  it("searches the translated label and the module label", () => {
    expect(
      groupDatasetsByModule(catalogue, options("ผู้ขาย")).flatMap((g) =>
        g.items.map((d) => d.id),
      ),
    ).toEqual(["vendor.total-active"]);
    expect(
      groupDatasetsByModule(catalogue, options("documents")).map(
        (g) => g.module,
      ),
    ).toEqual(["document"]);
  });

  it("matches the description and is case-insensitive", () => {
    const groups = groupDatasetsByModule(
      [ds("inventory.low-stock", "Low stock", "Below Reorder threshold")],
      options("REORDER"),
    );
    expect(groups.map((g) => g.module)).toEqual(["inventory"]);
  });
});
