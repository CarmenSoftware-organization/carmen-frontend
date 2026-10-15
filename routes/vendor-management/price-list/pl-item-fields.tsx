// Opt out of React Compiler memoization — useFieldArray + dynamic setValue calls
// cause stale closure issues when auto-memoized (ทรงเดียวกับ pr-item-fields).
"use no memo";

import { useState } from "react";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "use-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { SettingSection } from "@/components/ui/setting-section";
import type { PriceList } from "@/types/price-list";
import { EmptyProducts } from "./pl-empty-states";
import { PLItemTable } from "./pl-item-table";
import {
  PRICE_LIST_DETAIL_EMPTY,
  type PriceListFormValues,
} from "./pl-form-schema";

interface PlItemFieldsProps {
  readonly form: UseFormReturn<PriceListFormValues>;
  readonly priceList?: PriceList;
  readonly isView: boolean;
  readonly isDisabled: boolean;
}

/**
 * ส่วนรายการสินค้าของ price list — หัวข้อ (title + count + ปุ่มเพิ่ม) + ตาราง/กล่องว่าง
 *
 * ถือ field array, ปุ่มเพิ่ม และ dialog ยืนยันลบไว้เองทั้งหมด แบบเดียวกับ
 * `*-item-fields.tsx` ของ PR/PO/SR/GRN — ฟอร์มส่งมาแค่ form กับโหมด ไม่ต้องรู้จัก
 * field array หรือแบกป้ายข้อความลงมาให้
 */
export function PlItemFields({
  form,
  priceList,
  isView,
  isDisabled,
}: PlItemFieldsProps) {
  const t = useTranslations("vendorManagement.priceList");
  const tc = useTranslations("common");
  const [deleteIndex, setDeleteIndex] = useState<number | null>(null);

  const {
    fields: detailFields,
    prepend: prependDetail,
    remove: removeDetail,
  } = useFieldArray({ control: form.control, name: "pricelist_detail" });

  const handleAddDetail = () => prependDetail({ ...PRICE_LIST_DETAIL_EMPTY });

  return (
    <>
      <SettingSection
        wide
        frameless
        title={t("detail.title")}
        // "เพิ่มสินค้า…" เป็นคำชวนของโหมดแก้ไข — โหมดดูไม่มีปุ่มให้กด จึงไม่แสดง
        description={isView ? undefined : t("detail.noItemsDesc")}
        count={detailFields.length}
        action={
          !isDisabled ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={handleAddDetail}
            >
              <Plus />
              {/* "เพิ่มรายการ" ตัวกลางเหมือนทุกโมดูลที่มีตารางรายการ — เดิมเป็น
                  "เพิ่มสินค้า" เฉพาะของสองโมดูลนี้ ทั้งที่ปุ่มทำงานเดียวกันเป๊ะ */}
              {tc("addItem")}
            </Button>
          ) : undefined
        }
      >
        {detailFields.length === 0 ? (
          // ไม่ส่ง onAdd — ปุ่มเพิ่มสินค้าอยู่ที่หัวข้อ section อยู่แล้ว
          <EmptyProducts
            disabled={isDisabled}
            title={t("detail.noItems")}
            description={t("detail.noItemsDesc")}
          />
        ) : (
          <PLItemTable
            form={form}
            detailFields={detailFields}
            detailRefs={priceList?.pricelist_detail}
            isView={isView}
            isDisabled={isDisabled}
            onRequestRemove={setDeleteIndex}
          />
        )}
      </SettingSection>

      <DeleteDialog
        open={deleteIndex !== null}
        onOpenChange={(o) => {
          if (!o) setDeleteIndex(null);
        }}
        title={t("detail.removeItemTitle")}
        description={t("detail.removeItemConfirm")}
        onConfirm={() => {
          if (deleteIndex === null) return;
          removeDetail(deleteIndex);
          setDeleteIndex(null);
        }}
      />
    </>
  );
}
