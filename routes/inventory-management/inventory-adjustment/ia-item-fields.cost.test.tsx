import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { useForm, type UseFormReturn } from "react-hook-form";
import { renderForm } from "@/lib/test-utils/form-characterization";
import type { InventoryAdjustmentType } from "@/types/inventory-adjustment";
import type { AdjFormValues } from "./ia-form-schema";

// ตัวประเมินต้นทุนตอบค่าที่ต่างจากที่โหลดมาเสมอ จะได้เห็นว่ามันทับหรือไม่ทับ
const estimate = { average_cost_per_unit: 62.5, total_cost: 125 };
vi.mock("@/hooks/use-product-cost", () => ({
  useProductCostByLocationQty: () => ({ data: estimate }),
  // ราคาตั้งต้นของใบรับเข้า (si.cost-from) — ต่างจากราคาที่พิมพ์ไว้ จะได้เห็นว่าไม่ทับ
  useStockInDefaultCost: () => ({ data: { cost_per_unit: 99, method: "last_cost" } }),
}));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ buCode: "BU-1" }),
}));
vi.mock("@/components/share/inventory-dialog", () => ({
  InventoryDialog: () => null,
}));
vi.mock("@/components/lookup/lookup-product-in-location", () => ({
  LookupProductInLocation: () => null,
}));

const { AdjItemFields } = await import("./ia-item-fields");

const row = (cost: number, total: number): AdjFormValues["items"][number] => ({
  id: "line-1",
  doc_version: 0,
  product_id: "prod-1",
  product_name: "Seaweed snack",
  product_local_name: "",
  unit_name: "BAG",
  qty: 2,
  cost_per_unit: cost,
  total_cost: total,
  description: "",
});

let formRef: UseFormReturn<AdjFormValues> | null = null;

function Harness({
  type,
  docStatus,
  disabled,
  item,
}: {
  type: InventoryAdjustmentType;
  docStatus: string;
  disabled: boolean;
  item: AdjFormValues["items"][number];
}) {
  const form = useForm<AdjFormValues>({
    defaultValues: {
      description: "",
      doc_status: docStatus,
      adjustment_type_id: "type-1",
      date: "2026-07-15T00:00:00.000Z",
      location_id: "loc-1",
      items: [item],
    },
  });
  useEffect(() => {
    formRef = form;
  }, [form]);
  return <AdjItemFields form={form} disabled={disabled} adjustmentType={type} />;
}

beforeEach(() => {
  formRef = null;
});

// e2e SO.2 (2026-10-02): a stock-out draft reopened with 0.00 cost on every line, because a
// draft's stored cost is always 0 (the backend never takes a cost from the client) and the
// estimate only ran when product/location/qty changed.
describe("AdjItemFields — stock-out cost is an estimate", () => {
  it("[view] a draft shows the estimate instead of the stored 0, without dirtying the form", async () => {
    renderForm(
      <Harness type="stock-out" docStatus="draft" disabled item={row(0, 0)} />,
    );

    await waitFor(() => expect(screen.getByText("\u2212125.00")).toBeTruthy());
    expect(formRef?.formState.isDirty).toBe(false);
  });

  it("[edit] a draft line that already exists is estimated on mount, without dirtying the form", async () => {
    renderForm(
      <Harness type="stock-out" docStatus="draft" disabled={false} item={row(0, 0)} />,
    );

    await waitFor(() =>
      expect(formRef?.getValues("items.0.total_cost")).toBe(125),
    );
    expect(formRef?.formState.isDirty).toBe(false);
  });

  it("[view] a committed stock-out keeps the cost the ledger posted", async () => {
    renderForm(
      <Harness type="stock-out" docStatus="completed" disabled item={row(62.14, 124.28)} />,
    );

    expect(await screen.findByText("\u2212124.28")).toBeTruthy();
    expect(screen.queryByText("\u2212125.00")).toBeNull();
  });
});

describe("AdjItemFields — stock-in cost is typed by the user", () => {
  it("[edit] an existing line keeps its typed cost when the form unlocks", async () => {
    renderForm(
      <Harness type="stock-in" docStatus="draft" disabled={false} item={row(300, 600)} />,
    );

    expect(await screen.findByText("+600.00")).toBeTruthy();
    expect(formRef?.getValues("items.0.cost_per_unit")).toBe(300);
  });
});
