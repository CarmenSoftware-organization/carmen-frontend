// ชนิดข้อมูลของ AP dashboard (ยังเป็น mock — ไม่มี API aging/dashboard ที่ backend)

export interface ApAgingBucket {
  code:
    | "not_due"
    | "due_today"
    | "overdue_1_30"
    | "overdue_31_60"
    | "overdue_61_90"
    | "overdue_90_plus"
    | "missing_due_date";
  amount: string;
  item_count: number;
  vendor_count: number;
}

export interface ApDashboardSnapshot {
  bu_code: string;
  as_of_date: string;
  paid_from: string;
  paid_to: string;
  functional_currency: string;
  generated_at: string;
  outstanding_amount: string;
  outstanding_count: number;
  prepaid_amount: string;
  prepaid_count: number;
  paid_out_amount: string;
  payment_count: number;
  aging: ApAgingBucket[];
  due: { overdue: number; on_hold: number; reserved: number };
  approvals: { invoice: number; payment: number };
  tax: {
    pending_vat: string;
    missing_documents: number;
    pending_corrections: number;
  };
  reconciliation_variance: string;
  widget_errors: string[];
}
