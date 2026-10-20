import type { CSSProperties } from "react";
import { useTheme } from "next-themes";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";
import {
  CircleAlert,
  CircleCheck,
  Info,
  LoaderCircle,
  TriangleAlert,
} from "lucide-react";

/**
 * Toast ของทั้งแอป — ทรง IBM Carbon (low-contrast notification): พื้นจาง
 * ขอบบาง แถบซ้าย และไอคอนทึบตามชนิด
 *
 * เดิมเปิด `richColors` ของ sonner ซึ่งย้อมทั้งใบเป็นเขียว/แดง/เหลืองอิ่มตัว
 * ผิดกติกา "avoid neon" ของ docs/DESIGN.md (สีความหมายโผล่ครั้งเดียวต่อชิ้น
 * ไม่ใช่พื้น+ขอบ+ตัวหนังสือพร้อมกัน) และยังกลืนกับ badge สถานะเอกสารซึ่งเป็น
 * คนละชั้นสีกันด้วย — ท่าเดียวกับ `StatusDotBadge` ที่ให้สีอยู่ที่จุดเดียว
 *
 * ไอคอนใช้ชุด lucide เหมือนทั้งแอป (ของ sonner เป็น SVG ของตัวเองคนละทรง)
 * ทำเป็นไอคอนทึบด้วย `fill-*-ink` + เส้น `text-popover` (เครื่องหมายในวงเป็นสีพื้น)
 * ใช้ `-ink` เพราะเป็นเวอร์ชันที่คอนทราสต์ผ่านบนพื้นอ่อน — token สีเปล่า
 * เป็นสีพื้น วางบนพื้นจางของ toast แล้วจมหาย
 *
 * เปลือก/ระยะ/ตัวหนังสืออยู่ใน `styles/toast.css` เพราะ selector ของ sonner
 * แรงกว่า utility ของ Tailwind ตัวเดียว
 */
export function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();

  return (
    <SonnerToaster
      theme={resolvedTheme === "dark" ? "dark" : "light"}
      closeButton
      // บนกลาง — มุมล่างชน action bar ที่ติดขอบล่าง (summary-bar, from-PR/PO ฯลฯ)
      // มุมขวาบนชนปุ่มของ header (BU / แจ้งเตือน / Edit-Save ของหน้า)
      // กลางแถบบนเป็นที่เดียวที่ว่างแทบทุกหน้า
      position="top-center"
      mobileOffset={{ top: "0.75rem", left: "1rem", right: "1rem" }}
      offset={{ top: "0.75rem" }}
      // 356px ของ sonner แคบไปเมื่อหัวข้อกับคำอธิบายอยู่บรรทัดเดียวกัน
      style={{ "--width": "420px" } as CSSProperties}
      icons={{
        // positive ไม่ใช่ success — success อยู่ที่ hue 188 ซึ่งออกเขียวอมฟ้า
        // ทีมเลือกเขียวแท้ (hue 145) เพราะสำเร็จควรอ่านว่าเขียวตั้งแต่แวบแรก
        success: (
          <CircleCheck className="fill-positive-ink text-popover size-5" />
        ),
        error: (
          <CircleAlert className="fill-negative-ink text-popover size-5" />
        ),
        warning: (
          <TriangleAlert className="fill-warning-ink text-popover size-5" />
        ),
        info: <Info className="fill-info-ink text-popover size-5" />,
        loading: (
          <LoaderCircle className="text-muted-foreground size-5 animate-spin" />
        ),
      }}
      {...props}
    />
  );
}
