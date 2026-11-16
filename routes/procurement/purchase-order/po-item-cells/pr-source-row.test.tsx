import { describe, it, expect, vi } from "vitest";

// เทสต์นี้สนใจแค่ปุ่มใบขอซื้อ — ตัดกล่องสต๊อกที่อยู่ข้างกันออก มันลาก useBuCode
// กับ query ของ inventory มาทั้งพวง
vi.mock("./inventory-dialog-cell", () => ({ PoInventoryDialog: () => null }));
// ช่อง dimension ต่อบรรทัดลาก license/profile query มาด้วย — ไม่เกี่ยวกับปุ่มต้นทาง
vi.mock("./item-dimensions", () => ({ PoItemDimensions: () => null }));
import { render, screen } from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { MemoryRouter } from "react-router";
import { useForm, useFieldArray } from "react-hook-form";
import en from "@/messages/en.json";
import type { PoFormValues } from "../po-form-schema";
import { CommentFooterRow } from "./comment-footer-row";
import type { PrSource } from "./pr-source-button";

/**
 * แมปคีย์ด้วย id ของแถวจาก response — **ไม่ใช่ `field.id` ของ useFieldArray**
 * ซึ่งเป็น uuid ที่ RHF สร้างทับลงไป ถ้าหยิบผิดตัวปุ่มจะไม่โผล่สักแถวแบบเงียบ ๆ
 */
function Harness({
  map,
  grnMap = new Map(),
}: {
  map: Map<string, PrSource[]>;
  grnMap?: Map<string, PrSource[]>;
}) {
  const form = useForm<PoFormValues>({
    defaultValues: {
      items: [{ id: "detail-1", comment: "" }],
    } as unknown as PoFormValues,
  });
  const { fields } = useFieldArray({ control: form.control, name: "items" });
  if (!fields.length) return null;
  return (
    <MemoryRouter>
      <IntlProvider locale="en" messages={en}>
        <CommentFooterRow
          form={form}
          itemFields={fields}
          item={fields[0]}
          isDisabled={false}
          placeholder="comment"
          leadingWidth={33}
          prSourcesByDetailId={map}
          grnSourcesByDetailId={grnMap}
        />
      </IntlProvider>
    </MemoryRouter>
  );
}

describe("ปุ่มใบขอซื้อต้นทางในแถวหมายเหตุ", () => {
  it("ใบเดียว โชว์เลขที่ใบเลย", () => {
    render(
      <Harness map={new Map([["detail-1", [{ id: "p1", no: "PR-001" }]]])} />,
    );
    expect(screen.getByText("PR-001")).toBeInTheDocument();
  });

  it("หลายใบ โชว์จำนวน", () => {
    render(
      <Harness
        map={
          new Map([
            [
              "detail-1",
              [
                { id: "p1", no: "PR-001" },
                { id: "p2", no: "PR-002" },
              ],
            ],
          ])
        }
      />,
    );
    expect(screen.getByText("2 PRs")).toBeInTheDocument();
  });

  // โชว์ปุ่มทุกแถวไว้ก่อน — backend ยังส่ง pr_details มาว่าง ซ่อนปุ่มแล้วแยกไม่ออก
  // ว่า "แถวนี้ไม่มีต้นทาง" หรือ "ฟีเจอร์ยังไม่มา"
  it("แถวไม่มีต้นทาง ยังมีปุ่มแต่ไม่มีเลขที่ใบ", () => {
    render(<Harness map={new Map()} />);
    expect(screen.getByRole("button")).toBeInTheDocument();
    expect(screen.queryByText(/PR-/)).not.toBeInTheDocument();
  });
});

describe("ป้ายใบรับสินค้าในแถวหมายเหตุ", () => {
  it("ใบเดียว โชว์เลขที่ใบเลย", () => {
    render(
      <Harness
        map={new Map()}
        grnMap={new Map([["detail-1", [{ id: "g1", no: "GRN-001" }]]])}
      />,
    );
    expect(screen.getByText("GRN-001")).toBeInTheDocument();
  });

  it("หลายใบ โชว์จำนวน", () => {
    render(
      <Harness
        map={new Map()}
        grnMap={
          new Map([
            [
              "detail-1",
              [
                { id: "g1", no: "GRN-001" },
                { id: "g2", no: "GRN-002" },
              ],
            ],
          ])
        }
      />,
    );
    expect(screen.getByText("2 GRNs")).toBeInTheDocument();
  });

  // ต่างจากป้ายใบขอซื้อ — ยังไม่ได้รับของคือสถานะปกติของ PO เกือบทุกใบ
  // โชว์ป้ายเปล่าทุกแถวคือ noise เปล่า ๆ
  it("ยังไม่ได้รับของ ไม่มีป้ายเลย", () => {
    render(<Harness map={new Map()} />);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });
});
