import { cn } from "@/lib/utils";

interface NameWithSubtextProps {
  primary: string;
  secondary?: string;
  align?: "start" | "end";
  /**
   * ตัดบรรทัดแทน truncate — ใช้ในการ์ดของกล่องแคบที่ความสูงไม่จำกัด (การ์ดสต๊อกบนมือถือ)
   * ชื่อสินค้ายาวถูกตัดเหลือ "… (10–12 B…" ทั้งที่มีที่ให้ขึ้นบรรทัดใหม่ · ในตารางคงค่าเดิม
   */
  wrap?: boolean;
}

export function NameWithSubtext({
  primary,
  secondary,
  align = "start",
  wrap = false,
}: NameWithSubtextProps) {
  const fit = wrap ? "break-words" : "truncate";
  const isEnd = align === "end";
  return (
    <div
      className={cn(
        "group w-full",
        isEnd ? "text-right tabular-nums" : "text-left",
      )}
    >
      {/* title = ข้อความเต็ม — บรรทัดนี้ truncate ได้ที่ font scale ใหญ่ๆ และไม่มี
          ทางอื่นให้ผู้ใช้อ่านค่าที่ถูกตัดทิ้ง */}
      <p
        className={cn(fit, "py-0 leading-[normal] font-semibold")}
        title={primary}
      >
        {primary}
      </p>
      {secondary && (
        <p
          className={cn(
            "text-muted-foreground text-micro-legal py-0.5 leading-[normal]",
            fit,
          )}
          title={secondary}
        >
          {secondary}
        </p>
      )}
    </div>
  );
}
