import { useTranslations } from "use-intl";
import { Ban, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useClaimFormPrimary } from "@/components/share/form-primary-action";

interface GrnFooterActionProps {
  readonly isActionPending: boolean;
  readonly hasRecord: boolean;
  readonly isView: boolean;
  readonly isCommitted: boolean;
  readonly isVoid: boolean;
  readonly onCommit?: () => void;
  readonly onVoid?: () => void;
}

export function GrnFooterAction({
  isActionPending,
  hasRecord,
  isView,
  isCommitted,
  isVoid,
  onCommit,
  onVoid,
}: GrnFooterActionProps) {
  const tc = useTranslations("common");
  const t = useTranslations("procurement.goodsReceiveNote");

  const showActions = hasRecord && isView && !isCommitted && !isVoid;
  useClaimFormPrimary(showActions);

  if (!showActions) return null;

  // ปุ่ม inline — วางเป็น children ของ SummaryFooterBar เพื่ออยู่ line เดียวกับ
  // สรุปยอด (เหมือน PR footer) แทนการเป็นแถบแยกด้านล่าง
  return (
    <div className="flex shrink-0 items-center gap-2">
      {/* น้ำเงินตัวเดียวกับ Submit และกับปุ่ม commit ของใบปรับสต๊อก — เดิมเป็น
          เขียว (success) ซึ่งทั้งแอปใช้กับ Approve การอ่านเลยปนกัน */}
      <Button
        type="button"
        size="sm"
        disabled={isActionPending}
        onClick={() => onCommit?.()}
      >
        <Check aria-hidden="true" />
        {t("commit")}
      </Button>
      {/* outline ไม่ย้อมแดง — กติกาเดียวกับปุ่มลบ · สีแดงไปอยู่ที่ปุ่มยืนยัน
          ใน dialog ซึ่งเป็นจุดที่ตัดสินใจจริง */}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isActionPending}
        onClick={() => onVoid?.()}
      >
        <Ban aria-hidden="true" />
        {tc("void")}
      </Button>
    </div>
  );
}
