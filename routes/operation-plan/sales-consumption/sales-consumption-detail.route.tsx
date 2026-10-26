import { useParams } from "react-router";
import { ScDetailPage } from "./sc-detail-page";

export function Component() {
  const { id } = useParams<{ id: string }>();
  return <ScDetailPage id={id ?? ""} />;
}
