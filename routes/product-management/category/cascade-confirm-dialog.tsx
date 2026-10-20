import { ArrowRight } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { CategoryNode } from "@/types/category";
import { NODE_TYPE } from "@/types/category";
import type { CascadeChanges, CascadeChoice } from "./cascade-changes";

interface CascadeConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly nodeType: CategoryNode["type"];
  readonly changes: CascadeChanges;
  readonly counts: { subCategories: number; itemGroups: number };
  readonly flagsChanged: boolean;
  readonly onChoose: (choice: CascadeChoice) => void;
}

/**
 * กล่องยืนยันก่อนเขียนทับค่า (deviation / รหัสบัญชี) ลงรายการชั้นล่าง
 * แสดงเฉพาะค่าที่ผู้ใช้เปลี่ยนจริง พร้อมบอกจำนวนที่จะถูกเขียนทับ
 * ปุ่มเลือกเรียก onChoose แล้วปิดเอง (Radix) — parent เป็นคนส่ง payload
 * @param props - open, onOpenChange, nodeType, changes, counts, flagsChanged, onChoose
 * @returns JSX element ของ AlertDialog
 */
export function CascadeConfirmDialog({
  open,
  onOpenChange,
  nodeType,
  changes,
  counts,
  flagsChanged,
  onChoose,
}: CascadeConfirmDialogProps) {
  const t = useTranslations("productManagement.category");
  const tc = useTranslations("common");
  const tfl = useTranslations("field");

  // บัญชีที่ล้างค่า: ชั้นล่างสุดของ Category = ไม่มี, ชั้นอื่น = สืบทอดจากชั้นบน
  const clearedLabel =
    nodeType === NODE_TYPE.CATEGORY ? t("cascadeNone") : t("cascadeInherit");
  const accountValue = (code: string | null) => code ?? clearedLabel;

  const rows: { key: string; label: string; from: string; to: string }[] = [];
  if (changes.price_deviation_limit) {
    rows.push({
      key: "price",
      label: tfl("priceDeviation"),
      from: String(changes.price_deviation_limit.from),
      to: String(changes.price_deviation_limit.to),
    });
  }
  if (changes.qty_deviation_limit) {
    rows.push({
      key: "qty",
      label: tfl("qtyDeviation"),
      from: String(changes.qty_deviation_limit.from),
      to: String(changes.qty_deviation_limit.to),
    });
  }
  if (changes.inventory) {
    rows.push({
      key: "inventory",
      label: t("inventoryAccount"),
      from: accountValue(changes.inventory.from),
      to: accountValue(changes.inventory.to),
    });
  }
  if (changes.direct) {
    rows.push({
      key: "direct",
      label: t("directAccount"),
      from: accountValue(changes.direct.from),
      to: accountValue(changes.direct.to),
    });
  }

  let targets: string;
  if (nodeType === NODE_TYPE.CATEGORY) {
    targets = t("cascadeTargetsCategory", {
      subCategories: counts.subCategories,
      itemGroups: counts.itemGroups,
    });
  } else if (nodeType === NODE_TYPE.SUBCATEGORY) {
    targets = t("cascadeTargetsSubcategory", { itemGroups: counts.itemGroups });
  } else {
    targets = t("cascadeTargetsItemGroup");
  }

  const hasCleared =
    changes.inventory?.to === null || changes.direct?.to === null;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent aria-describedby={undefined}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("cascadeTitle")}</AlertDialogTitle>
        </AlertDialogHeader>

        <div className="space-y-4 text-sm">
          <section className="space-y-1.5">
            <p className="text-muted-foreground font-medium">
              {t("cascadeChangedLabel")}
            </p>
            <ul className="space-y-1">
              {rows.map((row) => (
                <li
                  key={row.key}
                  className="flex flex-wrap items-center gap-x-2"
                >
                  <span className="text-muted-foreground">{row.label}:</span>
                  <span>{row.from}</span>
                  <ArrowRight
                    className="text-muted-foreground size-3.5"
                    aria-hidden
                  />
                  <span className="font-medium">{row.to}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="space-y-1.5">
            <p className="text-muted-foreground font-medium">
              {t("cascadeTargetsLabel")}
            </p>
            <p>{targets}</p>
          </section>

          {hasCleared && (
            <p className="text-warning-ink">{t("cascadeClearWarning")}</p>
          )}
          {flagsChanged && (
            <p className="text-warning-ink">{t("confirmFlagsChange")}</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
          <AlertDialogAction variant="outline" onClick={() => onChoose("self")}>
            {t("cascadeSelfOnly")}
          </AlertDialogAction>
          <AlertDialogAction onClick={() => onChoose("cascade")}>
            {t("cascadeOverwrite")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
