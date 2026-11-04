import { useState } from "react";
import { AccountingDashboardPage } from "../dashboard/accounting-dashboard-page";
import { buildApDashboardSnapshot } from "../dashboard/dashboard-mock-data";

const isoToday = () => new Date().toISOString().slice(0, 10);

/** AP dashboard ยังเป็น mock (ไม่มี API aging/dashboard) — ใช้ข้อมูลตัวอย่างของ dashboard ตรง ๆ */
export default function ApDashboard() {
  const [asOf, setAsOf] = useState(isoToday);
  return (
    <AccountingDashboardPage
      mock
      snapshot={buildApDashboardSnapshot()}
      asOf={asOf}
      onAsOfChange={setAsOf}
      isLoading={false}
      error={null}
      onRefresh={() => undefined}
    />
  );
}
