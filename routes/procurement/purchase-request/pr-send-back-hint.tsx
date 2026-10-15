import { useState } from "react";
import { useTranslations } from "use-intl";
import { SendBackStatus } from "@/components/share/sendback-status";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { isSentBack } from "@/constant/last-action";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import type { LastAction } from "@/types/last-action";
import type { PurchaseRequest } from "@/types/purchase-request";
import { usePurchaseRequestById } from "./use-purchase-request";

interface SendBackReason {
  readonly message: string;
  readonly products: string[];
}

/**
 * เหตุผลการตีกลับของ PR ใบหนึ่ง จัดกลุ่มตามข้อความ
 *
 * เหตุผลไม่ได้อยู่ที่หัวเอกสาร — ตอนกด Send Back ผู้อนุมัติใส่ข้อความ**ต่อรายการ**
 * แล้ว backend ต่อท้าย `history` ของรายการนั้นเป็น `{ status: "review", message }`
 * (รูปกริยา ไม่ใช่ `reviewed` ของ last_action ที่หัวเอกสาร) รายการที่ไม่ได้ถูก
 * ตีกลับในรอบนี้จะมี entry ล่าสุดเป็นอย่างอื่น จึงดูแค่ entry ล่าสุดของแต่ละรายการ
 * ส่วนใหญ่ทุกรายการได้ข้อความเดียวกัน จึงรวมตามข้อความ ไม่โชว์ซ้ำทีละบรรทัด
 */
function collectReasons(pr: PurchaseRequest | undefined): SendBackReason[] {
  const byMessage = new Map<string, string[]>();
  for (const item of pr?.purchase_request_detail ?? []) {
    const latest = item.history?.at(-1);
    if (latest?.status !== "review") continue;
    const message = latest.message?.trim() ?? "";
    const products = byMessage.get(message) ?? [];
    if (item.product?.name) products.push(item.product.name);
    byMessage.set(message, products);
  }
  return [...byMessage].map(([message, products]) => ({ message, products }));
}

interface PrSendBackHintProps {
  readonly prId: string;
  readonly lastAction?: LastAction | null;
}

/**
 * ป้าย "ส่งกลับ" ข้างเลขที่ PR พร้อม tooltip บอกว่าใครตีกลับ เมื่อไร และเพราะอะไร
 *
 * list endpoint ไม่มีรายการสินค้า เหตุผลจึงต้องดึงรายละเอียดใบนั้นตอนเปิด tooltip
 * ครั้งแรก (query key เดียวกับหน้าแก้ไข — เปิดใบนั้นต่อจะได้จาก cache เลย)
 * ส่วนผู้ตีกลับกับเวลามากับแถวอยู่แล้ว แสดงได้ทันทีระหว่างรอ
 *
 * คืน null เมื่อใบนี้ไม่ได้ค้างอยู่ในสถานะถูกตีกลับ
 */
export function PrSendBackHint({ prId, lastAction }: PrSendBackHintProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const tc = useTranslations("common");
  const { dateTimeFormat } = useProfile();
  const [open, setOpen] = useState(false);
  // ดึงเมื่อเปิดครั้งแรกเท่านั้น — ปิดแล้วไม่ต้องทิ้ง id ไม่งั้นข้อมูลหายตอนเปิดซ้ำ
  const [requested, setRequested] = useState(false);
  const { data, isLoading } = usePurchaseRequestById(
    requested ? prId : undefined,
  );

  if (!isSentBack(lastAction)) return null;

  const reasons = collectReasons(data);

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setRequested(true);
      }}
    >
      <TooltipTrigger asChild>
        {/* tabIndex ให้เปิด tooltip ด้วยคีย์บอร์ดได้ — span เฉย ๆ โฟกัสไม่ได้ */}
        <span tabIndex={0} className="cursor-help rounded-sm">
          <SendBackStatus lastAction={lastAction} />
        </span>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-xs text-left">
        <p className="font-medium">
          {t("sentBackBy", { name: lastAction?.name ?? "—" })}
        </p>
        {lastAction?.at && (
          <p className="text-muted-foreground">
            {formatDate(lastAction.at, dateTimeFormat)}
          </p>
        )}
        <div className="mt-2 space-y-1.5">
          {isLoading ? (
            <Skeleton className="h-3 w-40" aria-label={tc("loading")} />
          ) : reasons.length === 0 ? (
            <p className="text-muted-foreground">{t("sentBackNoReason")}</p>
          ) : (
            reasons.map((reason) => (
              <div key={reason.message}>
                <p className="whitespace-pre-line">
                  {reason.message || t("sentBackNoReason")}
                </p>
                {reasons.length > 1 && reason.products.length > 0 && (
                  <p className="text-muted-foreground">
                    {reason.products.join(", ")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
