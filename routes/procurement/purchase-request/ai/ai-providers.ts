import type { ComponentType } from "react";
import { Sparkle } from "lucide-react";
import {
  ClaudeIcon,
  ChatGptIcon,
  GeminiIcon,
  GoogleIcon,
  DeepseekIcon,
  GrokIcon,
} from "@/components/icons/provider-icons";

export type ProviderIcon = ComponentType<{ readonly className?: string }>;

const ICONS: Readonly<Record<string, ProviderIcon>> = {
  claude: ClaudeIcon,
  chatgpt: ChatGptIcon,
  gemini: GeminiIcon,
  deepseek: DeepseekIcon,
  grok: GrokIcon,
  google: GoogleIcon,
};

/** icon_key ที่ไม่รู้จัก (หรือ null) → Sparkle */
export function providerIcon(iconKey: string | null): ProviderIcon {
  return (iconKey && ICONS[iconKey]) || Sparkle;
}
