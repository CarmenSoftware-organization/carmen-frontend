import { useRef } from "react";
import { Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { useAmountFormatter } from "@/hooks/use-number-formatter";
import { getUserErrorMessage } from "@/lib/error-message";
import { importStatusLabel } from "./pos-import-status";
import { useUploadSimphony } from "../shared/use-pos-sale";

/** เพดานขนาดไฟล์ที่ยอมให้อัปโหลด (ตรงกับฝั่ง backend) */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** warning ที่ backend ส่งมาเมื่อไฟล์เป็นรูปแบบ export รุ่นเก่า */
const LEGACY_EXPORT_WARNING = "legacy_export_version";

/**
 * ปุ่มอัปโหลดไฟล์ยอดขาย Simphony (.txt) — ใช้ใน toolbar ของแท็บประวัติการนำเข้า
 *
 * ไฟล์ที่ถูกปฏิเสธ (ซ้ำ / รูปแบบไม่รองรับ / อ่านไม่ได้) backend ตอบ 201 พร้อม status ≠ success
 * จึงแยกผลตาม `status` ไม่ใช่ตาม HTTP · reset ค่า input ทุกครั้งเพื่อเลือกไฟล์เดิมซ้ำได้
 *
 * @returns React element ของปุ่มและ input ที่ซ่อนอยู่
 */
export function PosSimphonyUploadButton() {
  const t = useTranslations("operationPlan.posSale.upload");
  const tStatus = useTranslations("operationPlan.posSale.importStatus");
  const tErr = useTranslations("errors");
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadSimphony();
  const formatAmount = useAmountFormatter();

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // reset ก่อนอย่างอื่น — เลือกไฟล์เดิมซ้ำแล้ว onChange ต้องยิงอีก
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE_BYTES) {
      toast.error(t("tooLarge", { name: file.name }));
      return;
    }
    upload.mutate(file, {
      onSuccess: (res) => {
        if (res.status !== "success") {
          toast.error(importStatusLabel(tStatus, res.status), {
            description: res.error_message ?? file.name,
          });
          return;
        }
        const description = t("successDesc", {
          count: res.total_records,
          amount: formatAmount(res.total_sales_amount),
        });
        if (res.warnings.includes(LEGACY_EXPORT_WARNING)) {
          toast.warning(t("legacyWarning"), { description });
          return;
        }
        toast.success(t("success"), { description });
      },
      onError: (err) => toast.error(getUserErrorMessage(err, tErr)),
    });
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".txt,text/plain"
        className="hidden"
        onChange={onPick}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={upload.isPending}
        onClick={() => inputRef.current?.click()}
      >
        {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
        {upload.isPending ? t("uploading") : t("action")}
      </Button>
    </>
  );
}
