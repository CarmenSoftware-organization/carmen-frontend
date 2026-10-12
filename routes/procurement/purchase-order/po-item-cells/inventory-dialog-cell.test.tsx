import { describe, it, expect, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { renderForm } from "@/lib/test-utils/form-characterization";
import type { PoFormValues } from "../po-form-schema";

/**
 * PO แสดง on hand ณ ปัจจุบัน — ทั้งกล่อง on hand และรายการรายคลัง
 * ไม่ส่งวันที่สั่ง (Order Date) ไปแม้จะกรอกไว้แล้ว
 */

const ORDER_DATE = "2026-10-04T17:00:00.000Z";

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
vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU-1" }));

const { PoInventoryDialog } = await import("./inventory-dialog-cell");

function Harness({ orderDate }: { readonly orderDate: string }) {
  const form = useForm<PoFormValues>({
    defaultValues: {
      order_date: orderDate,
      items: [{ product_id: "prod-1", location_id: "loc-1", product_name: "Sugar" }],
    } as unknown as PoFormValues,
  });
  return <PoInventoryDialog control={form.control} index={0} />;
}

beforeEach(() => {
  boxProps.length = 0;
  onHandProps.length = 0;
});

describe("PoInventoryDialog — stock as of now", () => {
  it("sends no date to the on-hand box or the per-location list", async () => {
    renderForm(<Harness orderDate={ORDER_DATE} />);

    await waitFor(() => expect(onHandProps.length).toBeGreaterThan(0));
    expect(boxProps.at(-1)?.atDate).toBeUndefined();
    expect(onHandProps.at(-1)?.atDate).toBeUndefined();
  });
});
