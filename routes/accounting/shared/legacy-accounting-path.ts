/**
 * URL เดิมก่อนแยกบัญชีเป็นสี่โมดูลบนสุด (`/accounting/...`) → path ใหม่
 * คง search ไว้ให้บุ๊กมาร์กที่มีตัวกรองยังใช้ได้ — ใช้ใน route `accounting/*` ของ router
 */
const MOVED_PREFIXES: ReadonlyArray<readonly [from: string, to: string]> = [
  ["/accounts-payable", "/accounts-payable"],
  ["/accounts-receivable", "/accounts-receivable"],
  ["/asset", "/asset"],
  // redirect เก่าที่เคยอยู่ใต้ GL ก่อนย้ายไป AR
  ["/cheque-reconciliation", "/accounts-receivable/cheque-reconciliation"],
  ["/output-tax", "/accounts-receivable/output-tax"],
];

export function legacyAccountingPath(pathname: string, search: string): string {
  const rest = pathname.replace(/^\/accounting(?=\/|$)/, "").replace(/\/$/, "");
  for (const [from, to] of MOVED_PREFIXES) {
    if (rest === from || rest.startsWith(from + "/")) {
      return to + rest.slice(from.length) + search;
    }
  }
  return "/general-ledger" + rest + search;
}
