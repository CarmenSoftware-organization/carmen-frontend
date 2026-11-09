import { useTranslations } from "use-intl";
import { TriangleAlert } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import type { McpTokenScope } from "@/types/mcp-token";
import { MCP_SCOPE_GROUPS, getMcpScopeMessageKey } from "./mcp-token-scopes";

interface McpTokenScopePickerProps {
  readonly value: readonly McpTokenScope[];
  readonly onChange: (next: McpTokenScope[]) => void;
  readonly disabled?: boolean;
}

/** ช่องติ๊ก scope แยก 3 กลุ่ม (อ่าน / เขียน / API bridge) พร้อมคำอธิบายรายตัว */
export function McpTokenScopePicker({ value, onChange, disabled }: McpTokenScopePickerProps) {
  const t = useTranslations("profile.mcpTokens");

  const toggle = (scope: McpTokenScope, checked: boolean) => {
    const rest = value.filter((s) => s !== scope);
    onChange(checked ? [...rest, scope] : rest);
  };

  return (
    // text-foreground: Field ที่ invalid ทาสีแดงทั้งกลุ่ม — ให้แดงแค่ FieldError ไม่ใช่ชื่อ scope ทุกตัว
    <div className="text-foreground flex flex-col gap-4">
      {MCP_SCOPE_GROUPS.map((group) => (
        <fieldset key={group.key} className="flex flex-col gap-2">
          <legend className="text-foreground/80 mb-1 text-xs font-semibold">
            {t(`scopeGroup_${group.key}`)}
          </legend>
          {group.key !== "read" && (
            <p className="text-warning-ink flex items-start gap-1.5 text-micro">
              <TriangleAlert className="mt-px size-3 shrink-0" aria-hidden="true" />
              {t(`scopeGroupHint_${group.key}`)}
            </p>
          )}
          {group.scopes.map((scope) => {
            const id = `mcp_scope_${getMcpScopeMessageKey(scope)}`;
            return (
              <label key={scope} htmlFor={id} className="flex cursor-pointer items-start gap-2">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={value.includes(scope)}
                  disabled={disabled}
                  onCheckedChange={(checked) => toggle(scope, checked === true)}
                />
                <span className="flex flex-col">
                  <span className="text-xs font-medium">
                    {t(`scope_${getMcpScopeMessageKey(scope)}`)}{" "}
                    <code className="text-muted-foreground font-mono text-micro-legal">{scope}</code>
                  </span>
                  <span className="text-muted-foreground text-micro">
                    {t(`scopeDesc_${getMcpScopeMessageKey(scope)}`)}
                  </span>
                </span>
              </label>
            );
          })}
        </fieldset>
      ))}
    </div>
  );
}
