import type { ApPaymentInput } from "@/types/accounts-payable-mock";
import {
  addDecimal,
  compareDecimal,
  divideDecimal,
  multiplyDecimal,
  subtractDecimal,
} from "./ap-decimal";

export function paymentSummary(form: ApPaymentInput) {
  const applied = addDecimal(
    form.applications.map((item) => item.apply_amount),
  );
  const base = addDecimal(
    form.applications.map((item) =>
      multiplyDecimal(
        item.apply_amount,
        item.original_rate ?? form.exchange_rate,
      ),
    ),
  );
  const paymentBase = multiplyDecimal(applied, form.exchange_rate);
  const fx = subtractDecimal(base, paymentBase);
  const wht = addDecimal((form.wht_services ?? form.applications).map((item) => item.wht_amount));
  const whtBase = multiplyDecimal(wht, form.exchange_rate);
  const expenses = addDecimal(
    (form.other_expenses ?? []).map((item) => item.base_amount),
  );
  const depositOffsetTotal = addDecimal(
    (form.deposit_offsets ?? []).map((item) => item.offset_amount),
  );
  const depositOffsetBase = multiplyDecimal(depositOffsetTotal, form.exchange_rate);
  const netBase = subtractDecimal(
    addDecimal([subtractDecimal(paymentBase, whtBase), expenses]),
    depositOffsetBase,
  );
  const vatClaim = addDecimal(
    (form.tax_allocations ?? []).map((item) => item.claim_amount),
  );
  const journal = [
    ...(compareDecimal(vatClaim, "0") > 0
      ? [
          {
            id: "input-vat",
            account: "Input VAT",
            description: "Received tax invoice allocation",
            debit: vatClaim,
            credit: "0.00",
          },
          {
            id: "undue-vat",
            account: "Undue input VAT",
            description: "Reclassify pending input VAT",
            debit: "0.00",
            credit: vatClaim,
          },
        ]
      : []),
    {
      id: "ap",
      account: "Accounts payable",
      description: "Clear supplier liability",
      debit: base,
      credit: "0.00",
    },
    ...(form.other_expenses ?? []).map((item) => ({
      id: item.id,
      account: item.account,
      description: item.description,
      debit: item.base_amount,
      credit: "0.00",
    })),
    ...(compareDecimal(depositOffsetBase, "0") > 0
      ? [
          {
            id: "deposit-offset",
            account: "1150 - Advance payments to suppliers",
            description: "Apply advance deposit offset",
            debit: "0.00",
            credit: depositOffsetBase,
          },
        ]
      : []),
    {
      id: "wht",
      account: "WHT payable",
      description: "Tax withheld",
      debit: "0.00",
      credit: whtBase,
    },
    {
      id: "bank",
      account: "Bank / Clearing",
      description: "Net disbursement",
      debit: "0.00",
      credit: netBase,
    },
    {
      id: "fx",
      account: "Realized FX",
      description: "Exchange gain / loss",
      debit: compareDecimal(fx, "0") < 0 ? subtractDecimal("0", fx) : "0.00",
      credit: compareDecimal(fx, "0") > 0 ? fx : "0.00",
    },
  ];
  return {
    applied,
    base,
    payment_base: paymentBase,
    fx,
    wht,
    wht_base: whtBase,
    expenses,
    deposit_offset_total: depositOffsetTotal,
    deposit_offset_base: depositOffsetBase,
    net_base: netBase,
    net_cash: divideDecimal(
      netBase,
      compareDecimal(form.exchange_rate || "0", "0") > 0
        ? form.exchange_rate
        : "1",
    ),
    journal,
    journal_total: addDecimal(journal.map((item) => item.debit)),
  };
}
