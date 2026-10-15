import { useState } from "react";
import { AccountingDashboardPage } from "../dashboard/accounting-dashboard-page";
import { buildApDashboardSnapshot } from "../dashboard/dashboard-mock-data";
import { useApDashboard } from "./shared/use-accounts-payable";

const isoToday = () => new Date().toISOString().slice(0, 10);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;

export default function ApDashboard() {
  const [asOf, setAsOf] = useState(isoToday);
  const query = useApDashboard(asOf, monthStart(asOf), asOf);
  return (
    <AccountingDashboardPage
      mock
      snapshot={buildApDashboardSnapshot(query.data)}
      asOf={asOf}
      onAsOfChange={setAsOf}
      isLoading={query.isLoading}
      error={query.error}
      onRefresh={() => void query.refetch()}
    />
  );
}
