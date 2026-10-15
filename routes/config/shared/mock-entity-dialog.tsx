import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { FieldGroup } from "@/components/ui/field";

interface MockEntityDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly icon: LucideIcon;
  readonly title: string;
  readonly subtitle?: string;
  readonly isEdit: boolean;
  readonly canSubmit: boolean;
  readonly onSubmit: () => void;
  readonly children: ReactNode;
}

/**
 * dialog เพิ่ม/แก้ไข master ที่อ่านจาก `accounting-master-mock` — หน้าตาเดียวกับ
 * `ConfigEntityDialog` (ใช้ตัวนั้นตรง ๆ ไม่ได้เพราะผูกกับ mutation hook ของ API)
 */
export function MockEntityDialog({
  open,
  onOpenChange,
  icon: Icon,
  title,
  subtitle,
  isEdit,
  canSubmit,
  onSubmit,
  children,
}: MockEntityDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="overflow-hidden border-0 bg-transparent p-0 shadow-2xl sm:max-w-[425px]"
        showCloseButton={false}
      >
        <div className="border-border/60 bg-popover/80 relative overflow-hidden rounded-2xl border shadow-2xl backdrop-blur-3xl">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (canSubmit) onSubmit();
            }}
            className="relative flex flex-col"
          >
            <div className="border-border/40 bg-background/40 border-b px-6 py-6">
              <div className="flex items-center gap-4">
                <div className="text-primary bg-primary/10 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl shadow-sm">
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex flex-col">
                  <DialogTitle className="text-foreground text-xl font-bold tracking-tight">
                    {title}
                  </DialogTitle>
                  {subtitle && (
                    <p className="text-muted-foreground text-xs">{subtitle}</p>
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-6">
              <FieldGroup className="gap-5">{children}</FieldGroup>
            </div>

            <div className="border-border/40 bg-background/40 flex justify-end gap-3 border-t px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                className="rounded-xl"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSubmit}
                className="bg-primary/90 hover:bg-primary text-primary-foreground rounded-xl font-bold shadow-lg backdrop-blur-md transition-all"
              >
                {isEdit ? "Save" : "Create"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
