export type InventoryPeriodStatus = "open" | "closed" | "locked";

export interface InventoryPeriod {
  id: string;
  doc_version?: number;
  period: string;
  fiscal_year: number;
  fiscal_month: number;
  start_at: string;
  end_at: string;
  status: InventoryPeriodStatus;
}

export interface GenerateNextInventoryPeriodDto {
  count: number;
  start_day: number;
}
