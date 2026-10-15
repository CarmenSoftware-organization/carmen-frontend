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

export interface SendBackReason {
  readonly message: string;
  readonly products: string[];
}

interface SendBackItem {
  readonly product?: { name?: string | null } | null;
  readonly history?: readonly {
    status: string;
    message?: string | null;
  }[];
  /** SR เก็บข้อความตีกลับล่าสุดซ้ำไว้ที่นี่ด้วย — ใช้เมื่อ history ไม่มีข้อความ */
  readonly review_message?: string | null;
}

/**
 * เหตุผลการตีกลับของเอกสารหนึ่งใบ (PR / PO / SR) จัดกลุ่มตามข้อความ
 *
 * เหตุผลไม่ได้อยู่ที่หัวเอกสาร — ตอนกด Send Back ผู้อนุมัติใส่ข้อความ**ต่อรายการ**
 * แล้ว backend ต่อท้าย `history` ของรายการนั้นเป็น `{ status: "review", message }`
 * (รูปกริยา ไม่ใช่ `reviewed` ของ last_action ที่หัวเอกสาร) รายการที่ไม่ได้ถูก
 * ตีกลับในรอบนี้จะมี entry ล่าสุดเป็นอย่างอื่น จึงดูแค่ entry ล่าสุดของแต่ละรายการ
 * ส่วนใหญ่ทุกรายการได้ข้อความเดียวกัน จึงรวมตามข้อความ ไม่โชว์ซ้ำทีละบรรทัด
 *
 * @param items - รายการสินค้าของเอกสาร (undefined ระหว่างยังไม่โหลด)
 * @returns เหตุผลแต่ละข้อความพร้อมชื่อสินค้าที่ได้ข้อความนั้น
 */
export function collectSendBackReasons(
  items: readonly SendBackItem[] | undefined,
): SendBackReason[] {
  const byMessage = new Map<string, string[]>();
  for (const item of items ?? []) {
    const latest = item.history?.at(-1);
    if (latest?.status !== "review") continue;
    const message = (latest.message || item.review_message || "").trim();
    const products = byMessage.get(message) ?? [];
    if (item.product?.name) products.push(item.product.name);
    byMessage.set(message, products);
  }
  return [...byMessage].map(([message, products]) => ({ message, products }));
}

interface SendBackHintProps {
  readonly lastAction?: LastAction | null;
  readonly reasons: SendBackReason[];
  readonly isLoading: boolean;
  /** เรียกครั้งแรกที่ tooltip เปิด — ให้ผู้เรียกเริ่มดึงรายละเอียดเอกสาร */
  readonly onFirstOpen: () => void;
}

/**
 * ป้าย "ส่งกลับ" ข้างเลขที่เอกสาร พร้อม tooltip บอกว่าใครตีกลับ เมื่อไร และเพราะอะไร
 *
 * ส่วนแสดงผลอย่างเดียว — การดึงรายละเอียดอยู่ที่ตัวห่อของแต่ละโมดูล (เช่น
 * `PrSendBackHint`) เพราะ hook ดึงข้อมูลอยู่ใต้ `routes/` ซึ่ง shared layer import
 * ไม่ได้ · list endpoint ไม่มีรายการสินค้า เหตุผลจึงต้องดึงตอนเปิดครั้งแรก
 * ส่วนผู้ตีกลับกับเวลามากับแถวอยู่แล้ว แสดงได้ทันทีระหว่างรอ
 *
 * คืน null เมื่อเอกสารไม่ได้ค้างอยู่ในสถานะถูกตีกลับ
 */
export function SendBackHint({
  lastAction,
  reasons,
  isLoading,
  onFirstOpen,
}: SendBackHintProps) {
  const tc = useTranslations("common");
  const { dateTimeFormat } = useProfile();
  const [open, setOpen] = useState(false);

  if (!isSentBack(lastAction)) return null;

  return (
    <Tooltip
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) onFirstOpen();
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
          {tc("sentBackBy", { name: lastAction?.name ?? "—" })}
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
            <p className="text-muted-foreground">{tc("sentBackNoReason")}</p>
          ) : (
            reasons.map((reason) => (
              <div key={reason.message}>
                <p className="whitespace-pre-line">
                  {reason.message || tc("sentBackNoReason")}
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
