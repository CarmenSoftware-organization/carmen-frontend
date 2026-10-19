import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { renderForm } from "@/lib/test-utils/form-characterization";
import type { InventoryAdjustmentType } from "@/types/inventory-adjustment";
import type { AdjFormValues } from "./ia-form-schema";

/**
 * ใบจ่ายออกดูสต๊อก ณ วันที่ของใบ ไม่ใช่ทั้งงวด
 *
 * ล็อตที่รับเข้าวันที่ 29 ต้องไม่ถูกเสนอให้ใบที่ลงวันที่ 28 — ฟอร์มจึงต้องส่งวันที่ของใบไปทั้งตัวประมาณราคา
 * และหน้าต่างดูสต๊อก และเตือนตั้งแต่ตอนกรอกถ้าจำนวนเกินยอดที่ตัดได้ ณ วันนั้น
 */

const DOC_DATE = "2026-07-14T17:00:00.000Z";
const OVER_MESSAGE = "More than can be issued on 2026-07-15 (3 available)";

const costCalls: unknown[][] = [];
const stockInCostCalls: unknown[][] = [];
vi.mock("@/hooks/use-product-cost", () => ({
  useProductCostByLocationQty: (...args: unknown[]) => {
    costCalls.push(args);
    return { data: undefined };
  },
  useStockInDefaultCost: (...args: unknown[]) => {
    stockInCostCalls.push(args);
    return { data: undefined };
  },
}));

let inventory: { available_qty?: number; as_of_date?: string } | undefined;
vi.mock("@/hooks/use-product-inventory", () => ({
  useProductInventory: () => ({ data: inventory }),
}));

const dialogProps: Record<string, unknown>[] = [];
vi.mock("@/components/share/inventory-dialog", () => ({
  InventoryDialog: (props: Record<string, unknown>) => {
    dialogProps.push(props);
    return null;
  },
}));
const onHandProps: Record<string, unknown>[] = [];
vi.mock("@/components/share/on-hand-dialog", () => ({
  OnHandDialog: (props: Record<string, unknown>) => {
    onHandProps.push(props);
    return null;
  },
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: "BU-1" }),
}));
vi.mock("@/components/lookup/lookup-product-in-location", () => ({
  LookupProductInLocation: () => null,
}));

const { AdjItemFields } = await import("./ia-item-fields");

function Harness({
  type,
  qty,
}: {
  readonly type: InventoryAdjustmentType;
  readonly qty: number;
}) {
  const form = useForm<AdjFormValues>({
    defaultValues: {
      description: "",
      doc_status: "draft",
      adjustment_type_id: "type-1",
      date: DOC_DATE,
      location_id: "loc-1",
      items: [
        {
          id: "line-1",
          doc_version: 0,
          product_id: "prod-1",
          product_name: "Sugar",
          product_local_name: "",
          unit_name: "KG",
          qty,
          cost_per_unit: 0,
          total_cost: 0,
          description: "",
        },
      ],
    },
  });
  return <AdjItemFields form={form} disabled={false} adjustmentType={type} />;
}

beforeEach(() => {
  costCalls.length = 0;
  stockInCostCalls.length = 0;
  dialogProps.length = 0;
  onHandProps.length = 0;
  inventory = { available_qty: 3, as_of_date: "2026-07-15" };
});

describe("AdjItemFields — stock-out reads stock on its own date", () => {
  it("prices and shows stock as of the document date", async () => {
    renderForm(<Harness type="stock-out" qty={2} />);

    await waitFor(() => expect(costCalls.length).toBeGreaterThan(0));
    expect(costCalls.at(-1)).toEqual(["BU-1", "prod-1", "loc-1", 2, DOC_DATE]);
    expect(dialogProps.at(-1)).toEqual(
      expect.objectContaining({ atDate: DOC_DATE }),
    );
  });

  it("opens the per-location on-hand list from the box, on the same date", async () => {
    renderForm(<Harness type="stock-out" qty={2} />);

    await waitFor(() => expect(onHandProps.length).toBeGreaterThan(0));
    expect(typeof dialogProps.at(-1)?.onOnHandClick).toBe("function");
    expect(onHandProps.at(-1)).toEqual(
      expect.objectContaining({ productId: "prod-1", atDate: DOC_DATE }),
    );
  });

  it("flags a quantity above what can be issued that day with an icon that opens on hover", async () => {
    renderForm(<Harness type="stock-out" qty={5} />);

    const icon = await screen.findByRole("button", { name: OVER_MESSAGE });
    // the full line used to sit under the field and overlap it — now it waits behind the icon
    expect(screen.queryByText(OVER_MESSAGE)).toBeNull();
    fireEvent.mouseEnter(icon);
    expect(await screen.findByText(OVER_MESSAGE)).toBeTruthy();
  });

  it("opens the message on click too, for touch screens", async () => {
    renderForm(<Harness type="stock-out" qty={5} />);

    fireEvent.click(await screen.findByRole("button", { name: OVER_MESSAGE }));
    expect(await screen.findByText(OVER_MESSAGE)).toBeTruthy();
  });

  it("stays quiet when the quantity fits", async () => {
    renderForm(<Harness type="stock-out" qty={3} />);

    await waitFor(() => expect(costCalls.length).toBeGreaterThan(0));
    expect(
      screen.queryByRole("button", { name: /More than can be issued/ }),
    ).toBeNull();
  });
});

describe("AdjItemFields — stock-in stock is not dated", () => {
  it("prices from si.cost-from as of its date, reads stock undated and never warns", async () => {
    renderForm(<Harness type="stock-in" qty={5} />);

    // the starting price follows the BU si.cost-from, not the issue estimate
    await waitFor(() => expect(stockInCostCalls.length).toBeGreaterThan(0));
    expect(stockInCostCalls.at(-1)).toEqual(["BU-1", "prod-1", "loc-1", DOC_DATE]);
    expect(costCalls).toHaveLength(0);
    expect(dialogProps.at(-1)?.atDate).toBeUndefined();
    // the per-location list is there too, on the current period like the box
    expect(typeof dialogProps.at(-1)?.onOnHandClick).toBe("function");
    expect(onHandProps.at(-1)?.atDate).toBeUndefined();
    expect(
      screen.queryByRole("button", { name: /More than can be issued/ }),
    ).toBeNull();
  });
});
