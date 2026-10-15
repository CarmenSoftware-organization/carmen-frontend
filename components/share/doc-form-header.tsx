import { useEffect, type ReactNode } from "react";
import { useLocation } from "react-router";
import { useProfile } from "@/hooks/use-profile";
import { recordRecentDocument } from "@/hooks/use-recent-documents";
import { cn } from "@/lib/utils";
import { BackButton } from "@/components/share/back-button";
import { MockBadge } from "@/components/ui/mock-badge";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DocFormHeaderProps {
  readonly title: string;
  /**
   * title เป็น placeholder (ยังไม่กรอกชื่อ) → render เป็น muted italic เป็น cue
   * ว่าเป็นค่าตัวอย่าง — ใช้ในฟอร์ม create/edit ที่ชื่อว่างได้ (vendor-management)
   */
  readonly titleMuted?: boolean;
  readonly subtitle?: ReactNode;
  /** ไม่ส่ง = ใช้ `common.goBack` ของ BackButton */
  readonly backLabel?: string;
  /** ไม่ส่ง = ไม่มีปุ่มย้อนกลับ (หน้า settings ที่เป็น leaf ของเมนู ไม่มี list ให้กลับ) */
  readonly onBack?: () => void;
  readonly badges?: ReactNode;
  /** หน้านี้ยังเป็นข้อมูลตัวอย่าง → แสดงป้าย MOCK ข้างชื่อ */
  readonly mock?: boolean;
  readonly actions?: ReactNode;
  readonly ribbon?: ReactNode;
  readonly leading?: ReactNode;
  readonly flush?: boolean;
}

export function DocFormHeader({
  title,
  titleMuted = false,
  subtitle,
  backLabel,
  onBack,
  badges,
  mock = false,
  actions,
  ribbon,
  leading,
  flush = false,
}: DocFormHeaderProps) {
  const { pathname } = useLocation();
  const { buCode } = useProfile();

  // บันทึกลง "เพิ่งเปิด" ของ ⌘K palette — DocFormHeader คือหัวของหน้า detail
  // ทุกโมดูล จุดเดียวครอบหมด บันทึกเฉพาะ path ที่ลงท้ายด้วย id จริง (หน้า /new
  // ไม่ใช่เอกสาร) — title ระหว่างโหลดเป็นชื่อ entity ชั่วคราว เดี๋ยว effect รอบ
  // ถัดไปเขียนทับด้วยเลขที่จริงเองเพราะ key คือ path เดิม
  useEffect(() => {
    if (!buCode || titleMuted) return;
    const last = pathname.split("/").pop() ?? "";
    if (!UUID_RE.test(last)) return;
    recordRecentDocument({ path: pathname, label: title, bu: buCode });
  }, [pathname, title, titleMuted, buCode]);

  return (
    <div>
      {/* ── Content column ── px-4 (เว้น flush) ให้ title/ribbon align กับ form
          body; ปุ่ม back absolute อ้าง title-row (start = ตำแหน่ง title เสมอ ไม่ว่า
          column จะ px-4 หรือ flush) จึง hang ออกซ้ายด้วย translate เดียวกันทั้งสอง
          โหมด — อยู่บรรทัดเดียวกับ title โดยไม่ push ให้ title เยื้อง */}
      <div className={cn("relative", !flush && "px-4")}>
        <div className="relative flex flex-wrap items-center gap-2">
          {onBack && (
            <BackButton
              onClick={onBack}
              label={backLabel}
              className="absolute top-1/2 left-0 -translate-x-[calc(100%+0.25rem)] -translate-y-1/2"
            />
          )}
          {leading}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
            <h1
              className={cn(
                // ชื่อยาวตัดท้ายบรรทัดเดียว ไม่ห่อลงบรรทัดสอง — ตั้งใจ ไม่ใช่หลุด
                // (เคยเสนอ line-clamp-2 ให้ชื่อสินค้าที่เอาบาร์โค้ดไว้ท้าย ทีมเลือก
                // แบบนี้) ข้อความเต็มอยู่ใน title attribute
                // min-w-0 ให้ truncate ทำงานใน flex — ไม่งั้น title ยาวจะดันเบียด badge
                // 18/20px ไม่ใช่ 20/24px: เลขที่เอกสารเป็น "ค่า" ไม่ใช่ชื่อหน้า
                // (navbar breadcrumb บอกชื่อหน้าอยู่แล้ว) และ header ที่เหลือ
                // อยู่ที่ 11-14px ทั้งแถบ — 24px ทำให้หัวหนักบนผิดสัดส่วน
                // max-w คุมไม่ให้ชื่อยาวกินทั้งแถวจนดันปุ่มตกบรรทัด — โหมดแก้ไขมี
                // ปุ่มถึงสี่ตัว ถ้าปล่อยให้ title ยืดตามเนื้อหา ปุ่มจะถูกดันลงไป
                // เอง (เลขที่เอกสารของโมดูลอื่นสั้นกว่านี้มาก ไม่โดนกระทบ)
                "max-w-sm min-w-0 truncate text-lg font-semibold tracking-tight sm:text-xl",
                titleMuted && "text-muted-foreground italic",
              )}
              title={title}
            >
              {title}
            </h1>
            {mock && <MockBadge />}
            {badges}
          </div>
          {/* shrink-0 กันปุ่มถูกบีบจนตกบรรทัด — ให้ title เป็นฝ่ายย่อแทน */}
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {actions}
          </div>
        </div>
        {subtitle && (
          <div className="text-muted-foreground mt-0.5 text-xs">{subtitle}</div>
        )}

        {/* ── Document info ribbon ── */}
        {/* ribbon เป็น grid ที่ align คอลัมน์กับ form body (ใช้แค่ PR — ช่อง workflow/description); ml-4
            ของตัว ribbon เอง cancel -ml-4 นี้ ให้ content ตัวแรกเสมอกับ title */}
        {ribbon && (
          <div className="flex items-center gap-2 pt-4">
            <div className="-ml-4 flex min-w-0 flex-1 items-center gap-2">
              {ribbon}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
