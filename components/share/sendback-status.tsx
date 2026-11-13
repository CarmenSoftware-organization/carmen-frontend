import { useTranslations } from "use-intl";
import { StatusChip } from "@/components/ui/status-chip";
import { StatusIconLabel } from "@/components/ui/status-icon-label";
import { isSentBack } from "@/constant/last-action";
import type { LastAction } from "@/types/last-action";

interface SendBackStatusProps {
  readonly lastAction?: LastAction | null;
  readonly className?: string;
  /** ชิปจุดสี — ใช้ในคอลัมน์ของ DataGrid ให้ทรงเดียวกับคอลัมน์สถานะข้าง ๆ */
  readonly chip?: boolean;
}

/**
 * ป้าย "ส่งกลับ" ของเอกสารที่ค้างอยู่ในสถานะถูกตีกลับ (PR / PO / SR)
 *
 * คืน `null` เมื่อ action ล่าสุดไม่ใช่การตีกลับ — คนเรียกจึงวางไว้ได้เลยโดยไม่ต้อง
 * เช็กเงื่อนไขเอง
 *
 * **ไอคอน + ข้อความ ไม่มีกรอบ chip** ทรงเดียวกับคอลัมน์สถานะ เพราะมันคือสถานะของใบ
 * เหมือนกัน คนละชนิดกับ count chip — ใช้ชิปเทาต่างหากจะอ่านเป็นของคนละประเภทกับ
 * คอลัมน์สถานะที่อยู่ข้าง ๆ ทั้งที่เป็นเรื่องเดียวกัน สีของไอคอนยังผูกกับ status
 * `review` ในไทม์ไลน์ประวัติเหมือนเดิม
 *
 * ป้ายเป็นตัวพิมพ์ใหญ่ให้ตรงกับคอลัมน์สถานะ ซึ่ง `createStatusConfig` uppercase
 * ให้ทุกตัวอยู่แล้ว — ขนาดตัวอักษรเท่ากันอยู่แล้ว (`text-micro`) แต่ตัวพิมพ์เล็ก
 * ปนอยู่ตัวเดียวในแถวจะอ่านว่าเล็กกว่าเพื่อน
 *
 * @param props.lastAction - อ็อบเจกต์ last_action จาก list/detail endpoint
 * @param props.className - class เพิ่มเติม (คอลัมน์ที่จัดกลางต้องส่ง flex มาเอง)
 * @returns ป้ายสถานะ หรือ null
 * @example
 * ```tsx
 * <SendBackStatus lastAction={item.last_action} />
 * ```
 */
export function SendBackStatus({
  lastAction,
  className,
  chip,
}: SendBackStatusProps) {
  const tc = useTranslations("common");

  if (!isSentBack(lastAction)) return null;

  if (chip) {
    return (
      <StatusChip
        status="send_back"
        label={tc("sendBack")}
        className={className}
      />
    );
  }

  return (
    <StatusIconLabel
      status="send_back"
      label={tc("sendBack").toUpperCase()}
      className={className}
    />
  );
}
