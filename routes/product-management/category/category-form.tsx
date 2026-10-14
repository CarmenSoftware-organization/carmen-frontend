import { useState } from "react";
import { useForm, Controller, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Percent } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusSwitch } from "@/components/ui/status-switch";
import {
  Field,
  FieldError,
  FieldInput,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { LookupTaxProfile } from "@/components/lookup/lookup-tax-profile";
import { LookupChartOfAccount } from "@/components/lookup/lookup-chart-of-account";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import {
  NODE_TYPE,
  type CategoryNode,
  type CategoryType,
} from "@/types/category";
import type { FormMode } from "@/types/form";
import {
  createCategorySchema,
  stripAutoCode,
  type CategoryFormValues,
} from "./category-form-schema";

interface CategoryFormProps {
  readonly type: CategoryType;
  readonly mode: FormMode;
  readonly selectedNode?: CategoryNode;
  readonly parentNode?: CategoryNode;
  /** บรรพบุรุษเรียงจากใกล้สุด (พ่อ → ปู่) ใช้หา placeholder ค่าที่สืบทอด */
  readonly ancestors?: CategoryNode[];
  /** โหลด account_codes ของ node นี้ไม่สำเร็จ → ปิดช่องบัญชี */
  readonly accountCodesUnavailable?: boolean;
  readonly onSubmit: (data: CategoryFormValues) => void;
  readonly onCancel: () => void;
  readonly isPending?: boolean;
}

export function CategoryForm({
  type,
  mode,
  selectedNode,
  parentNode,
  ancestors = [],
  accountCodesUnavailable,
  onSubmit,
  onCancel,
  isPending,
}: CategoryFormProps) {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");
  const tv = useTranslations("validation");
  const tf = useTranslations("form");
  const tp = useTranslations("productManagement.product");

  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingData, setPendingData] = useState<CategoryFormValues | null>(
    null,
  );

  const parentDisplay =
    type === "category"
      ? ""
      : parentNode
        ? `${parentNode.code} - ${parentNode.name}`
        : "";

  const defaultValues = ((): CategoryFormValues => {
    const base: CategoryFormValues = {
      code: selectedNode?.code ?? "",
      name: selectedNode?.name ?? "",
      description: selectedNode?.description ?? "",
      is_active: selectedNode?.is_active ?? true,
      cascade_deviation: selectedNode?.cascade_deviation ?? true,
      price_deviation_limit:
        selectedNode?.price_deviation_limit ??
        parentNode?.price_deviation_limit ??
        0,
      qty_deviation_limit:
        selectedNode?.qty_deviation_limit ??
        parentNode?.qty_deviation_limit ??
        0,
      is_used_in_recipe:
        selectedNode?.is_used_in_recipe ??
        parentNode?.is_used_in_recipe ??
        false,
      is_sold_directly:
        selectedNode?.is_sold_directly ?? parentNode?.is_sold_directly ?? false,
      tax_profile_id:
        selectedNode?.tax_profile_id ?? parentNode?.tax_profile_id ?? "",
      tax_rate: selectedNode?.tax_rate ?? parentNode?.tax_rate ?? 0,
      // ค่าของ node นี้เอง (ไม่เติมจากชั้นบน — ค่าว่าง = สืบทอด แสดงเป็น placeholder)
      inventory_account_code:
        selectedNode?.account_codes?.find((a) => a.account_type === "inventory")
          ?.account_code ?? null,
      direct_account_code:
        selectedNode?.account_codes?.find((a) => a.account_type === "direct")
          ?.account_code ?? null,
    };
    if (type === "subcategory")
      base.product_category_id =
        selectedNode?.product_category_id ?? parentNode?.id ?? "";
    if (type === "itemgroup")
      base.product_subcategory_id =
        selectedNode?.product_subcategory_id ?? parentNode?.id ?? "";
    return base;
  })();

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(
      createCategorySchema(tv, tfl),
    ) as Resolver<CategoryFormValues>,
    defaultValues,
  });

  // หมายเหตุ: ไม่มี useEffect(form.reset(defaultValues)) โดยเจตนา — CategoryForm ถูก
  // mount ใหม่ทุกครั้งที่ dialog เปิด ({open && <CategoryForm/>}) ดังนั้น defaultValues
  // ของ useForm ตั้งค่าถูกต้องอยู่แล้ว ส่วน effect แบบเดิม (deps มี defaultValues ซึ่ง
  // เป็น object ใหม่ทุก render) จะ reset ฟอร์มหลัง re-render ทุกครั้ง ลบ input และ
  // error ที่ผู้ใช้เพิ่งกรอก/เพิ่งเห็นทิ้ง

  const handleFormSubmit = (data: CategoryFormValues) => {
    const payload = stripAutoCode(mode, data);
    if (
      mode === "edit" &&
      selectedNode &&
      (selectedNode.is_used_in_recipe !== data.is_used_in_recipe ||
        selectedNode.is_sold_directly !== data.is_sold_directly)
    ) {
      setPendingData(payload);
      setShowConfirm(true);
      return;
    }
    onSubmit(payload);
  };

  const LEVEL_LABELS: Record<CategoryNode["type"], string> = {
    [NODE_TYPE.CATEGORY]: t("nodeCategory"),
    [NODE_TYPE.SUBCATEGORY]: t("nodeSubcategory"),
    [NODE_TYPE.ITEM_GROUP]: t("nodeItemGroup"),
  };
  /** เดินขึ้นจากพ่อ → ปู่ หาบัญชีชนิดนี้ตัวแรกที่ตั้งไว้ */
  const inheritedPlaceholder = (
    accountType: "inventory" | "direct",
  ): string | undefined => {
    for (const node of ancestors) {
      const hit = node.account_codes?.find(
        (a) => a.account_type === accountType,
      );
      if (hit)
        return t("inheritedFrom", {
          level: LEVEL_LABELS[node.type],
          code: hit.account_code,
        });
    }
    return undefined;
  };
  const accountDisabled = isPending || accountCodesUnavailable;

  const PARENT_LABELS: Record<CategoryType, string> = {
    category: "",
    subcategory: tfl("category"),
    itemgroup: tfl("subCategory"),
  };
  const parentLabel = PARENT_LABELS[type];

  return (
    <>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit, () =>
          scrollToFirstInvalidField(),
        )}
        className="space-y-3"
      >
        {/* Parent reference */}
        {type !== "category" && (
          <Field>
            <FieldLabel>{parentLabel}</FieldLabel>
            <Input
              value={parentDisplay}
              disabled
              className="bg-muted/50 text-xs"
            />
          </Field>
        )}

        {/* Code + Name + Tax Profile row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[6.25rem_1fr]">
          <Field>
            <FieldLabel htmlFor="code">{tfl("code")}</FieldLabel>
            <FieldInput
              id="code"
              className="text-xs"
              maxLength={10}
              disabled
              placeholder={mode === "add" ? tfl("autoGenerated") : undefined}
              error={form.formState.errors.code?.message}
              {...form.register("code")}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="name" required>
              {tfl("name")}
            </FieldLabel>
            <FieldInput
              id="name"
              className="text-xs"
              maxLength={100}
              disabled={isPending}
              error={form.formState.errors.name?.message}
              {...form.register("name")}
            />
          </Field>
        </div>
        <Field>
          <FieldLabel required>{tfl("taxProfile")}</FieldLabel>
          <Controller
            control={form.control}
            name="tax_profile_id"
            render={({ field }) => (
              <LookupTaxProfile
                value={field.value ?? ""}
                onValueChange={(id, taxRate) => {
                  field.onChange(id);
                  form.setValue("tax_rate", taxRate);
                }}
                disabled={isPending}
                className="w-full"
                error={form.formState.errors.tax_profile_id?.message}
              />
            )}
          />
          {form.formState.errors.tax_profile_id?.message && (
            <FieldError>
              {form.formState.errors.tax_profile_id.message}
            </FieldError>
          )}
        </Field>

        {/* Inventory / Direct account — ว่าง = สืบทอดจากชั้นบน */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field>
            <FieldLabel>{t("inventoryAccount")}</FieldLabel>
            <Controller
              control={form.control}
              name="inventory_account_code"
              render={({ field }) => (
                <LookupChartOfAccount
                  value={field.value ?? ""}
                  onValueChange={(code) => field.onChange(code || null)}
                  placeholder={inheritedPlaceholder("inventory")}
                  disabled={accountDisabled}
                  className="w-full"
                />
              )}
            />
          </Field>
          <Field>
            <FieldLabel>{t("directAccount")}</FieldLabel>
            <Controller
              control={form.control}
              name="direct_account_code"
              render={({ field }) => (
                <LookupChartOfAccount
                  value={field.value ?? ""}
                  onValueChange={(code) => field.onChange(code || null)}
                  placeholder={inheritedPlaceholder("direct")}
                  disabled={accountDisabled}
                  className="w-full"
                />
              )}
            />
          </Field>
        </div>

        {/* Deviation limits */}
        <div className="grid grid-cols-2 gap-3">
          <Field data-invalid={!!form.formState.errors.qty_deviation_limit}>
            <FieldLabel htmlFor="qty_deviation_limit">
              {tfl("qtyDeviation")}
            </FieldLabel>
            <div className="relative">
              <FieldInput
                id="qty_deviation_limit"
                type="number"
                inputMode="decimal"
                className="pr-6 text-right text-xs tabular-nums"
                min={0}
                max={100}
                disabled={isPending}
                error={form.formState.errors.qty_deviation_limit?.message}
                errorIconAlign="left"
                {...form.register("qty_deviation_limit", {
                  valueAsNumber: true,
                })}
              />
              <Percent className="text-muted-foreground/50 absolute top-1/2 right-1.5 h-2.5 w-2.5 -translate-y-1/2" />
            </div>
          </Field>
          <Field data-invalid={!!form.formState.errors.price_deviation_limit}>
            <FieldLabel htmlFor="price_deviation_limit">
              {tfl("priceDeviation")}
            </FieldLabel>
            <div className="relative">
              <FieldInput
                id="price_deviation_limit"
                type="number"
                inputMode="decimal"
                className="pr-6 text-right text-xs tabular-nums"
                min={0}
                max={100}
                disabled={isPending}
                error={form.formState.errors.price_deviation_limit?.message}
                errorIconAlign="left"
                {...form.register("price_deviation_limit", {
                  valueAsNumber: true,
                })}
              />
              <Percent className="text-muted-foreground/50 absolute top-1/2 right-1.5 h-2.5 w-2.5 -translate-y-1/2" />
            </div>
          </Field>
        </div>

        {/* Flags — 2-col grid to reduce vertical space */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Controller
            control={form.control}
            name="is_used_in_recipe"
            render={({ field }) => (
              <StatusSwitch
                id="is_used_in_recipe"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
                label={tp("usedInRecipe")}
                activeText={tp("usedInRecipe")}
                inactiveText={tp("notUsedInRecipe")}
                inactiveTone="neutral"
                description={tp("usedInRecipeDesc")}
              />
            )}
          />
          <Controller
            control={form.control}
            name="is_sold_directly"
            render={({ field }) => (
              <StatusSwitch
                id="is_sold_directly"
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={isPending}
                label={tp("soldDirectly")}
                activeText={tp("soldDirectly")}
                inactiveText={tp("notSoldDirectly")}
                inactiveTone="neutral"
                description={tp("soldDirectlyDesc")}
              />
            )}
          />
        </div>

        <Controller
          control={form.control}
          name="is_active"
          render={({ field }) => (
            <StatusSwitch
              id="is_active"
              checked={field.value}
              onCheckedChange={field.onChange}
              disabled={isPending}
            />
          )}
        />

        {/* Description */}
        <Field>
          <FieldLabel htmlFor="description">{tfl("description")}</FieldLabel>
          <Textarea
            id="description"
            className="resize-none text-xs"
            rows={2}
            maxLength={256}
            disabled={isPending}
            {...form.register("description")}
          />
        </Field>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isPending}
          >
            {tc("cancel")}
          </Button>
          <Button type="submit" size="sm" disabled={isPending}>
            {isPending && (mode === "edit" ? tf("saving") : tf("creating"))}
            {!isPending && mode === "edit" && tc("save")}
            {!isPending && mode !== "edit" && tc("create")}
          </Button>
        </div>
      </form>

      <DeleteDialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (!open) {
            setShowConfirm(false);
            setPendingData(null);
          }
        }}
        title={t("confirmChanges")}
        description={t("confirmFlagsChange")}
        onConfirm={() => {
          if (pendingData) {
            onSubmit(pendingData);
            setShowConfirm(false);
            setPendingData(null);
          }
        }}
      />
    </>
  );
}
