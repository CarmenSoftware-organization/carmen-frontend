import { cn } from "@/lib/utils";

const DIFFICULTY_DOTS: Record<string, number> = {
  EASY: 1,
  MEDIUM: 2,
  HARD: 3,
};

/**
 * จุดสามดวงบอกระดับความยากของสูตร (EASY = 1 · MEDIUM = 2 · HARD = 3)
 *
 * เป็นสีกลางล้วน — ความยากไม่ใช่ "ดี/เตือน/ผิด" จึงไม่ยืม token สถานะ
 * (ของเดิมในตารางใช้ badge เขียว/เหลือง/แดง ซึ่งทำให้สูตรยากดูเหมือน error)
 * ใช้ร่วมกันระหว่างหัวฟอร์มกับหน้ารายการ ให้เครื่องหมายเดียวกันทั้งสองที่
 */
export function RecipeDifficultyPips({
  difficulty,
  className,
}: {
  readonly difficulty: string | null | undefined;
  readonly className?: string;
}) {
  const filled = DIFFICULTY_DOTS[difficulty ?? ""] ?? 0;
  return (
    <span
      className={cn("inline-flex items-center gap-1", className)}
      aria-hidden="true"
    >
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={cn(
            "size-1.5 rounded-full",
            dot <= filled ? "bg-foreground" : "bg-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}
