import { RecipeEditContent } from "./recipe-edit-content";

// ชั่วคราว — Task 5 แทนด้วยโหมดทำอาหาร
export function RecipeCookContent({ id }: { id: string }) {
  return <RecipeEditContent id={id} />;
}
