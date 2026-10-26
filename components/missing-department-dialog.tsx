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
  const { isSuccess, data, defaultBu, hasDepartment } = useProfile();
  const t = useTranslations("profileError");
  const [dismissedBuId, setDismissedBuId] = useState<string | null>(null);

  const shouldShow = isSuccess && !!defaultBu && !hasDepartment;
  const isDismissed = dismissedBuId !== null && dismissedBuId === defaultBu?.id;

  // BU + บัญชีคือสิ่งที่ admin ต้องรู้เพื่อ assign แผนก — โชว์ไว้ให้ผู้ใช้ส่งต่อได้ทันที
  const details = [
    { label: t("businessUnit"), value: defaultBu?.name },
    { label: t("account"), value: data?.email },
  ].filter((d): d is { label: string; value: string } => !!d.value);

  return (
    <AlertDialog open={shouldShow && !isDismissed}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Building2 className="text-destructive" />
          </AlertDialogMedia>
          <AlertDialogTitle className="text-base">
            {t("missingDepartmentTitle")}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("missingDepartmentDesc")}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {details.length > 0 && (
          <dl className="bg-muted grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-md px-4 py-3 text-sm">
            {details.map((d) => (
              <div key={d.label} className="contents">
                <dt className="text-muted-foreground">{d.label}</dt>
                <dd className="min-w-0 truncate font-medium" title={d.value}>
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {/* จัดตามหัว dialog: กลางบนมือถือ ชิดซ้ายตั้งแต่ sm (AlertDialogHeader ทำแบบเดียวกัน) */}
        <p className="text-center text-sm font-medium sm:text-left">
          {t("missingDepartmentAction")}
        </p>

        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => setDismissedBuId(defaultBu?.id ?? null)}
          >
            {t("close")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
