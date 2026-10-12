import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { renderForm } from "@/lib/test-utils/form-characterization";
import type { PrFormValues } from "./pr-form-schema";

/**
 * PR แสดง on hand ณ ปัจจุบัน — กล่อง on hand ในช่องสินค้า แถวสรุปใต้บรรทัด และรายการรายคลัง
 * ไม่ส่งวันที่ของใบ (PR Date) ไปแม้จะกรอกไว้แล้ว
 */

const PR_DATE = "2026-10-05";

const boxProps: Record<string, unknown>[] = [];
vi.mock("@/components/share/inventory-dialog", () => ({
  InventoryDialog: (props: Record<string, unknown>) => {
    boxProps.push(props);
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
vi.mock("@/components/share/on-order-dialog", () => ({ OnOrderDialog: () => null }));
const inventoryCalls: unknown[][] = [];
vi.mock("@/hooks/use-product-inventory", () => ({
  useProductInventory: (...args: unknown[]) => {
    inventoryCalls.push(args);
    return { data: undefined, isLoading: false };
  },
}));

const { InventoryDialogCell } = await import("./pr-item-cells/helpers");
const { default: PrInventoryRow } = await import("./pr-inventory-row");

function Harness({ prDate }: { readonly prDate: string }) {
  const form = useForm<PrFormValues>({
    defaultValues: {
      pr_date: prDate,
      items: [{ product_id: "prod-1", location_id: "loc-1", product_name: "Sugar" }],
    } as unknown as PrFormValues,
  });
  return (
    <>
      <InventoryDialogCell control={form.control} index={0} buCode="BU-1" />
      <PrInventoryRow control={form.control} index={0} buCode="BU-1" />
    </>
  );
}

beforeEach(() => {
  boxProps.length = 0;
  onHandProps.length = 0;
  inventoryCalls.length = 0;
});

describe("PR — stock as of now", () => {
  it("sends no date to the on-hand box, the row under the line or the per-location list", async () => {
    renderForm(<Harness prDate={PR_DATE} />);

    await waitFor(() => expect(boxProps.length).toBeGreaterThan(0));
    expect(boxProps.at(-1)?.atDate).toBeUndefined();
    expect(inventoryCalls.at(-1)).toEqual(["BU-1", "loc-1", "prod-1"]);
    expect(onHandProps.every((props) => props.atDate === undefined)).toBe(true);
  });
});
