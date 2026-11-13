import { FieldPlainText } from "@/components/ui/field";
import { cn } from "@/lib/utils";

/**
 * ช่องแบบอ่านอย่างเดียว — ป้ายเงียบ ค่าเป็นตัวเด่น ไม่มีกรอบ
 *
 * เดิมค่าอยู่ในกล่องสีเทามีเส้นขอบหน้าตาเหมือน input ที่ถูก disable ทั้งหน้าจึงอ่านเป็น
 * "ฟอร์มที่แก้ไม่ได้" แทนที่จะเป็นข้อมูล และผู้ใช้แยกโหมดดูกับโหมดแก้ไม่ออกในแวบแรก
 * ตอนนี้กรอบมีเฉพาะช่องที่กรอกได้จริง
 *
 * @param example - ตัวอย่างผลลัพธ์ของค่า (เช่น pattern วันที่ → วันนี้ในรูปแบบนั้น)
 * @param specimen - true = ตัวอย่างคือสิ่งที่ผู้ใช้อยากรู้ (วันที่/ตัวเลขจะออกมาหน้าตา
 *   ยังไง) จึงขึ้นเป็นค่าหลัก ส่วนค่าตั้งดิบ (`yyyy-MM-dd`, `th-TH`) ลงไปเป็นบรรทัดรอง
 *   ไม่มีตัวอย่าง (pattern/locale ใช้ไม่ได้) → ค่าดิบกลับมาเป็นค่าหลัก
 */
export function SettingField({
  label,
  value,
  mono,
  fullWidth,
  example,
  specimen,
}: {
  readonly label: string;
  readonly value?: string | number | null;
  readonly mono?: boolean;
  readonly fullWidth?: boolean;
  readonly example?: string | null;
  readonly specimen?: boolean;
}) {
  const isEmpty = value === null || value === undefined || value === "";
  const lead = specimen && example ? example : value;
  const caption = specimen && example ? value : example;
  // บรรทัดรองเป็น mono เมื่อมันคือ pattern ดิบ (specimen) — ตัวอย่างธรรมดาใช้ฟอนต์ปกติ
  const captionMono = specimen && mono;
  const leadMono = mono && !(specimen && example);
  return (
    <div className={cn("min-w-0", fullWidth && "@md:col-span-2")}>
      <div className="text-muted-foreground text-xs">{label}</div>
      {isEmpty ? (
        <div className="text-muted-foreground/60 mt-0.5 text-sm">—</div>
      ) : (
        <>
          <FieldPlainText
            className={cn(
              "mt-0.5 block min-h-0 text-sm break-words tabular-nums",
              leadMono && "font-mono text-xs",
            )}
          >
            {lead}
          </FieldPlainText>
          {caption && (
            <div
              className={cn(
                "text-muted-foreground mt-0.5 text-xs break-words tabular-nums",
                captionMono && "font-mono",
              )}
            >
              {caption}
            </div>
          )}
        </>
      )}
    </div>
  );
}
