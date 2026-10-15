import { useEffect } from "react";
import { useErrorToastWithOptions } from "@/hooks/use-error-toast";
import { APP_STATUS_ERROR_CODES, ApiError, ERROR_CODES } from "@/lib/api-error";
import { setApiErrorHandler } from "@/lib/api-error-handler";
import { claimFieldError } from "@/lib/server-field-errors";

export function ApiErrorToaster() {
  const errorToast = useErrorToastWithOptions();

  useEffect(() => {
    setApiErrorHandler((error, options) => {
      // 401/403 มี UI ของตัวเองอยู่แล้ว (redirect ไป login / PermissionDeniedDialog)
      // — toast ซ้ำจะกลายเป็นเสียงรบกวนที่ user ทำอะไรกับมันไม่ได้
      if (error instanceof ApiError && isHandledElsewhere(error)) return;
      // ฟอร์มที่จองรหัสนี้ไว้แสดงใต้ช่องแล้ว (`useServerFieldErrors`) — toast ซ้ำไม่ช่วยอะไร
      if (claimFieldError(error)) return;
      errorToast(error, options);
    });
    return () => setApiErrorHandler(null);
  }, [errorToast]);

  return null;
}

// ปิดปรับปรุง/ถูกปิดใช้งาน → root-layout แทนทั้งแอปด้วยหน้าเต็มจอแล้ว ·
// APP_READ_ONLY ยังขึ้น toast (errors.byCode) เพราะผู้ใช้เพิ่งกดบันทึกแล้วต้องรู้ว่าไม่ได้บันทึก
const isHandledElsewhere = (error: ApiError) =>
  error.code === ERROR_CODES.UNAUTHORIZED ||
  error.code === ERROR_CODES.SESSION_EXPIRED ||
  error.code === ERROR_CODES.FORBIDDEN ||
  error.appCode === APP_STATUS_ERROR_CODES.APP_MAINTENANCE ||
  error.appCode === APP_STATUS_ERROR_CODES.APP_DISABLED;
