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

const DISMISSED_KEY = "missing-department-dismissed-bu";

/**
 * จำ BU ที่ปิด dialog แล้วไว้ใน sessionStorage — เดิมจำแค่ใน state จึงเด้งใหม่ทุก reload
 * ทั้งที่ผู้ใช้แก้เองไม่ได้ (ต้องรอ admin) และ header ก็บอก "No department" อยู่แล้ว
 * ใช้ session ไม่ใช่ local: เปิดแท็บ/ล็อกอินใหม่ยังเตือนอีกครั้ง ไม่เงียบไปตลอด
 * storage อาจโยน error (private mode / ถูกบล็อก) — ล้มแล้วถอยไปพฤติกรรมเดิม
 */
const readDismissed = (): string | null => {
  try {
    return sessionStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
};

const writeDismissed = (buId: string) => {
  try {
    sessionStorage.setItem(DISMISSED_KEY, buId);
  } catch {
    // ไม่มี storage ก็ยังปิดได้ใน state
  }
};

export function MissingDepartmentDialog() {
  const { isSuccess, defaultBu, hasDepartment } = useProfile();
  const t = useTranslations("profileError");
  const [dismissedBuId, setDismissedBuId] = useState<string | null>(
    readDismissed,
  );

  const shouldShow = isSuccess && !!defaultBu && !hasDepartment;
  const isDismissed = dismissedBuId !== null && dismissedBuId === defaultBu?.id;

  const dismiss = () => {
    const buId = defaultBu?.id ?? null;
    setDismissedBuId(buId);
    if (buId) writeDismissed(buId);
  };

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
            onClick={dismiss}
          >
            {t("close")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
