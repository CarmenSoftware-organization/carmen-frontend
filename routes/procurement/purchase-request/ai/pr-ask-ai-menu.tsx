import { Sparkle } from "lucide-react";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { providerIcon } from "@/components/icons/provider-icons";
import {
  buildPrAiQuery,
  buildProviderUrl,
  type PrAiQueryItem,
} from "./build-pr-ai-query";
import { useAskAiProviders, type AskAiProvider } from "./use-ask-ai-providers";

interface PrAskAiMenuProps {
  readonly items: readonly PrAiQueryItem[];
  readonly disabled?: boolean;
}

export function PrAskAiMenu({ items, disabled }: PrAskAiMenuProps) {
  const t = useTranslations("procurement.purchaseRequest");
  const { data: providers, isLoading, isError } = useAskAiProviders();

  if (providers && providers.length === 0) return null;

  const handlePick = (provider: AskAiProvider) => {
    const query = buildPrAiQuery(provider.prompt, items);
    const { url, copy } = buildProviderUrl(provider.url_template, query);
    if (copy && navigator.clipboard) {
      navigator.clipboard
        .writeText(query)
        .then(() =>
          toast.success(t("askAiCopied", { provider: provider.label })),
        )
        .catch(() => toast.error(t("askAiCopyFailed")));
    }
    if (!url.startsWith("https://")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLoading || isError || !providers}
        >
          <Sparkle />
          {t("askAi")}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        {(providers ?? []).map((provider) => {
          const Icon = providerIcon(provider.icon_key);
          return (
            <DropdownMenuItem
              key={provider.code}
              onClick={() => handlePick(provider)}
            >
              {provider.icon_url ? (
                <img
                  src={provider.icon_url}
                  className="size-3.5"
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <Icon className="size-3.5" />
              )}
              {provider.label}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
