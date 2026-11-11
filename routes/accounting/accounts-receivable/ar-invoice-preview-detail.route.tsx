import { useParams, useSearchParams } from "react-router";
import ArInvoiceDetail from "./ar-invoice-detail";

export function Component() {
  const { id } = useParams();
  const [params] = useSearchParams();
  return (
    <ArInvoiceDetail
      key={`${id}:${params.get("copy") ?? ""}:${params.get("type") ?? ""}`}
    />
  );
}
