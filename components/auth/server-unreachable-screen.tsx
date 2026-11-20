import { useCallback, useEffect, useState } from "react";
import { ServerOff } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { refreshTokens } from "@/lib/auth/auth-api";

const RETRY_INTERVAL_MS = 10_000;

/**
 * หน้าเต็มจอเมื่อไม่มี access token และ refresh ติดต่อ server ไม่ได้ (server/Keycloak ล่ม)
 * — session ยังอยู่ (refresh token ไม่ถูกลบ) จึงไม่พาไป login แต่ลอง refresh ใหม่เองทุก 10 วินาที
 * ไม่ต้อง navigate เอง: ผล `ok` ใส่ token เข้า store แล้ว RequireAuth render หน้าเดิม,
 * ผล `rejected` ล้าง flag แล้ว RequireAuth พาไป login (refreshTokens มี mutex กันยิงซ้อน)
 */
export function ServerUnreachableScreen() {
  const t = useTranslations("auth.serverUnreachable");
  const [isRetrying, setIsRetrying] = useState(false);

  const retry = useCallback(async () => {
    setIsRetrying(true);
    try {
      await refreshTokens();
    } finally {
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    const id = setInterval(() => void retry(), RETRY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [retry]);

  return (
    <main className="bg-background flex min-h-dvh items-center justify-center p-6">
      <Empty role="alert" aria-live="assertive">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ServerOff />
          </EmptyMedia>
          <EmptyTitle>{t("title")}</EmptyTitle>
          <EmptyDescription>{t("description")}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => void retry()} disabled={isRetrying}>
            {isRetrying && <Spinner />}
            {t("retry")}
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
