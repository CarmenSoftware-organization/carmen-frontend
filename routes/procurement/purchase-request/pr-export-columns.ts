import type { XlsxColumn } from "@/hooks/use-xlsx-export";
import { isPriceHidden } from "@/types/workflows";
import { formatDate } from "@/lib/date-utils";
import type { PurchaseRequest } from "@/types/purchase-request";

type TFn = (key: string) => string;

interface PrExportColumnsArgs {
  tfl: TFn;
  defaultCurrencyCode: string;
  dateTimeFormat: string;
}

export function buildPrExportColumns({
  tfl,
  defaultCurrencyCode,
  dateTimeFormat,
}: PrExportColumnsArgs): XlsxColumn<PurchaseRequest>[] {
  return [
    { header: tfl("prNo"), value: (r) => r.pr_no, width: 18 },
    { header: tfl("date"), value: (r) => r.pr_date, width: 12 },
    { header: tfl("type"), value: (r) => r.workflow_name, width: 16 },
    {
      header: tfl("stage"),
      value: (r) => r.workflow_current_stage,
      width: 18,
    },
    { header: tfl("status"), value: (r) => r.pr_status, width: 14 },
    {
      header: tfl("requester"),
      value: (r) => r.requestor_name,
      width: 22,
    },
    {
      header: tfl("department"),
      value: (r) => r.department_name,
      width: 24,
    },
    {
      header: tfl("totalAmount"),
      value: (r) =>
        isPriceHidden(r.hidden_fields, "total_price")
          ? ""
          : r.base_total_amount,
      width: 16,
    },
    {
      header: tfl("currency"),
      value: () => defaultCurrencyCode,
      width: 8,
    },
    {
      header: tfl("description"),
      value: (r) => r.description ?? "",
      width: 40,
    },
    {
      header: tfl("created"),
      value: (r) =>
        r.audit?.created?.at
          ? formatDate(r.audit.created.at, dateTimeFormat)
          : "",
      width: 18,
    },
    {
      header: tfl("updated"),
      value: (r) =>
        r.audit?.updated?.at
          ? formatDate(r.audit.updated.at, dateTimeFormat)
          : "",
      width: 18,
    },
  ];
}
