import { AlertTriangle, ArrowLeft } from "lucide-react";
import { useTranslations } from "use-intl";
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

interface DiscardDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: () => void;
  readonly onCancel: () => void;
  readonly variant?: "default" | "warning";
  readonly title?: string;
  readonly description?: string;
}

export function DiscardDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
  variant = "default",
  title,
  description,
}: DiscardDialogProps) {
  const tf = useTranslations("form");

  const titleText = title ?? tf("discardTitle");
  const descText = description ?? tf("discardDesc");

  if (variant === "warning") {
    return (
      <AlertDialog open={open} onOpenChange={onOpenChange}>
        <AlertDialogContent className="gap-0 p-0 sm:max-w-md">
          <div className="p-5">
            <div className="flex items-start gap-3">
              <div className="bg-muted text-warning-ink flex size-9 shrink-0 items-center justify-center rounded-lg">
                <AlertTriangle className="size-4.5" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <AlertDialogTitle className="text-sm">
                  {titleText}
                </AlertDialogTitle>
                <AlertDialogDescription className="mt-1 text-xs leading-relaxed">
                  {descText}
                </AlertDialogDescription>
              </div>
            </div>
          </div>

          <AlertDialogFooter className="border-t px-5 py-3">
            <AlertDialogCancel onClick={onCancel}>
              <ArrowLeft />
              {tf("keepEditing")}
            </AlertDialogCancel>
            <AlertDialogAction
              variant="warning"
              onClick={(e) => {
                e.preventDefault();
                onConfirm();
              }}
            >
              <AlertTriangle />
              {tf("discard")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>{titleText}</AlertDialogTitle>
          <AlertDialogDescription>{descText}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>
            {tf("keepEditing")}
          </AlertDialogCancel>
          <AlertDialogAction
            variant="warning"
            onClick={(e) => {
              e.preventDefault();
              onConfirm();
            }}
          >
            {tf("discard")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
