import { useState } from "react";
import { useTranslations } from "use-intl";
import { Building2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProfile } from "@/hooks/use-profile";

/**
 * เด้งทุกครั้งที่โหลดหน้าโดยเจตนา — การปิดจำไว้แค่ใน state ห้ามย้ายไป sessionStorage /
 * localStorage: ผู้ใช้ที่ไม่มีแผนกทำให้ workflow (การอนุมัติตามแผนก) ทำงานผิดได้ เจ้าของ
 * ระบบต้องการให้ dialog กดดันจนกว่า admin จะ assign แผนกให้ (ตัดสินเมื่อ 2026-10-26)
 */
export function MissingDepartmentDialog() {
  const { isSuccess, defaultBu, hasDepartment } = useProfile();
  const t = useTranslations("profileError");
  const [dismissedBuId, setDismissedBuId] = useState<string | null>(null);

  const shouldShow = isSuccess && !!defaultBu && !hasDepartment;
  const isDismissed = dismissedBuId !== null && dismissedBuId === defaultBu?.id;

  return (
    <AlertDialog open={shouldShow && !isDismissed}>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Building2 className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-sm">
            {t("missingDepartmentTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("missingDepartmentDesc", { buName: defaultBu?.name ?? "" })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex! justify-center">
          <AlertDialogAction
            size="sm"
            onClick={() => setDismissedBuId(defaultBu?.id ?? null)}
          >
            {t("close")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
