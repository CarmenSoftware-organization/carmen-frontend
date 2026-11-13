import { useTranslations } from "use-intl";
import { StatusChip } from "@/components/ui/status-chip";
import { isSentBack } from "@/constant/last-action";
import type { LastAction } from "@/types/last-action";

interface SendBackStatusProps {
  readonly lastAction?: LastAction | null;
  readonly className?: string;
}

/**
 * ป้าย "ส่งกลับ" ของเอกสารที่ค้างอยู่ในสถานะถูกตีกลับ (PR / PO / SR)
 *
 * คืน `null` เมื่อ action ล่าสุดไม่ใช่การตีกลับ — คนเรียกจึงวางไว้ได้เลยโดยไม่ต้อง
 * เช็กเงื่อนไขเอง
 *
 * **ชิปจุดสี** (`StatusChip`) ทรงเดียวกับสถานะของใบที่อยู่ข้าง ๆ เพราะมันคือสถานะของใบ
 * เหมือนกัน — สีจุดผูกกับ status `review` ในไทม์ไลน์ประวัติเหมือนเดิม
 *
 * @param props.lastAction - อ็อบเจกต์ last_action จาก list/detail endpoint
 * @param props.className - class เพิ่มเติม (คอลัมน์ที่จัดกลางต้องส่ง flex มาเอง)
 * @returns ป้ายสถานะ หรือ null
 * @example
 * ```tsx
 * <SendBackStatus lastAction={item.last_action} />
 * ```
 */
export function SendBackStatus({ lastAction, className }: SendBackStatusProps) {
  const tc = useTranslations("common");

  if (!isSentBack(lastAction)) return null;

  return (
    <StatusChip
      status="send_back"
      label={tc("sendBack")}
      className={className}
    />
  );
}
