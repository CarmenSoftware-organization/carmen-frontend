import { AccountingDashboardPage } from "../dashboard/accounting-dashboard-page";
import { getAccountingDashboardSnapshot } from "../dashboard/dashboard-mock-data";

export function Component() {
  return (
    <AccountingDashboardPage
      mock
      snapshot={getAccountingDashboardSnapshot("accountsReceivable")}
    />
  );
}
