import type { DecimalString } from "@/types/accounts-payable";
import { addDecimal, subtractDecimal } from "../shared/ap-decimal";

/**
 * ยอดรวมแสดงผลฝั่ง client ก่อนบันทึก — สูตรเดียวกับ backend:
 * net_paid = applied − wht + expense (applied ติดลบได้เมื่อมี credit note)
 * ยอดจริงที่บันทึกแล้วใช้ค่าจาก response
 */
export function paymentSummary(input: {
  /** ยอดจ่ายต่อบรรทัด (มีเครื่องหมาย: credit note ติดลบ) */
  readonly allocations: readonly DecimalString[];
  readonly wht: readonly DecimalString[];
  readonly expenses: readonly DecimalString[];
}) {
  const applied = addDecimal([...input.allocations]);
  const wht = addDecimal([...input.wht]);
  const expenses = addDecimal([...input.expenses]);
  const net = addDecimal([subtractDecimal(applied, wht), expenses]);
  return { applied, wht, expenses, net };
}
