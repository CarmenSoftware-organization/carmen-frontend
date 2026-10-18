import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { ChevronRight } from "lucide-react";
import { SettingSection } from "@/components/ui/setting-section";
import { Skeleton } from "@/components/ui/skeleton";
import { useCuisineRecipes } from "./use-cuisine-recipes";

interface CuisineRecipesProps {
  readonly cuisineId: string;
}

/**
 * สูตรที่ใช้ cuisine นี้อยู่ — ตอบคำถาม "แก้/ปิดตัวนี้แล้วกระทบอะไร" ก่อนกด
 *
 * แสดงหน้าแรกของรายการ (`CUISINE_RECIPES_PREVIEW` ตัว) ส่วนที่เหลือบอกเป็นจำนวน
 * ลิงก์ไปหน้า cook ของสูตร (`/operation-plan/recipe/:id`)
 */
export function CuisineRecipes({ cuisineId }: CuisineRecipesProps) {
  const t = useTranslations("operationPlan.cuisine");
  const { data, isLoading, isError } = useCuisineRecipes(cuisineId);

  const recipes = data?.data ?? [];
  const total = data?.paginate?.total ?? 0;
  const rest = total - recipes.length;

  return (
    <SettingSection
      plain
      title={t("recipes")}
      description={t("recipesDesc")}
      count={isLoading || isError ? undefined : total}
    >
      {isLoading && (
        <div className="space-y-2">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-2/3" />
        </div>
      )}

      {isError && (
        <p className="text-muted-foreground text-xs">{t("recipesError")}</p>
      )}

      {!isLoading && !isError && total === 0 && (
        <p className="text-muted-foreground text-xs">{t("recipesEmpty")}</p>
      )}

      {recipes.length > 0 && (
        <ul className="divide-border border-border divide-y rounded-md border">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link
                to={`/operation-plan/recipe/${recipe.id}`}
                className="hover:bg-muted/60 focus-visible:ring-ring group flex items-center gap-3 px-3 py-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-inset"
              >
                <span className="text-muted-foreground w-20 shrink-0 truncate font-mono tabular-nums">
                  {recipe.code}
                </span>
                <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                  {recipe.name}
                </span>
                {recipe.category?.name && (
                  <span className="text-muted-foreground hidden max-w-40 truncate sm:inline">
                    {recipe.category.name}
                  </span>
                )}
                <ChevronRight
                  aria-hidden="true"
                  className="text-muted-foreground size-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      {rest > 0 && (
        <p className="text-muted-foreground mt-2 text-xs">
          {t("recipesMore", { count: rest })}
        </p>
      )}
    </SettingSection>
  );
}
