import { Button } from "@/components/ui/button";
import { NOTIFICATION_VARIABLES } from "./noti-tmpl-variables";

/**
 * แทรก `{{token}}` ตรงตำแหน่งเคอร์เซอร์ของช่องนั้น
 *
 * เขียนผ่าน `setRangeText` แล้ว dispatch `input` แทนการ `setValue` ของ RHF
 * เพราะช่องนี้เป็น uncontrolled (`register`) — การยิง event จริงทำให้ทั้ง
 * RHF (dirty/validate) และตัวนับอักษรใน `Textarea` เห็นค่าใหม่พร้อมกัน
 * ถ้า `setValue` อย่างเดียว ตัวนับจะค้างที่เลขเก่าจนกว่าจะพิมพ์
 *
 * หาช่องด้วย `getElementById` ไม่ใช่ ref ที่ merge กับ ref ของ RHF — callback ref
 * แบบ inline มี identity ใหม่ทุก render React จึงเรียก `ref(null)` ก่อนเสมอ
 * ซึ่งทำให้ RHF ถอนทะเบียน DOM ของ field นั้น แล้ว `form.reset()` ตอนกด Cancel
 * เขียนค่าเดิมกลับลงช่องไม่ได้ (ข้อความที่ยกเลิกไปแล้วค้างอยู่บนหน้าจอ)
 */
function insertToken(id: string, token: string) {
  const el = document.getElementById(id) as HTMLTextAreaElement | null;
  if (!el) return;
  const start = el.selectionStart ?? el.value.length;
  const end = el.selectionEnd ?? start;
  el.setRangeText(token, start, end, "end");
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.focus();
}

/**
 * แถวปุ่มแทรกตัวแปร
 *
 * ป้ายบนปุ่มประกอบในโค้ด ไม่ใช่ในไฟล์แปล — ICU อ่าน `{{` เป็น argument
 * แล้วหน้าจะพังทั้งหน้า (ดูหน้า Email Messages ที่เจอปัญหาเดียวกันมาก่อน)
 */
export function VariableChips({
  label,
  targetId,
  disabled,
}: {
  readonly label: string;
  readonly targetId: string;
  readonly disabled?: boolean;
}) {
  if (disabled) return null;
  return (
    <div className="flex flex-wrap items-center gap-1 pt-1">
      <span className="text-muted-foreground mr-0.5 text-micro">{label}</span>
      {NOTIFICATION_VARIABLES.map((key) => (
        <Button
          key={key}
          type="button"
          variant="outline"
          size="xs"
          className="text-micro-legal h-5 px-1.5 font-mono"
          onClick={() => insertToken(targetId, `{{${key}}}`)}
        >
          {`{{${key}}}`}
        </Button>
      ))}
    </div>
  );
}
