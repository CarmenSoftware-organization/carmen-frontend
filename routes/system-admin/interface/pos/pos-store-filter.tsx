import { Store } from "lucide-react";
import { useTranslations } from "use-intl";
import EmptyComponent from "@/components/empty-component";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { PosStore } from "./pos-sale-types";

interface PosStoreFilterProps {
  readonly stores: PosStore[];
  readonly storeId: string | undefined;
  readonly onChange: (storeId: string) => void;
}

/**
 * ตัวเลือกร้าน POS — ไม่มีร้านเลยแสดง Empty ชี้ให้นำเข้าไฟล์ครั้งแรก
 *
 * @param stores ร้านของแบรนด์
 * @param storeId ร้านที่เลือกอยู่
 * @param onChange callback เมื่อเปลี่ยนร้าน
 * @returns React element ของตัวเลือกร้าน
 */
export function PosStoreFilter({
  stores,
  storeId,
  onChange,
}: PosStoreFilterProps) {
  const t = useTranslations("systemAdmin.interface.posSale.store");

  if (stores.length === 0) {
    return (
      <EmptyComponent
        icon={Store}
        title={t("emptyTitle")}
        description={t("emptyDesc")}
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">{t("label")}</span>
      <Select value={storeId} onValueChange={onChange}>
        <SelectTrigger className="w-64" aria-label={t("label")}>
          <SelectValue placeholder={t("placeholder")} />
        </SelectTrigger>
        <SelectContent>
          {stores.map((s) => (
            <SelectItem key={s.id} value={s.id}>
              {s.store_name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
