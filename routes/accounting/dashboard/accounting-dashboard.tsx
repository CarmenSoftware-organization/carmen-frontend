import { useLocation } from "react-router";
import { findActiveModule } from "@/constant/module-list";
import type { AccountingDashboardModule } from "@/types/accounting-dashboard";
import { AccountingDashboardPage } from "./accounting-dashboard-page";
import { getAccountingDashboardSnapshot } from "./dashboard-mock-data";

export default function AccountingDashboard() {
  const section = findActiveModule(useLocation().pathname)?.name as
    AccountingDashboardModule | undefined;
  const module =
    section === "accountsReceivable" || section === "asset"
      ? section
      : "generalLedger";
  return (
    <AccountingDashboardPage
      mock
      snapshot={getAccountingDashboardSnapshot(module)}
    />
  );
}
