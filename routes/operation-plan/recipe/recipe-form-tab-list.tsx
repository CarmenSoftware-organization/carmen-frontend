import { useEffect } from "react";
import { useFormState, useWatch, type Control } from "react-hook-form";
import { useTranslations } from "use-intl";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { RecipeFormValues } from "./recipe-form-schema";
import {
  RECIPE_TABS,
  tabOfField,
  tabsWithErrors,
  type RecipeTab,
} from "./recipe-form-tabs";

const TAB_LABEL = {
  details: "recipeDetails",
  ingredients: "ingredients",
  steps: "stepsSection",
  cost: "costing",
} as const satisfies Record<RecipeTab, string>;

interface RecipeFormTabListProps {
  readonly control: Control<RecipeFormValues>;
  /** สูตรใหม่ยังเพิ่มวัตถุดิบ/ขั้นตอนไม่ได้ — ไม่แสดงตัวนับ */
  readonly isNew: boolean;
  /** error จาก server ผูกกับช่องในแท็บอื่น → ขอให้เปิดแท็บนั้น */
  readonly onOpenTab: (tab: RecipeTab) => void;
}

/**
 * แถบแท็บของฟอร์มสูตร — ชื่อแท็บ + จำนวนวัตถุดิบ/ขั้นตอน + จุดแดงบนแท็บที่มีช่องกรอกผิด
 *
 * แยกเป็น component ของตัวเองเพราะ subscribe error ของทั้งฟอร์ม (`useFormState`) — ถ้าอ่านใน
 * `RecipeForm` ทุก section จะ render ใหม่ทุกครั้งที่ error ของช่องใดช่องหนึ่งเปลี่ยน
 */
export function RecipeFormTabList({
  control,
  isNew,
  onOpenTab,
}: RecipeFormTabListProps) {
  const t = useTranslations("operationPlan.recipe");
  const { errors } = useFormState({ control });
  const ingredientCount =
    useWatch({ control, name: "ingredients" })?.length ?? 0;
  const stepCount =
    useWatch({ control, name: "preparation_steps" })?.length ?? 0;
  const count: Partial<Record<RecipeTab, number>> = isNew
    ? {}
    : { ingredients: ingredientCount, steps: stepCount };
  const invalid = tabsWithErrors(errors);

  // error ที่ server ตอบกลับมาหลัง Save (เช่นรหัสซ้ำ) ไม่ผ่าน onInvalid ของ handleSubmit —
  // เปิดแท็บของช่องนั้นให้เอง ไม่งั้นผู้ใช้ที่อยู่แท็บอื่นเห็นแค่ toast
  const serverErrorTab = Object.entries(errors)
    .filter(([, e]) => (e as { type?: string } | undefined)?.type === "server")
    .map(([key]) => tabOfField(key))
    .find((tab): tab is RecipeTab => tab !== null);
  useEffect(() => {
    if (serverErrorTab) onOpenTab(serverErrorTab);
    // onOpenTab เป็น setState ของฟอร์ม — เปิดเฉพาะตอน error ของ server โผล่มา ไม่ใช่ทุก render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverErrorTab]);

  return (
    // แถบแท็บเลื่อนแนวนอนได้เองบนจอแคบ — ป้ายไม่ตัดและไม่ทับกัน
    <div className="overflow-x-auto border-b">
      <TabsList variant="line" className="gap-2">
        {RECIPE_TABS.map((tab) => (
          <TabsTrigger key={tab} value={tab} className="flex-none px-3 text-sm">
            {t(TAB_LABEL[tab])}
            {count[tab] !== undefined && (
              <span className="text-muted-foreground text-xs font-semibold tabular-nums">
                {count[tab]}
              </span>
            )}
            {invalid.has(tab) && (
              <>
                <span
                  className="bg-destructive size-1.5 rounded-full"
                  aria-hidden="true"
                />
                <span className="sr-only">{t("tabHasErrors")}</span>
              </>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
    </div>
  );
}
