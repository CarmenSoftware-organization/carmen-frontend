import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";
import { FormPrimaryProvider } from "@/components/share/form-primary-action";

interface FormPageShellProps {
  /** FormToolbar / wrapper โมดูล / DocFormHeader — เรียกแบบ flush เสมอ shell ให้ gutter แล้ว */
  readonly header: ReactNode;
  /** default = max-w-4xl · wide = ไม่จำกัด (ตารางหลายคอลัมน์: product, price-list, rfp, workflow detail) */
  readonly width?: "default" | "wide";
  /** SummaryFooterBar — มีแล้ว wrapper ยืดเต็มจอให้ `mt-auto` ของ footer ทำงานตอนเนื้อสั้น */
  readonly footer?: ReactNode;
  /** ฟอร์มที่ย้าย focus กลับมาที่หน้าหลัง save (location) */
  readonly ref?: Ref<HTMLDivElement>;
  readonly tabIndex?: number;
  readonly children: ReactNode;
}

/**
 * โครงหน้า form ทุกหน้า (spec 2026-10-01-form-page-shell-design.md §2.1) — padding
 * safe-area ค่าเดียว · ความกว้างสองค่า · ช่องว่าง header→body `mt-6` ค่าเดียว
 * อย่าเขียน `p-[max(1rem,env(safe-area-inset-bottom))]` หรือ `max-w-4xl` ที่หน้าเอง
 * (`components/share/__tests__/form-page-shell.usage.test.ts` ดักอยู่)
 */
export function FormPageShell({
  header,
  width = "default",
  footer,
  ref,
  tabIndex,
  children,
}: FormPageShellProps) {
  return (
    <div
      ref={ref}
      tabIndex={tabIndex}
      className={cn(
        "mx-auto w-full p-[max(1rem,env(safe-area-inset-bottom))] outline-none",
        width === "default" && "max-w-4xl",
        footer && "flex min-h-full flex-col",
      )}
    >
      {/* footer แจ้งหัวว่ามีปุ่ม workflow — ดู form-primary-action.tsx */}
      <FormPrimaryProvider>
        {header}
        <div className={cn("mt-6 min-w-0", footer && "flex-1")}>{children}</div>
        {footer}
      </FormPrimaryProvider>
    </div>
  );
}
