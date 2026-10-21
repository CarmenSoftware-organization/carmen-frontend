/**
 * สีจุดของแต่ละ action ใน stage — ใช้ token เดียวกับปุ่ม action บนเอกสาร (approve / reject /
 * send back) ให้แท็บ General และ Notifications ของ stage จับคู่สีเดียวกัน
 * ใช้เป็นสีพื้น (bg-*) เท่านั้น ไม่ใช่สีตัวอักษร
 */
export const ACTION_DOT_CLASS = {
  approve: "bg-success",
  reject: "bg-destructive",
  sendback: "bg-warning",
} as const;

export const ACTION_ROWS = [
  {
    key: "approve",
    labelKey: "actionApprove",
    hintKey: "actionApproveHint",
    dotClass: ACTION_DOT_CLASS.approve,
  },
  {
    key: "reject",
    labelKey: "actionReject",
    hintKey: "actionRejectHint",
    dotClass: ACTION_DOT_CLASS.reject,
  },
  {
    key: "sendback",
    labelKey: "actionSendBack",
    hintKey: "actionSendBackHint",
    dotClass: ACTION_DOT_CLASS.sendback,
  },
] as const;
