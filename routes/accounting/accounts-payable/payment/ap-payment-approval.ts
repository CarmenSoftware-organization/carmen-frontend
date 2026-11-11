import type { ApPayment } from "@/types/accounts-payable";

export function canBatchApprovePayment(
  payment: Pick<ApPayment, "doc_status" | "doc_version" | "user_action">,
  userId?: string | null,
): boolean {
  const assignees = payment.user_action?.execute;
  return (
    payment.doc_status === "in_review" &&
    payment.doc_version != null &&
    !!userId &&
    Array.isArray(assignees) &&
    assignees.some((user) => user?.user_id === userId)
  );
}
