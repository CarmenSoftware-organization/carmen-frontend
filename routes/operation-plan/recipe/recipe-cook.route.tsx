import { useParams } from "react-router";
import { RecipeCookContent } from "./recipe-cook-content";

export function Component() {
  const { id } = useParams<{ id: string }>();
  if (!id) return null;
  return <RecipeCookContent id={id} />;
}
