import { useEffect, useState } from "react";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import type { McpTokenCreated } from "@/types/mcp-token";
import { useCreateMcpToken } from "./use-mcp-tokens";
import {
  EMPTY_MCP_TOKEN_FORM,
  createMcpTokenSchema,
  type McpTokenFormValues,
} from "./mcp-token-form-schema";
import { McpTokenRevealPanel } from "./mcp-token-reveal-panel";

interface McpTokenCreateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
}

/** ฟอร์มสร้างโทเค็น → เมื่อสำเร็จสลับเป็นหน้าจอเปิดเผยโทเค็นครั้งเดียว */
export function McpTokenCreateDialog({ open, onOpenChange }: McpTokenCreateDialogProps) {
  const t = useTranslations("profile.mcpTokens");
  const tc = useTranslations("common");
  const tv = useTranslations("validation");
  const createToken = useCreateMcpToken();
  const [created, setCreated] = useState<McpTokenCreated | null>(null);

  const form = useForm<McpTokenFormValues>({
    resolver: zodResolver(createMcpTokenSchema(tv, t)) as Resolver<McpTokenFormValues>,
    defaultValues: EMPTY_MCP_TOKEN_FORM,
  });

  useEffect(() => {
    if (open) {
      form.reset(EMPTY_MCP_TOKEN_FORM);
    }
  }, [open, form]);

  // ปิดทางไหนก็ตาม (Done, overlay, Esc) ต้องล้างโทเค็นดิบออกจาก state เสมอ
  const handleOpenChange = (next: boolean) => {
    if (createToken.isPending) return;
    if (!next) {
      setCreated(null);
      createToken.reset();
      form.reset(EMPTY_MCP_TOKEN_FORM);
    }
    onOpenChange(next);
  };

  const onSubmit = (values: McpTokenFormValues) => {
    createToken.mutate(values, {
      onSuccess: (data) => {
        toast.success(t("created"));
        setCreated(data);
      },
      // 409 ครบ 10 ใบ: toast มาจาก MutationCache กลาง (preferServerMessage) — ปิดฟอร์มให้ผู้ใช้ไปเพิกถอนใบเก่า
      onError: (error) => {
        if (error.statusCode === 409) handleOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="border-border/60 bg-background gap-6 rounded-xl border p-6 shadow-md sm:max-w-[520px] sm:rounded-2xl"
        showCloseButton={false}
      >
        <div className="flex flex-col gap-5">
          <div className="flex flex-col">
            <DialogTitle className="text-foreground font-semibold tracking-tight">
              {created ? t("revealTitle") : t("create")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-0.5 text-xs">
              {created ? created.name : t("description")}
            </DialogDescription>
          </div>

          {open && created ? (
            <McpTokenRevealPanel created={created} onDone={() => handleOpenChange(false)} />
          ) : (
            <form id="mcp-token-create-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
              <FieldGroup className="gap-4">
                <Field data-invalid={!!form.formState.errors.name}>
                  <FieldLabel htmlFor="mcp_token_name" required className="text-foreground/80 mb-1.5 font-medium">
                    {t("name")}
                  </FieldLabel>
                  <Input
                    id="mcp_token_name"
                    placeholder={t("namePlaceholder")}
                    maxLength={100}
                    autoFocus
                    disabled={createToken.isPending}
                    aria-invalid={!!form.formState.errors.name}
                    {...form.register("name")}
                  />
                  <FieldError className="mt-1">{form.formState.errors.name?.message}</FieldError>
                </Field>
              </FieldGroup>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} disabled={createToken.isPending}>
                  {tc("cancel")}
                </Button>
                <Button type="submit" form="mcp-token-create-form" disabled={createToken.isPending}>
                  {createToken.isPending ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      {t("creating")}
                    </>
                  ) : (
                    t("create")
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
