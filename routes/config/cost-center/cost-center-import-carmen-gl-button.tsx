import { useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useCan } from "@/hooks/use-can";
import { ApiError } from "@/lib/api-error";
import { useInterfaceEntitlement } from "@/hooks/use-interface-entitlement";
import {
  useImportCostCenterFromCarmenGl,
  type CostCenterImportResult,
} from "./use-cost-center-import";

const MAX_SHOWN_ERRORS = 5;
const MAX_SHOWN_CODES = 5;

/**
 * error code ที่ backend ใช้เมื่อเรียก Carmen 4 ไม่สำเร็จ — 502 ที่ message ปลอดภัยจะโชว์
 *
 * ปกติ `userFacingServerMessage` ปิด 5xx ทั้งหมดเพราะอาจหลุด internal detail แต่เคสนี้
 * backend ประกอบข้อความเองจากสถานะที่ปลายทางตอบเท่านั้น (จงใจไม่แนบ response body)
 * และมันคือข้อมูลชิ้นเดียวที่บอกผู้ใช้ได้ว่าต้องไปแก้ที่ token/การตั้งค่า interface
 */
const INTERFACE_REQUEST_FAILED = "COST_CENTER_INTERFACE_REQUEST_FAILED";

/**
 * ปุ่มดึงศูนย์ต้นทุนจาก Carmen GL — ขึ้นเฉพาะ BU ที่มีสิทธิ์ interface นั้นจริง
 *
 * ซ่อนทั้งปุ่มเมื่อ entitlement ไม่ใช่ `entitled` (รวมถึง `expired`) เพราะ BU ที่ไม่ได้ซื้อ
 * interface นี้ไม่ควรเห็นว่ามีทางเชื่อมอยู่เลย จาง ๆ ให้เห็นแล้วกดไม่ได้สื่อผิด
 *
 * **จงใจไม่เช็คว่าคอนฟิก `enabled` หรือยัง** — ต้องยิง app-config เพิ่มหนึ่งเส้นต่อการเข้าหน้า
 * เพื่อข้อมูลที่ backend ตรวจให้อยู่แล้ว (ตอบ 400 พร้อมข้อความบอกว่ายังไม่ได้ตั้งค่า)
 *
 * @returns React element ของปุ่ม import + dialog ยืนยัน หรือ `null` เมื่อไม่มีสิทธิ์
 */
export function CostCenterImportCarmenGlButton() {
  const t = useTranslations("config.costCenter.importCarmenGl");
  const tc = useTranslations("common");
  const { canWrite } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  const [open, setOpen] = useState(false);
  const importMutation = useImportCostCenterFromCarmenGl();

  const entitled = entitlementOf("accounting", "carmen_gl") === "entitled";
  if (!entitled || !canWrite) return null;

  const showResult = (result: CostCenterImportResult) => {
    const { summary } = result;
    const lines = [
      t("summary", {
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        deleted: summary.deleted,
      }),
    ];
    if (summary.in_use > 0) {
      const shown = result.in_use_codes.slice(0, MAX_SHOWN_CODES).join(", ");
      const more =
        result.in_use_codes.length > MAX_SHOWN_CODES
          ? ` … +${result.in_use_codes.length - MAX_SHOWN_CODES}`
          : "";
      lines.push(t("inUse", { count: summary.in_use, codes: `${shown}${more}` }));
    }
    toast.success(t("success"), { description: lines.join("\n") });
  };

  const showError = (error: ApiError) => {
    const rows = rowErrorsOf(error);
    // ข้อยกเว้นเฉพาะ error code เดียว — ไม่แตะ `userFacingServerMessage` ซึ่งเป็นของกลาง
    const upstreamMessage =
      error.appCode === INTERFACE_REQUEST_FAILED ? error.serverMessage : undefined;
    toast.error(t("failed"), {
      description:
        (rows.length ? rows.join("\n") : undefined) ??
        upstreamMessage ??
        error.userFacingServerMessage ??
        t("failedDesc"),
    });
  };

  const confirm = () => {
    importMutation.mutate(undefined, {
      onSuccess: (res) => {
        setOpen(false);
        showResult(res.data);
      },
      onError: (error) => {
        setOpen(false);
        showError(error);
      },
    });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={importMutation.isPending}
      >
        {importMutation.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Download />
        )}
        {t("action")}
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => !importMutation.isPending && setOpen(o)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogTitle className="text-base">
            {t("confirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm leading-relaxed">
            {t("confirmDesc")}
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={importMutation.isPending}>
              <X />
              {tc("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                confirm();
              }}
              disabled={importMutation.isPending}
            >
              {importMutation.isPending ? (
                <Loader2 className="animate-spin" />
              ) : (
                <Download />
              )}
              {importMutation.isPending ? t("importing") : t("action")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/**
 * ดึงรายการแถวที่ผิดออกจาก error ของ backend
 *
 * 400 ของ import คืน `errors` ชุดเดียวกับตอนสำเร็จ ผ่านฟิลด์ `data` ของ error body
 * ซึ่ง `ApiError.from` เก็บไว้ที่ `details`
 *
 * @param error - error ที่ mutation โยนออกมา
 * @returns ข้อความต่อแถว สูงสุด `MAX_SHOWN_ERRORS` บรรทัด ตามด้วยบรรทัดสรุปถ้าเหลือ
 */
function rowErrorsOf(error: ApiError): string[] {
  const details = error.details as
    | Pick<CostCenterImportResult, "errors">
    | undefined;
  const errors = details?.errors ?? [];
  const shown = errors
    .slice(0, MAX_SHOWN_ERRORS)
    .map((e) => `#${e.row}${e.column ? ` (${e.column})` : ""}: ${e.message}`);
  if (errors.length > MAX_SHOWN_ERRORS) {
    shown.push(`… +${errors.length - MAX_SHOWN_ERRORS}`);
  }
  return shown;
}
