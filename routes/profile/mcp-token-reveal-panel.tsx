import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { Check, Copy, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getRuntimeConfig } from "@/lib/runtime-config";
import type { McpTokenCreated } from "@/types/mcp-token";
import { buildMcpConfigSnippet } from "./mcp-config-snippet";

type CopyTarget = "token" | "snippet";

interface McpTokenRevealPanelProps {
  readonly created: McpTokenCreated;
  readonly onDone: () => void;
}

/** แสดงโทเค็นดิบ + snippet ครั้งเดียว — ค่าอยู่ใน props/state ของ dialog เท่านั้น */
export function McpTokenRevealPanel({ created, onDone }: McpTokenRevealPanelProps) {
  const t = useTranslations("profile.mcpTokens");
  const [copied, setCopied] = useState<CopyTarget | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const snippet = buildMcpConfigSnippet(getRuntimeConfig().BACKEND_URL, created.token);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const copy = async (target: CopyTarget, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(target);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => setCopied((c) => (c === target ? null : c)), 1500);
    } catch {
      // clipboard ถูกบล็อก (เช่น http ไม่ใช่ https) — ให้ผู้ใช้เลือกข้อความเอง
      toast.error(t("copyFailed"));
    }
  };

  const copyButton = (target: CopyTarget, text: string) => (
    <Button type="button" variant="outline" size="sm" onClick={() => void copy(target, text)}>
      {copied === target ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
      {copied === target ? t("copied") : t("copy")}
    </Button>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted text-warning-ink flex items-start gap-2 rounded-md border p-3 text-sm">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>{t("revealWarning")}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">{t("tokenLabel")}</span>
          {copyButton("token", created.token)}
        </div>
        <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 text-xs break-all whitespace-pre-wrap select-all">
          <code className="font-mono">{created.token}</code>
        </pre>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-xs font-medium">{t("snippetTitle")}</span>
          {copyButton("snippet", snippet)}
        </div>
        <pre className="bg-muted/40 overflow-x-auto rounded-md border p-3 text-xs select-all">
          <code className="font-mono">{snippet}</code>
        </pre>
        <p className="text-muted-foreground text-xs">{t("snippetHint")}</p>
      </div>

      <div className="flex justify-end pt-2">
        <Button type="button" onClick={onDone}>
          {t("done")}
        </Button>
      </div>
    </div>
  );
}
