import { useId, useState } from "react";
import { Link } from "react-router";
import { useTranslations } from "use-intl";
import { RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { RecipeIngredientLine } from "@/types/recipe";
import { decimalsFor, formatQtyFixed } from "./recipe-ingredients-cost";

/**
 * รายการวัตถุดิบแบบเช็กลิสต์ของหน้าดูสูตร — ติ๊กตอนหยิบของ แถบความคืบหน้าบอกว่าหยิบไปแล้วเท่าไร
 * ติ๊กเก็บแค่ในหน้านี้ รีเฟรชแล้วเริ่มใหม่ (ครัวเช็กของต่อรอบที่ทำ)
 *
 * ทั้งแถวเป็นที่แตะ (สูง ≥ 48px) · ชื่อซ้าย จำนวนชิดขวาตัวเข้ม · ชื่อยาวขึ้นบรรทัดใหม่ จำนวนไม่ตกลงไปใต้ชื่อ
 * (คอลัมน์วัตถุดิบของ iPad แนวตั้งแคบแค่ 15–17rem)
 */
export function RecipeCookIngredients({
  lines,
  subRecipePath,
}: {
  readonly lines: readonly RecipeIngredientLine[];
  /** ลิงก์ไปหน้าดูสูตรฐาน = `${subRecipePath}/${id}` */
  readonly subRecipePath: string;
}) {
  const t = useTranslations("operationPlan.recipe");
  const headingId = useId();
  // ทศนิยมของจำนวนวัตถุดิบเท่ากันทุกแถว = ของแถวที่ละเอียดที่สุด
  const qtyDecimals = decimalsFor(lines.map((l) => l.qty));
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set());
  const toggle = (id: string, on: boolean) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const checkedCount = lines.filter((l) => checked.has(l.id)).length;
  const total = lines.length;

  return (
    <section aria-labelledby={headingId} className="min-w-0">
      <div className="mb-2 flex min-h-8 items-center justify-between gap-2">
        <h2
          id={headingId}
          className="text-foreground flex items-baseline gap-2 text-lg font-semibold"
        >
          {t("cookIngredients")}
          <span className="text-muted-foreground text-sm font-normal tabular-nums">
            {total}
          </span>
        </h2>
        {checkedCount > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-muted-foreground text-xs tabular-nums">
              {t("cookChecked", { n: checkedCount, total })}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setChecked(new Set())}
            >
              <RotateCcw />
              {t("cookClearChecks")}
            </Button>
          </div>
        )}
      </div>
      <Progress
        value={total === 0 ? 0 : (checkedCount / total) * 100}
        variant="primary"
        aria-label={t("cookChecked", { n: checkedCount, total })}
        className="mb-3 h-1.5"
      />
      <ul className="bg-card divide-border/70 divide-y overflow-hidden rounded-xl border">
        {lines.map((line) => {
          const id = `cook-ingredient-${line.id}`;
          const isChecked = checked.has(line.id);
          const isRecipe = line.ingredient_type === "recipe";
          const name =
            line.sub_recipe?.name ??
            line.product?.name ??
            line.product?.code ??
            "—";
          return (
            <li key={line.id}>
              {/* checkbox กับลิงก์แยกกัน — ลิงก์ไปสูตรฐานต้องไม่ติ๊ก/ไม่ถูกติ๊กแทน */}
              <div
                className={cn(
                  "relative grid min-h-12 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-3 py-2.5 transition-colors",
                  isChecked ? "bg-primary/5" : "hover:bg-muted/60",
                )}
              >
                {/* label ขยายเต็มแถว — แตะตรงไหนก็ติ๊กได้ (ลิงก์ z-10 อยู่เหนือ) */}
                <label
                  htmlFor={id}
                  aria-hidden="true"
                  className="absolute inset-0 cursor-pointer"
                />
                <Checkbox
                  id={id}
                  aria-label={name}
                  checked={isChecked}
                  onCheckedChange={(v) => toggle(line.id, v === true)}
                  className="relative z-10 mt-0.5 size-5"
                />
                <div
                  className={cn(
                    "min-w-0 text-base",
                    isChecked && "text-muted-foreground line-through",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium break-words",
                      !isChecked && "text-foreground",
                    )}
                  >
                    {isRecipe && line.sub_recipe_id ? (
                      <>
                        <Badge
                          variant="info-light"
                          size="xs"
                          className="mr-1.5"
                        >
                          {t("subRecipeBadge")}
                        </Badge>
                        <Link
                          to={`${subRecipePath}/${line.sub_recipe_id}`}
                          className="relative z-10 underline underline-offset-2"
                        >
                          {name}
                        </Link>
                      </>
                    ) : (
                      name
                    )}
                  </span>
                  {line.note && (
                    <span className="text-muted-foreground mt-0.5 block text-sm">
                      {line.note}
                    </span>
                  )}
                </div>
                <span
                  className={cn(
                    "text-right text-base whitespace-nowrap tabular-nums",
                    isChecked
                      ? "text-muted-foreground line-through"
                      : "text-foreground font-semibold",
                  )}
                >
                  {formatQtyFixed(line.qty, qtyDecimals)}{" "}
                  <span className="text-muted-foreground text-sm font-normal">
                    {line.ingredient_unit?.name ?? ""}
                  </span>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
