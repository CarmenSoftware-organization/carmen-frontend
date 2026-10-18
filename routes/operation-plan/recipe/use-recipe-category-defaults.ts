import { useEffect, useRef } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { useRecipeCategoryById } from "@/hooks/use-recipe-category";
import {
  readRecipeCategoryDefaults,
  type RecipeCategoryDefaults,
} from "../shared/recipe-category-defaults";
import type { RecipeFormValues } from "./recipe-form-schema";

/**
 * ค่าตั้งต้นต้นทุน/กำไรของหมวดที่เลือกอยู่ + เติมเป้า food cost ให้เมื่อเปลี่ยนหมวด
 *
 * เติมเฉพาะ target_food_cost_percentage — ช่องเดียวที่ความหมายตรงกับหมวดแบบ 1:1
 * ค่าแรง/โสหุ้ยของสูตรเป็นจำนวนเงิน (% คำนวณย้อนจากราคาขาย) ส่วนกำไรไม่มีช่องให้กรอก
 * ทั้งสองอย่างจึงใช้แค่แสดงเทียบในใบคิดต้นทุน ไม่เขียนลงฟอร์ม
 *
 * เติมเมื่อ (1) ผู้ใช้เปลี่ยนหมวดเอง — หมวดตอนเปิดฟอร์มไม่นับ สูตรเดิมจึงไม่ถูกแก้เงียบ ๆ
 * และ (2) ช่องเป้ายังว่าง — ไม่ทับค่าที่ผู้ใช้กรอกไว้แล้ว
 */
export function useRecipeCategoryDefaults(
  form: UseFormReturn<RecipeFormValues>,
  isDisabled: boolean,
): RecipeCategoryDefaults | null {
  const categoryId = useWatch({ control: form.control, name: "category_id" });
  const { data: category } = useRecipeCategoryById(categoryId || undefined);
  // ระหว่างโหลดหมวดใหม่ query อาจยังถือหมวดเก่า — อย่าเอาค่าของหมวดเก่ามาใช้
  const defaults =
    category && category.id === categoryId
      ? readRecipeCategoryDefaults(category)
      : null;
  const foodCost = defaults?.foodCost ?? null;

  const appliedFor = useRef(form.getValues("category_id"));
  useEffect(() => {
    if (!categoryId || foodCost == null || appliedFor.current === categoryId)
      return;
    appliedFor.current = categoryId;
    if (isDisabled) return;
    if ((Number(form.getValues("target_food_cost_percentage")) || 0) > 0)
      return;
    form.setValue("target_food_cost_percentage", foodCost, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }, [categoryId, foodCost, isDisabled, form]);

  return defaults;
}
