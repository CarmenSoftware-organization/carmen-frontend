import type React from "react";
import { useTranslations } from "use-intl";
import { X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ConfirmDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly title: string;
  readonly description?: React.ReactNode;
  readonly onConfirm: () => void;
  readonly isPending?: boolean;
  readonly confirmText?: string;
  readonly confirmIcon?: React.ReactNode;
  /** ป้ายปุ่มปฏิเสธ — ค่าเริ่มต้น "ยกเลิก" (ใช้ "ไม่" เมื่อเป็นคำถามแบบใช่/ไม่) */
  readonly cancelText?: string;
  readonly variant?: "default" | "destructive";
}

/**
 * Dialog ยืนยัน action แบบทั่วไป (approve, submit, cancel ฯลฯ)
 *
 * ครอบ AlertDialog ของ shadcn เพื่อให้ใช้ซ้ำได้เร็ว รองรับ description
 * เป็น string (ใส่ใน AlertDialogDescription) หรือ ReactNode (render แยก)
 * บล็อก onOpenChange ระหว่าง isPending เพื่อกันปิด dialog ขณะ mutation ทำงาน
 * รองรับ variant "default" และ "destructive" สำหรับปุ่มยืนยัน
 *
 * @param props - open, onOpenChange, title, description, onConfirm, isPending, confirmText, variant
 * @returns JSX element ของ AlertDialog
 * @example
 * ```tsx
 * <ConfirmDialog
 *   open={open}
 *   onOpenChange={setOpen}
 *   title="Approve PR?"
 *   description="คำขอนี้จะถูกส่งต่อไปยังขั้นต่อไป"
 *   onConfirm={() => approve.mutate()}
 *   isPending={approve.isPending}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  isPending,
  confirmText,
  confirmIcon,
  cancelText,
  variant = "default",
}: ConfirmDialogProps) {
  const tc = useTranslations("common");
  const isStringDescription = typeof description === "string";

  return (
    <AlertDialog
      open={open}
      onOpenChange={isPending ? undefined : onOpenChange}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && isStringDescription && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        {description && !isStringDescription && (
          <div className="text-muted-foreground text-sm">{description}</div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            <X />
            {cancelText || tc("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant={variant}
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
            disabled={isPending}
          >
            {confirmIcon}
            {isPending ? tc("processing") : confirmText || tc("confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
