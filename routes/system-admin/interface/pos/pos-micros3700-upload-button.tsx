import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { getUserErrorMessage } from "@/lib/error-message";
import { extractMicros3700Lines, Micros3700PdfError } from "./micros3700-pdf";
import {
  PosMicros3700ImportDialog,
  type Micros3700Payload,
  type Micros3700Ready,
} from "./pos-micros3700-import-dialog";
import { importStatusLabel } from "./pos-import-status";
import { useCheckMicros3700 } from "./use-pos-sale";

/** เพดานขนาด PDF ที่ยอมเปิดในเบราว์เซอร์ */
const MAX_FILE_BYTES = 20 * 1024 * 1024;

type Stage = "idle" | "reading" | "checking";

/**
 * ปุ่มอัปโหลดรายงาน Micros 3700 (PDF) — ใช้ใน toolbar ของแท็บประวัติการนำเข้า
 *
 * อ่านข้อความ PDF ในเบราว์เซอร์ (PDF ไม่ออกจากเครื่อง) → ส่งเฉพาะบรรทัดให้ `check` →
 * `rejected` = toast (ไฟล์ถูกบันทึกเป็นประวัติแล้ว) · `ready` = เปิด dialog สรุปต่อ Outlet
 * · ถือ `payload` ไว้ที่ปุ่มจน dialog ปิด แล้วล้างทิ้ง · reset input ทุกครั้งเพื่อเลือกไฟล์เดิมซ้ำได้
 *
 * @returns React element ของปุ่ม, input ที่ซ่อนอยู่ และ dialog
 */
export function PosMicros3700UploadButton() {
  const t = useTranslations("systemAdmin.interface.posSale.micros3700Upload");
  const tStatus = useTranslations("systemAdmin.interface.posSale.importStatus");
  const tErr = useTranslations("errors");
  const inputRef = useRef<HTMLInputElement>(null);
  const check = useCheckMicros3700();
  const [stage, setStage] = useState<Stage>("idle");
  const [pending, setPending] = useState<{
    payload: Micros3700Payload;
    check: Micros3700Ready;
  } | null>(null);

  const busy = stage !== "idle";

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // reset ก่อนอย่างอื่น — เลือกไฟล์เดิมซ้ำแล้ว onChange ต้องยิงอีก
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t("tooLarge", { name: file.name }));
      return;
    }

    setStage("reading");
    let text: Awaited<ReturnType<typeof extractMicros3700Lines>>;
    try {
      text = await extractMicros3700Lines(file);
    } catch (err) {
      setStage("idle");
      const kind = err instanceof Micros3700PdfError ? err.kind : "unreadable";
      toast.error(t(kind === "password" ? "pdfPassword" : "pdfUnreadable"), {
        description: file.name,
      });
      return;
    }

    const payload: Micros3700Payload = {
      file_name: file.name,
      lines: text.lines,
      extract_ms: text.extract_ms,
      page_count: text.page_count,
    };
    setStage("checking");
    check.mutate(
      {
        file_name: payload.file_name,
        lines: payload.lines,
        extract_ms: payload.extract_ms,
      },
      {
        onSuccess: (res) => {
          if (res.kind === "rejected") {
            toast.error(importStatusLabel(tStatus, res.import.status), {
              description: res.import.error_message ?? file.name,
            });
            return;
          }
          setPending({ payload, check: res });
        },
        onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
        onSettled: () => setStage("idle"),
      },
    );
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={(e) => void onPick(e)}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => inputRef.current?.click()}
      >
        {busy ? <Loader2 className="animate-spin" /> : <FileUp />}
        {stage === "reading"
          ? t("reading")
          : stage === "checking"
            ? t("checking")
            : t("action")}
      </Button>
      {pending && (
        <PosMicros3700ImportDialog
          open
          onOpenChange={(open) => !open && setPending(null)}
          payload={pending.payload}
          check={pending.check}
        />
      )}
    </>
  );
}
