import { useState } from "react";
import { useNavigate } from "react-router";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useQuantityFormatter } from "@/hooks/use-number-formatter";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { getUserErrorMessage } from "@/lib/error-message";
import { stockOutPath } from "./pos-import-status";
import type { PosOutletPreview, PosShortage } from "./pos-sale-types";
import { shortagesOf, useConfirmPosOutlet } from "./use-pos-sale";

/**
 * dialog ยืนยันตัดสต็อกของ Outlet หนึ่ง — สรุป location / วันที่เอกสาร / จำนวนวัตถุดิบ
 * แล้วยิง `useConfirmPosOutlet`
 *
 * ผลลัพธ์: สำเร็จ → toast พร้อมเลข Stock Out แล้วปิด · `POS_SALE_INSUFFICIENT_STOCK` →
 * ค้าง dialog ไว้แล้วเปลี่ยนเป็นตารางสินค้าที่ขาด (ยอดคงเหลือเปลี่ยนหลังเปิดหน้า) · error อื่น
 * (รวม 409) → toast แล้วปิด · ทุกกรณี hook invalidate preview ให้เอง
 *
 * parent ใส่ `key` เป็น id ของ Outlet เพื่อล้างตารางสินค้าที่ขาดเมื่อเปิดกับ Outlet ใหม่
 *
 * @param props.importId id ของการนำเข้า
 * @param props.outlet Outlet ที่จะยืนยัน (`null` = ปิด)
 * @param props.docDate วันที่ขาย = วันที่เอกสาร Stock Out (YYYY-MM-DD)
 * @param props.onClose เรียกเมื่อ dialog ต้องปิด
 * @returns React element ของ dialog
 */
export function PosConfirmDialog({
  importId,
  outlet,
  docDate,
  onClose,
}: {
  readonly importId: string;
  readonly outlet: PosOutletPreview | null;
  readonly docDate: string | null;
  readonly onClose: () => void;
}) {
  const t = useTranslations("systemAdmin.interface.posSale.review.dialog");
  const tc = useTranslations("common");
  const tErr = useTranslations("errors");
  const navigate = useNavigate();
  const { dateFormat } = useProfile();
  const formatQty = useQuantityFormatter();
  const confirm = useConfirmPosOutlet();
  const [shortages, setShortages] = useState<PosShortage[] | null>(null);

  const close = () => {
    if (!confirm.isPending) onClose();
  };

  const submit = () => {
    if (!outlet) return;
    confirm.mutate(
      { importId, outletId: outlet.outlet_id },
      {
        onSuccess: (res) => {
          onClose();
          toast.success(t("success", { soNo: res.so_no }), {
            description: t("successDesc", { count: res.line_count }),
            action: {
              label: t("open"),
              onClick: () => navigate(stockOutPath(res.stock_out_id)),
            },
          });
        },
        onError: (err) => {
          const short = shortagesOf(err);
          if (short.length > 0) {
            setShortages(short);
            return;
          }
          onClose();
          toast.error(getUserErrorMessage(err, tErr));
        },
      },
    );
  };

  const location = outlet?.location;
  const skipped = outlet?.unmapped_items.length ?? 0;

  return (
    <Dialog open={!!outlet} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-lg">
        {shortages ? (
          <>
            <DialogHeader>
              <DialogTitle>{t("shortTitle")}</DialogTitle>
              <DialogDescription>{t("shortDesc")}</DialogDescription>
            </DialogHeader>
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-xs">
                <thead className="bg-muted/40 border-b">
                  <tr className="text-muted-foreground">
                    <th className="px-3 py-2 text-left font-medium">
                      {t("product")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("requested")}
                    </th>
                    <th className="px-3 py-2 text-right font-medium">
                      {t("available")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {shortages.map((s) => (
                    <tr key={s.product_code} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <span className="text-muted-foreground">
                          {s.product_code}
                        </span>{" "}
                        {s.product_name}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {formatQty(s.requested)}
                      </td>
                      <td className="text-destructive px-3 py-2 text-right tabular-nums">
                        {formatQty(s.available)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                {tc("close")}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>
                {t("title", { outlet: outlet?.name ?? "" })}
              </DialogTitle>
              <DialogDescription>{t("desc")}</DialogDescription>
            </DialogHeader>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
              <dt className="text-muted-foreground">{t("location")}</dt>
              <dd>{location ? `${location.code} · ${location.name}` : "-"}</dd>
              <dt className="text-muted-foreground">{t("date")}</dt>
              <dd>
                {docDate ? formatDate(`${docDate}T00:00:00`, dateFormat) : "-"}
              </dd>
              <dt className="text-muted-foreground">{t("lines")}</dt>
              <dd className="tabular-nums">
                {outlet?.pending_line_count ?? 0}
              </dd>
              <dt className="text-muted-foreground">{t("ingredients")}</dt>
              <dd className="tabular-nums">
                {outlet?.ingredients.length ?? 0}
              </dd>
            </dl>
            {skipped > 0 && (
              <p className="text-warning-ink text-sm">
                {t("skipped", { count: skipped })}
              </p>
            )}
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={close}
                disabled={confirm.isPending}
              >
                <X />
                {tc("cancel")}
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={confirm.isPending}
              >
                {confirm.isPending && <Loader2 className="animate-spin" />}
                {t("confirm")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
