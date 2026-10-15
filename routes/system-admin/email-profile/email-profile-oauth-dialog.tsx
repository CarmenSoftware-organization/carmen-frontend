import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Loader2 } from "lucide-react";
import { useTranslations } from "use-intl";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { DeviceLoginStart, EmailProfile } from "@/types/email-profile";
import { useEmailProfileOAuth } from "./use-email-profile-oauth";

type Phase =
  | { kind: "starting" }
  | { kind: "waiting"; start: DeviceLoginStart }
  | { kind: "connected"; account: string }
  | { kind: "failed"; message: string };

interface EmailProfileOAuthDialogProps {
  readonly profile: EmailProfile;
  readonly onOpenChange: (open: boolean) => void;
}

/**
 * เชื่อมต่อบัญชี Hotmail ของโปรไฟล์ด้วย device code — แสดงโค้ดให้ผู้ใช้ไปกรอกที่ Microsoft
 * แล้ว poll จนได้สถานะสุดท้าย loop ผูกกับอายุ component (ตัวเรียก mount เฉพาะตอนเปิด)
 * ปิด dialog = unmount = หยุด poll ทันที ไม่มี request ค้าง
 */
export function EmailProfileOAuthDialog({
  profile,
  onOpenChange,
}: EmailProfileOAuthDialogProps) {
  const t = useTranslations("systemAdmin.emailProfile.oauth");
  const tc = useTranslations("common");
  const { start, poll, refreshProfiles } = useEmailProfileOAuth();
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [copied, setCopied] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async () => {
      let session: DeviceLoginStart;
      try {
        session = await start(profile.id);
      } catch (e) {
        if (alive.current)
          setPhase({
            kind: "failed",
            message: e instanceof Error ? e.message : String(e),
          });
        return;
      }
      if (!alive.current) return;
      setPhase({ kind: "waiting", start: session });
      const deadline = Date.now() + session.expires_in * 1000;
      let interval = session.interval;

      const tick = async () => {
        if (!alive.current) return;
        if (Date.now() > deadline)
          return setPhase({ kind: "failed", message: t("expired") });
        try {
          const res = await poll(profile.id, session.handle);
          if (!alive.current) return;
          switch (res.status) {
            case "pending":
              break;
            case "slow_down":
              interval += 5;
              break;
            case "connected":
              void refreshProfiles();
              return setPhase({
                kind: "connected",
                account: res.account ?? "",
              });
            case "expired":
              return setPhase({ kind: "failed", message: t("expired") });
            case "denied":
              return setPhase({ kind: "failed", message: t("denied") });
            default:
              return setPhase({
                kind: "failed",
                message: res.message ?? t("failed"),
              });
          }
        } catch (e) {
          if (alive.current)
            setPhase({
              kind: "failed",
              message: e instanceof Error ? e.message : String(e),
            });
          return;
        }
        timer = setTimeout(tick, interval * 1000);
      };
      timer = setTimeout(tick, interval * 1000);
    };

    void run();
    return () => {
      alive.current = false;
      if (timer) clearTimeout(timer);
    };
    // attempt เปลี่ยน = ผู้ใช้กด "ลองใหม่" → เริ่ม session ใหม่
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id, attempt]);

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // clipboard ถูกบล็อก — ผู้ใช้ยังพิมพ์โค้ดเองได้
    }
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>
            {t("desc", { mailbox: profile.smtp.username })}
          </DialogDescription>
        </DialogHeader>

        {phase.kind === "starting" && (
          <div className="flex items-center gap-2 py-6 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t("starting")}
          </div>
        )}

        {phase.kind === "waiting" && (
          <div className="space-y-4 py-2">
            <ol className="text-muted-foreground list-decimal space-y-1 pl-5 text-sm">
              <li>{t("step1")}</li>
              <li>{t("step2")}</li>
              <li>{t("step3", { mailbox: profile.smtp.username })}</li>
            </ol>
            <div className="flex items-center justify-center gap-2">
              <code className="bg-muted rounded-md px-4 py-2 font-mono text-2xl tracking-widest">
                {phase.start.user_code}
              </code>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                aria-label={t("copy")}
                onClick={() => copyCode(phase.start.user_code)}
              >
                {copied ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
              </Button>
            </div>
            <Button asChild className="w-full">
              <a
                href={phase.start.verification_uri}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink className="size-4" aria-hidden="true" />
                {t("openMicrosoft")}
              </a>
            </Button>
            <p
              className="text-muted-foreground flex items-center justify-center gap-2 text-xs"
              aria-live="polite"
            >
              <Loader2 className="size-3 animate-spin" aria-hidden="true" />
              {t("waiting")}
            </p>
          </div>
        )}

        {phase.kind === "connected" && (
          <p className="text-success-ink py-6 text-sm" role="status">
            {t("connected", { account: phase.account })}
          </p>
        )}

        {phase.kind === "failed" && (
          <p className="text-destructive py-6 text-sm" role="alert">
            {phase.message}
          </p>
        )}

        <DialogFooter>
          {phase.kind === "failed" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setPhase({ kind: "starting" });
                setCopied(false);
                setAttempt((n) => n + 1);
              }}
            >
              {t("retry")}
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant={phase.kind === "connected" ? "default" : "outline"}
            onClick={() => onOpenChange(false)}
          >
            {phase.kind === "connected" ? tc("done") : tc("cancel")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
