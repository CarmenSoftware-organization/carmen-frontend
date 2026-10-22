import { useTranslations } from "use-intl";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrintDocument } from "@/hooks/use-print-document";
import type {
  PrintDocumentOptions,
  PrintDocumentType,
} from "@/lib/print-document";

interface PrintDocumentButtonProps {
  readonly documentType: PrintDocumentType;
  readonly documentId?: string;
  readonly filters?: PrintDocumentOptions["filters"];
  /** template ที่จะพิมพ์ — ไม่ส่ง = ตามค่าใบพิมพ์ของ BU (print-form.*) */
  readonly templateId?: string;
  readonly disabled?: boolean;
  readonly size?: "default" | "sm" | "lg" | "icon";
  readonly variant?:
    | "default"
    | "outline"
    | "ghost"
    | "secondary"
    | "destructive"
    | "info";
  readonly showLabel?: boolean;
  readonly className?: string;
}

export function PrintDocumentButton({
  documentType,
  documentId,
  filters,
  templateId,
  disabled,
  size = "sm",
  variant = "outline",
  showLabel = true,
  className,
}: PrintDocumentButtonProps) {
  const tc = useTranslations("common");
  const { print, isPrinting } = usePrintDocument();

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled || isPrinting}
      onClick={() => void print(documentType, { documentId, filters, templateId })}
      className={className}
    >
      <Printer aria-hidden="true" />
      {showLabel ? tc("print") : null}
    </Button>
  );
}
