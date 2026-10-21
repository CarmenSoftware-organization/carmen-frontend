import { useState } from "react";
import { useWatch, type UseFormReturn } from "react-hook-form";
import { Trash2 } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { FieldInput } from "@/components/ui/field";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import type {
  MoqTierDto,
  PricelistExternalDto,
} from "@/types/price-list-external";

interface MoqTiersEditorProps {
  form: UseFormReturn<PricelistExternalDto>;
  index: number;
}

const NUMBER_CLASS =
  "border-border/60 h-8 w-full rounded-md text-right text-xs tabular-nums";

/**
 * Inline editor ของ MOQ pricing tiers (ขั้นต่ำ → ราคา → lead time) ต่อ item
 *
 * ออกแบบตาม DESIGN.md: ไม่มี grid chrome/edit-toggle — vendor อยู่ใน edit mode
 * อยู่แล้ว จึงแก้ได้ตรง ๆ ทุกช่อง · การ "เพิ่ม tier" มีที่เดียวคือปุ่ม + ในแถวหลัก
 * (ที่นี่ทำแค่แก้/ลบ tier ที่มีอยู่) · ปุ่มลบ muted จนกว่าจะ hover
 *
 * State อยู่ที่ form ล้วน (`useWatch` + `setValue`) ไม่มี local state — input เป็น
 * uncontrolled (`defaultValue`) และ row key ด้วย tier.id ที่นิ่ง จึงพิมพ์ได้โดย
 * focus ไม่หลุด แม้ค่าจะ re-render (setValue บน path nested ไม่ทำให้ fields ของ
 * useFieldArray แม่ churn → sub-row ไม่ remount)
 */
export default function MoqTiersEditor({ form, index }: MoqTiersEditorProps) {
  const t = useTranslations("priceListPortal");
  const path = `tb_pricelist_detail.${index}.moq_tiers` as const;
  const tiers =
    (useWatch({ control: form.control, name: path }) as
      MoqTierDto[] | undefined) ?? [];

  // index ของ tier ที่รอ confirm ลบ (null = ไม่มี dialog เปิดอยู่)
  const [tierToDelete, setTierToDelete] = useState<number | null>(null);

  const setTiers = (next: MoqTierDto[]) =>
    form.setValue(path, next, { shouldDirty: true });

  const setField = (i: number, field: keyof MoqTierDto, value: number) =>
    setTiers(tiers.map((t, j) => (j === i ? { ...t, [field]: value } : t)));

  const removeTier = (i: number) => setTiers(tiers.filter((_, j) => j !== i));

  return (
    <div className="bg-muted/30 flex justify-end px-6 py-4">
      <div className="w-full max-w-2xl space-y-1.5">
        <div className="text-muted-foreground text-micro-legal grid grid-cols-[1fr_1fr_1fr_2rem] gap-3 px-0.5 font-semibold tracking-wider uppercase">
          <span className="text-right">{t("colMoq")}</span>
          <span className="text-right">{t("colPrice")}</span>
          <span className="text-right">{t("colLeadTime")}</span>
          <span />
        </div>

        {tiers.length === 0 ? (
          <p className="text-muted-foreground py-1 text-xs">{t("noTiers")}</p>
        ) : (
          tiers.map((tier, i) => (
            <div
              key={tier.id}
              className="grid grid-cols-[1fr_1fr_1fr_2rem] items-center gap-3"
            >
              <FieldInput
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0"
                defaultValue={tier.minimum_quantity}
                className={NUMBER_CLASS}
                onChange={(e) =>
                  setField(i, "minimum_quantity", Number(e.target.value))
                }
              />
              <FieldInput
                type="number"
                inputMode="decimal"
                min={0}
                placeholder="0.00"
                defaultValue={tier.price}
                className={NUMBER_CLASS}
                onChange={(e) => setField(i, "price", Number(e.target.value))}
              />
              <FieldInput
                type="number"
                inputMode="numeric"
                min={0}
                placeholder="0"
                defaultValue={tier.lead_time_days ?? 0}
                className={NUMBER_CLASS}
                onChange={(e) =>
                  setField(i, "lead_time_days", Number(e.target.value))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t("removeTier")}
                onClick={() => setTierToDelete(i)}
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))
        )}
      </div>

      <DeleteDialog
        open={tierToDelete !== null}
        onOpenChange={(open) => !open && setTierToDelete(null)}
        onConfirm={() => {
          if (tierToDelete !== null) removeTier(tierToDelete);
          setTierToDelete(null);
        }}
        title={t("removeTierTitle")}
        description={t("removeTierDescription")}
      />
    </div>
  );
}
