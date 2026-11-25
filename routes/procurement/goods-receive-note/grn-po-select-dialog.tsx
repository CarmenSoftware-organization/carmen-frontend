import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { ClipboardCheck, PackageCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePurchaseOrderForGrnByVendor } from "../shared/use-purchase-order";
import type { PoForGrn } from "@/types/purchase-order";
import { GrnPoSelectList } from "./grn-po-select-list";
import { pickSelectedPos } from "./grn-po-usable";

interface GrnPoSelectDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly vendorId: string;
  readonly currencyId: string;
  readonly currencyName: string;
  readonly excludeIds: Set<string>;
  readonly onSelect: (poList: PoForGrn[]) => void;
}

/**
 * เพิ่มรายการจากใบสั่งซื้อเข้าใบรับสินค้าที่กำลังกรอกอยู่
 *
 * ตัวลิสต์ข้างในเป็นตัวเดียวกับขั้นที่ 2 ของ wizard สร้างจากใบสั่งซื้อ — dialog นี้
 * เป็นแค่กรอบกับปุ่มยืนยัน ต่างกันแค่ตัดใบที่อยู่ในฟอร์มแล้วออกจากลิสต์
 */
export function GrnPoSelectDialog({
  open,
  onOpenChange,
  vendorId,
  currencyId,
  currencyName,
  excludeIds,
  onSelect,
}: GrnPoSelectDialogProps) {
  const t = useTranslations("procurement.goodsReceiveNote");
  const tc = useTranslations("common");

  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data, isLoading, refetch } = usePurchaseOrderForGrnByVendor(vendorId);

  useEffect(() => {
    if (open && vendorId) refetch();
  }, [open, vendorId, refetch]);

  const poList = useMemo(() => {
    const all = data?.data ?? [];
    return excludeIds.size === 0
      ? all
      : all.filter((po) => !excludeIds.has(po.id));
  }, [data, excludeIds]);

  // reset การเลือกเมื่อปิด dialog — กัน checkbox ค้างจากครั้งก่อนตอนเปิดใหม่
  const handleOpenChange = (next: boolean) => {
    if (!next) setSelected(new Set());
    onOpenChange(next);
  };

  const handleConfirm = () => {
    const result = pickSelectedPos(poList, selected);
    if (result.length === 0) return;

    // ใบรับสินค้าใบเดียวมีสกุลเงินเดียวและเรตเดียว — PO คนละสกุลที่หลุดเข้ามาจะ
    // ถูกคิดด้วยเรตของใบนี้ทั้งก้อน ยอดเพี้ยนโดยไม่มีอะไรฟ้อง · ใบยังไม่ตั้งสกุล
    // เงินก็เทียบกันเองในชุดที่เลือกแทน (ทรงเดียวกับ wizard)
    const target = currencyId || result[0].currency_id;
    if (result.some((po) => po.currency_id !== target)) {
      // เลือกได้แต่ทำต่อไม่ได้ = เตือนให้เลือกใหม่ ไม่ใช่ระบบพัง → warning
      toast.warning(
        currencyId
          ? t("poCurrencyMismatch", { currency: currencyName })
          : t("mixedCurrencyError"),
      );
      return;
    }

    onSelect(result);
    handleOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="flex flex-col gap-0 p-0 pt-2 sm:max-w-[70vw]!">
        <div className="px-6 pt-6 pb-4">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="bg-muted text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <PackageCheck className="size-4.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="bg-primary/10 text-primary text-micro-legal mb-1 inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 font-semibold">
                  {t("entity")}
                </div>
                <DialogTitle className="text-sm">{t("selectPo")}</DialogTitle>
                <DialogDescription className="mt-1">
                  {t("selectPoDesc")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="px-6 pb-4">
          <GrnPoSelectList
            poList={poList}
            isLoading={isLoading}
            selected={selected}
            onChange={setSelected}
          />
        </div>

        <DialogFooter className="bg-muted/20 items-center border-t px-6 py-3 sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleOpenChange(false)}
          >
            {tc("cancel")}
          </Button>
          <Button
            size="default"
            disabled={selected.size === 0}
            onClick={handleConfirm}
          >
            <ClipboardCheck aria-hidden="true" />
            {tc("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
