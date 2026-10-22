import { describe, it, expect } from "vitest";
import { cellDocHref, docHref, idColumnKey } from "../table-row-link";
import type { TableData } from "@/types/dashboard-widget";

const table = (cols: TableData["columns"]): TableData => ({
  columns: cols,
  rows: [],
});

describe("idColumnKey", () => {
  it("finds the column carrying the document id", () => {
    expect(
      idColumnKey(
        table([
          { key: "id", label: "", type: "id" },
          { key: "status", label: "Status", type: "text" },
        ]),
      ),
    ).toBe("id");
    expect(
      idColumnKey(table([{ key: "doc_id", label: "", type: "id" }])),
    ).toBe("doc_id");
  });

  it("returns null when the dataset carries no id", () => {
    expect(idColumnKey(table([{ key: "a", label: "A", type: "text" }]))).toBeNull();
    expect(idColumnKey(null)).toBeNull();
  });
});

describe("docHref", () => {
  const row = { id: "019638a6-2a00-7c4f-8e46-9b7a52c80c4d" };

  it("routes each document family to its own detail page", () => {
    expect(docHref("document.pr-table", row, "id")).toBe(
      "/procurement/purchase-request/019638a6-2a00-7c4f-8e46-9b7a52c80c4d",
    );
    expect(docHref("document.po-rejected", { doc_id: "po-1" }, "doc_id")).toBe(
      "/procurement/purchase-order/po-1",
    );
    expect(docHref("document.sr-sent-back", { doc_id: "sr-1" }, "doc_id")).toBe(
      "/store-operation/store-requisition/sr-1",
    );
  });

  // ranked ของเอกสาร (id มาใน extras แล้ว asTableData ยกขึ้นเป็นคอลัมน์ id)
  it("routes the ranked document datasets too", () => {
    expect(
      docHref("procurement.slowest-po-approvals", { id: "po-9" }, "id"),
    ).toBe("/procurement/purchase-order/po-9");
    expect(
      docHref("procurement.slowest-pr-approvals", { id: "pr-9" }, "id"),
    ).toBe("/procurement/purchase-request/pr-9");
    expect(docHref("workflow.my-pending-pr", { id: "pr-1" }, "id")).toBe(
      "/procurement/purchase-request/pr-1",
    );
  });

  // ranked ที่ไม่ใช่เอกสาร (สินค้า/ผู้ขาย) ยังไม่มีหน้าปลายทาง ต้องไม่กดได้
  it("leaves non-document ranked datasets alone", () => {
    expect(
      docHref("procurement.top-products-by-quantity", { id: "p-1" }, "id"),
    ).toBeNull();
    expect(docHref("inventory.most-active-products", { id: "p-1" }, "id")).toBeNull();
  });

  // ตารางที่ไม่ได้ชี้ไปเอกสาร (below-par ฯลฯ) ต้องไม่กลายเป็นแถวกดได้ที่กดแล้วเงียบ
  it("returns null for a dataset with no detail page", () => {
    expect(docHref("inventory.below-par-items", row, "id")).toBeNull();
  });

  it("returns null when the row has no usable id", () => {
    expect(docHref("document.pr-table", {}, "id")).toBeNull();
    expect(docHref("document.pr-table", { id: "" }, "id")).toBeNull();
    expect(docHref("document.pr-table", { id: 42 }, "id")).toBeNull();
    expect(docHref("document.pr-table", row, null)).toBeNull();
  });

  it("escapes the id instead of pasting it into the path raw", () => {
    expect(docHref("document.pr-table", { id: "a/b?c" }, "id")).toBe(
      "/procurement/purchase-request/a%2Fb%3Fc",
    );
  });
});

describe("cellDocHref", () => {
  const link = { doc_type: "last_doc_type", doc_id: "last_doc_id", title: "last_doc_no" };
  const row = (type: unknown, id: unknown) => ({ last_doc_type: type, last_doc_id: id, last_doc_no: "X" });

  it("routes every inventory document type to its own page", () => {
    expect(cellDocHref(row("good_received_note", "g1"), link)).toBe("/procurement/goods-receive-note/g1");
    expect(cellDocHref(row("credit_note", "c1"), link)).toBe("/procurement/credit-note/c1");
    expect(cellDocHref(row("store_requisition", "r1"), link)).toBe("/store-operation/store-requisition/r1");
    expect(cellDocHref(row("stock_in", "s1"), link)).toBe("/inventory-management/inventory-adjustment/s1?type=stock-in");
    expect(cellDocHref(row("stock_out", "o1"), link)).toBe("/inventory-management/inventory-adjustment/o1?type=stock-out");
  });

  it("has no link without a document or for a type with no page", () => {
    expect(cellDocHref(row("stock_out", ""), link)).toBeNull();
    expect(cellDocHref(row("stock_out", null), link)).toBeNull();
    expect(cellDocHref(row("", "o1"), link)).toBeNull();
    expect(cellDocHref(row("close", "o1"), link)).toBeNull();
  });

  it("encodes the id", () => {
    expect(cellDocHref(row("credit_note", "a/b"), link)).toBe("/procurement/credit-note/a%2Fb");
  });
});
