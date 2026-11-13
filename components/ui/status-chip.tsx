import { StatusDotBadge } from "@/components/ui/status-dot-badge";
import { getStatusIcon } from "@/components/ui/status-icon-label";
import { cn } from "@/lib/utils";

interface StatusChipProps {
  /** ค่า status ดิบ — ใช้เลือกสีจุด (ชุดเดียวกับ `StatusIconLabel`) */
  readonly status: string;
  readonly label: string;
  readonly size?: "xs" | "sm";
  /** class ของกล่องรอบชิป (จัดตำแหน่งในเซลล์ เช่น `flex w-full justify-center`) */
  readonly className?: string;
}

/**
 * ชิปสถานะของ**เอกสาร**ในคอลัมน์ของ DataGrid — ทรงเดียวกับ `StatusBadge` (Active/Inactive):
 * ชิปเทา + จุดสีนำหน้า + ป้ายสีกลาง ทุกตารางจึงแสดงสถานะหน้าตาเดียวกัน
 * (ผู้ใช้สั่ง 2026-11-13 — เดิมตารางเอกสารใช้ `StatusIconLabel` ไอคอน + ข้อความไม่มีกรอบ)
 *
 * สีจุดมาจาก `--status-*` ของ `styles/badge-status.css` ผ่านตารางเดียวกับ `StatusIconLabel`
 * หน้าที่ยังใช้ไอคอน (หัวฟอร์ม, การ์ด) จึงได้สีเดียวกับชิปในตาราง
 *
 * ป้ายถูกจัดเป็น sentence case ด้วย CSS ("IN PROGRESS" → "In progress") ให้เข้าชุดกับ
 * "Active" — ค่าที่คัดลอก/ส่งออกยังเป็นข้อความเดิม และภาษาไทยไม่ถูกแตะ
 *
 * กล่องนอกมี `data-slot` เพื่อให้กล่อง clamp ของ DataGrid ข้าม (ไม่งั้น flex ถูกทับ)
 * `className` ลงที่กล่องนอก ไม่ใช่ตัวชิป — `flex w-full justify-center` จึงจัดชิปไว้กลางเซลล์
 * โดยชิปไม่ยืดเต็มคอลัมน์
 *
 * @example
 * <StatusChip status={po.po_status} label={config.label} />
 */
export function StatusChip({
  status,
  label,
  size = "sm",
  className,
}: StatusChipProps) {
  return (
    <span
      data-slot="status-chip"
      className={cn("inline-flex max-w-full min-w-0", className)}
    >
      <StatusDotBadge dotColor={getStatusIcon(status).color} size={size}>
        <span className="inline-block lowercase first-letter:uppercase">
          {label}
        </span>
      </StatusDotBadge>
    </span>
  );
}
