import { useState } from "react";
import { Download, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { LIST_HEADER_LABEL_HIDE } from "@/components/share/list-page-shell";
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
  useImportCoaFromCarmenGl,
  type ChartOfAccountsImportResult,
} from "./use-coa";

const MAX_SHOWN_ERRORS = 5;

/**
 * error code ที่ backend ใช้เมื่อเรียก Carmen 4 ไม่สำเร็จ — 502 ที่ message ปลอดภัยจะโชว์
 *
 * ปกติ `userFacingServerMessage` ปิด 5xx ทั้งหมดเพราะอาจหลุด internal detail แต่เคสนี้
 * backend ประกอบข้อความเองจากสถานะที่ปลายทางตอบเท่านั้น (จงใจไม่แนบ response body)
 * และมันคือข้อมูลชิ้นเดียวที่บอกผู้ใช้ได้ว่าต้องไปแก้ที่ token/การตั้งค่า interface
 */
const INTERFACE_REQUEST_FAILED = "CHART_OF_ACCOUNTS_INTERFACE_REQUEST_FAILED";

/**
 * ปุ่มดึงผังบัญชีจาก Carmen GL — ขึ้นเฉพาะ BU ที่มีสิทธิ์ interface นั้นจริง
 *
 * ซ่อนทั้งปุ่มเมื่อ entitlement ไม่ใช่ `entitled` (รวมถึง `expired`) เพราะ BU ที่ไม่ได้ซื้อ
 * interface นี้ไม่ควรเห็นว่ามีทางเชื่อมอยู่เลย จาง ๆ ให้เห็นแล้วกดไม่ได้สื่อผิด
 *
 * **จงใจไม่เช็คว่าคอนฟิก `enabled` หรือยัง** — ต้องยิง app-config เพิ่มหนึ่งเส้นต่อการเข้าหน้า
 * เพื่อข้อมูลที่ backend ตรวจให้อยู่แล้ว (ตอบ 400 พร้อมข้อความบอกว่ายังไม่ได้ตั้งค่า)
 *
 * @returns React element ของปุ่ม import + dialog ยืนยัน หรือ `null` เมื่อไม่มีสิทธิ์
 */
export function CoaImportCarmenGlButton() {
  const t = useTranslations("config.chartOfAccounts.importCarmenGl");
  const tc = useTranslations("common");
  const { canWrite } = useCan();
  const { entitlementOf } = useInterfaceEntitlement();
  const [open, setOpen] = useState(false);
  const importMutation = useImportCoaFromCarmenGl();

  const entitled = entitlementOf("accounting", "carmen_gl") === "entitled";
  if (!entitled || !canWrite) return null;

  const showResult = (result: ChartOfAccountsImportResult) => {
    const { summary } = result;
    toast.success(t("success"), {
      description: t("summary", {
        created: summary.created,
        updated: summary.updated,
        skipped: summary.skipped,
        deleted: summary.deleted,
      }),
    });
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
        title={t("action")}
      >
        {importMutation.isPending ? (
          <Loader2 className="animate-spin" />
        ) : (
          <Download />
        )}
        <span className={LIST_HEADER_LABEL_HIDE}>{t("action")}</span>
      </Button>
      <AlertDialog
        open={open}
        onOpenChange={(o) => !importMutation.isPending && setOpen(o)}
      >
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogTitle className="text-sm">
            {t("confirmTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs leading-relaxed">
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
    | Pick<ChartOfAccountsImportResult, "errors">
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
