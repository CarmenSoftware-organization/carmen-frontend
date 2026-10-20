import { useState } from "react";
import { useForm, useWatch, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useNavigate } from "react-router";
import { useListReturn } from "@/hooks/use-list-return";
import { useTranslations } from "use-intl";
import { BackButton } from "@/components/share/back-button";
import { toast } from "sonner";
import { Boxes, ClipboardCheck, MapPin, Save, Sparkles, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DiscardDialog } from "@/components/ui/discard-dialog";
import { useDiscardConfirm } from "@/hooks/use-discard-confirm";
import { useNavigationGuard } from "@/hooks/use-navigation-guard";
import { scrollToFirstInvalidField } from "@/lib/form-helpers";
import { useCreateSpotCheck } from "./use-sc";
import type { ProductLocation } from "@/types/location";
import {
  CardLabel,
  GlassCard,
  InfoRow,
  MetaChip,
  StatusPill,
} from "@/components/share/glass-card";

import { ScGeneralFields } from "./sc-general-fields";
import { ScHeroStat } from "./sc-hero-stat";
import { getSubmitLabel } from "@/lib/form-utils";
import { getMethodConfig } from "./sc-method-config";
import { ScProductTransfer } from "./sc-product-transfer";
import {
  createSpotCheckSchema,
  getDefaultValues,
  mapFormToPayload,
  type SpotCheckFormValues,
} from "./sc-form-schema";
import { SC_LIST_PATHS } from "./sc-paths";

const FORM_ID = "sc-form";

interface ScFormProps {
  readonly defaultLocationId: string;
  readonly defaultLocationName?: string;
  readonly availableProducts?: ProductLocation[];
}

export function ScForm({
  defaultLocationId,
  defaultLocationName,
  availableProducts = [],
}: ScFormProps) {
  const t = useTranslations("inventoryManagement.spotCheck");
  const tt = useTranslations("toast");
  const tv = useTranslations("validation");
  const tfl = useTranslations("field");
  const tc = useTranslations("common");
  const tform = useTranslations("form");
  const navigate = useNavigate();
  const { toList, returnState } = useListReturn(SC_LIST_PATHS);
  const createSc = useCreateSpotCheck();
  const isPending = createSc.isPending;

  const defaultValues = {
    ...getDefaultValues(),
    location_id: defaultLocationId,
  };

  const spotCheckSchema = createSpotCheckSchema(tv, tfl);
  const form = useForm<SpotCheckFormValues>({
    resolver: zodResolver(spotCheckSchema) as Resolver<SpotCheckFormValues>,
    defaultValues,
  });

  // guard สองตัวต้องอ่าน dirty ค่าเดียวกัน ไม่งั้นปุ่ม Back ถามแต่เมนู sidebar เงียบ
  const isFormDirty = form.formState.isDirty;

  const discard = useDiscardConfirm({
    isDirty: isFormDirty,
    isPending,
  });

  // ระหว่าง submit ตอน create ปิด guard — ไม่งั้น sentinel ที่ guard ดันไว้ที่ /new
  // ค้างอยู่ใน history stack หลัง navigate ออกไป กด back แล้วเจอ /new ซ้ำ
  const [isSubmitting, setIsSubmitting] = useState(false);

  // useDiscardConfirm ดักได้แค่ปุ่มในฟอร์มเอง (Cancel/Back) — ลิงก์ข้างนอกอย่าง
  // เมนู sidebar ต้องใช้ตัวนี้ดัก ไม่งั้นกดแล้วหลุดออกไปพร้อมข้อมูลที่ยังไม่ได้เซฟ
  const navGuard = useNavigationGuard(isFormDirty && !isSubmitting);

  const method = useWatch({ control: form.control, name: "method" });
  const items = useWatch({ control: form.control, name: "items" });
  const minValue = useWatch({ control: form.control, name: "min_value" });
  const products = useWatch({ control: form.control, name: "products" });

  const manualCount = (products ?? []).filter(
    (p) => p.product_id !== "",
  ).length;
  const itemsCount = items ?? 0;
  const stats = {
    manualCount,
    itemsCount,
    currentCount: method === "manual" ? manualCount : itemsCount,
  };

  const methodConfig = getMethodConfig(method, t);
  const displayLocationName = defaultLocationName;

  const onSubmit = (values: SpotCheckFormValues) => {
    const payload = mapFormToPayload(values);

    // ปิด guard ก่อนยิง mutation → sentinel ถูก teardown ลบระหว่างรอ network
    setIsSubmitting(true);
    createSc.mutate(payload, {
      onError: () => setIsSubmitting(false),
      onSuccess: (res) => {
        toast.success(tt("createSuccess", { entity: t("entity") }));
        const newId = (res as { data?: { id?: string } } | undefined)?.data?.id;
        if (newId) {
          navigate(`/inventory-management/spot-check/${newId}`, returnState);
        } else {
          toList();
        }
      },
    });
  };

  const handleCancel = () => {
    discard.confirm(() => toList());
  };

  // Back = กลับหน้า list เสมอ ไม่ใช่ history back — history คือเส้นทางที่เดินผ่านมา
  // ไม่ใช่ที่ที่อยากกลับไป กดครั้งเดียวต้องถึง list ไม่ใช่ถอยทีละหน้า
  const goBack = () => toList();

  const handleBack = () => discard.confirm(goBack);

  const submitLabel = getSubmitLabel(isPending, true, tc, tform);

  return (
    <div className="relative isolate -mx-3 -my-3">
      <form
        id={FORM_ID}
        onSubmit={form.handleSubmit(onSubmit, () =>
          scrollToFirstInvalidField(),
        )}
        className="relative px-4 pt-4 pb-8 lg:p-4"
      >
        {/* Hero section */}
        <section className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <div>
            {/* Toolbar */}
            <div className="mb-3 flex flex-wrap items-center justify-between">
              <div className="flex items-center gap-2">
                <BackButton onClick={handleBack} />
                <span className="bg-primary/10 text-primary text-micro-legal inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold tracking-wider uppercase">
                  <ClipboardCheck className="size-2.5" />
                  {t("entity")}
                </span>
                <StatusPill statusConfig={methodConfig} large />
              </div>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  <X />
                  {tc("cancel")}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  form={FORM_ID}
                  disabled={isPending}
                >
                  <Save />
                  {submitLabel}
                </Button>
              </div>
            </div>

            {/* Title + descriptor */}
            <div className="text-muted-foreground text-micro-eyebrow mb-1 flex items-center gap-1.5 font-semibold tracking-[0.16em] uppercase">
              <span className="bg-muted-foreground size-0.5 rounded-sm" />
              {t("entity")}
              <span className="text-muted-foreground/60">·</span>
              <span className="text-muted-foreground text-micro-legal font-semibold tracking-normal normal-case">
                {methodConfig.hint}
              </span>
            </div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight md:text-[1.75rem]">
              {displayLocationName || t("namePlaceholder")}
            </h1>

            <p className="text-foreground/80 mt-2 max-w-xl text-xs leading-relaxed">
              {displayLocationName ? (
                <span className="text-foreground/80">
                  {t("descriptorFilled", {
                    location: displayLocationName,
                    count: stats.currentCount,
                  })}
                </span>
              ) : (
                <span className="text-muted-foreground italic">
                  {t("descriptorEmpty")}
                </span>
              )}
            </p>

            {/* Meta chips */}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <MetaChip
                icon={MapPin}
                label={displayLocationName || tfl("location")}
                empty={!displayLocationName}
              />
              <MetaChip icon={methodConfig.icon} label={methodConfig.label} />
              <MetaChip
                icon={Boxes}
                label={
                  stats.currentCount > 0
                    ? t("productsCount", { count: stats.currentCount })
                    : t("noProducts")
                }
                empty={!stats.currentCount}
              />
            </div>
          </div>

          {/* Hero stat card */}
          <ScHeroStat
            count={stats.currentCount}
            methodLabel={methodConfig.label}
            labels={{
              productsToCheck: t("productsToCheck"),
              method: tfl("method"),
              location: tfl("location"),
              productsLabel: t("productsLabel"),
              footer: t("heroFooter"),
            }}
            locationName={displayLocationName}
          />
        </section>

        {/* Body grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="flex flex-col gap-4">
            <ScGeneralFields
              form={form}
              disabled={isPending}
              isView={false}
              hideLocation
            />
            {method === "manual" && (
              <ScProductTransfer
                form={form}
                disabled={isPending}
                isView={false}
                availableProducts={availableProducts}
              />
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden flex-col gap-3 self-start lg:sticky lg:top-20 lg:flex">
            <GlassCard>
              <CardLabel>{t("summary")}</CardLabel>
              <div className="grid gap-1.5">
                <InfoRow
                  k={tfl("method")}
                  v={<StatusPill statusConfig={methodConfig} inline />}
                />
                <InfoRow
                  k={tfl("location")}
                  v={displayLocationName || "—"}
                  muted={!displayLocationName}
                />
                <InfoRow
                  k={t("productsLabel")}
                  v={stats.currentCount || "—"}
                  muted={!stats.currentCount}
                />
                {(method === "random" || method === "high_value") && (
                  <InfoRow k={tfl("items")} v={items || "—"} muted={!items} />
                )}
                {method === "high_value" && (
                  <InfoRow
                    k={tfl("minValue")}
                    v={minValue ?? "—"}
                    muted={minValue == null}
                  />
                )}
                {method === "manual" && (
                  <InfoRow
                    k={t("manualPicked")}
                    v={stats.manualCount || "—"}
                    muted={!stats.manualCount}
                  />
                )}
              </div>
            </GlassCard>

            <GlassCard>
              <CardLabel>
                <span className="inline-flex items-center gap-1">
                  <Sparkles className="size-2.5" />
                  {t("tipTitle")}
                </span>
              </CardLabel>
              <p className="text-foreground/80 text-micro leading-relaxed">
                {methodConfig.tipBody}
              </p>
            </GlassCard>
          </aside>
        </div>
      </form>

      <DiscardDialog {...discard.dialogProps} variant="warning" />

      <DiscardDialog
        open={navGuard.isOpen}
        onOpenChange={(o) => {
          if (!o) navGuard.cancel();
        }}
        onConfirm={navGuard.confirm}
        onCancel={navGuard.cancel}
        variant="warning"
      />
    </div>
  );
}
