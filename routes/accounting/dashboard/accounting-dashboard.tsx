import { useLocation } from "react-router";
import { findAccountingSection } from "@/constant/module-list";
import type { AccountingDashboardModule } from "@/types/accounting-dashboard";
import { AccountingDashboardPage } from "./accounting-dashboard-page";
import { getAccountingDashboardSnapshot } from "./dashboard-mock-data";

export default function AccountingDashboard() {
  const section = findAccountingSection(useLocation().pathname)
    .name as AccountingDashboardModule;
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
