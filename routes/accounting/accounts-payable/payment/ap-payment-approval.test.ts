import { expect, it } from "vitest";
import { canBatchApprovePayment } from "./ap-payment-approval";

it("only batch approves a versioned pending voucher assigned to the signed-in user", () => {
  const pending = {
    doc_status: "in_review" as const,
    doc_version: 0,
    user_action: { execute: [{ user_id: "reviewer" }] },
  };
  expect(canBatchApprovePayment(pending, "reviewer")).toBe(true);
  expect(canBatchApprovePayment(pending, "someone-else")).toBe(false);
  expect(canBatchApprovePayment(pending, null)).toBe(false);
  expect(
    canBatchApprovePayment({ ...pending, user_action: null }, "reviewer"),
  ).toBe(false);
  expect(
    canBatchApprovePayment({ ...pending, doc_status: "posted" }, "reviewer"),
  ).toBe(false);
  expect(
    canBatchApprovePayment({ ...pending, doc_version: null }, "reviewer"),
  ).toBe(false);
});
