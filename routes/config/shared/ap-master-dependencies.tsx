import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "use-intl";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DeleteDialog } from "@/components/ui/delete-dialog";
import { StatusSwitch } from "@/components/ui/status-switch";
import { Field, FieldLabel, FieldPlainText } from "@/components/ui/field";
import { StatusBadge } from "@/components/ui/status-badge";
import { useBuCode } from "@/hooks/use-bu-code";
import { reportApiError } from "@/lib/api-error-handler";
import type {
  ApMasterBase,
  ApMasterDependencies,
} from "@/types/accounting-master";
import { dependencyDetails, readMasterDependencies } from "./ap-master-crud";

export function MasterDependencyDialog({
  dependencies,
  onClose,
}: {
  readonly dependencies?: ApMasterDependencies;
  readonly onClose: () => void;
}) {
  const t = useTranslations("config.apMaster");
  const tc = useTranslations("common");
  return (
    <Dialog open={!!dependencies} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("dependencyTitle")}</DialogTitle>
          <DialogDescription>{t("dependencyDescription")}</DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-xs">
          {dependencies?.references.map((reference) => (
            <li className="flex justify-between gap-3" key={reference.type}>
              <div>
                <span>
                  {t.has(`referenceTypes.${reference.type}`)
                    ? t(`referenceTypes.${reference.type}`)
                    : t("otherReferences")}
                </span>
                {reference.names?.map((name) => (
                  <p className="text-muted-foreground mt-1" key={name}>
                    {name}
                  </p>
                ))}
              </div>
              <span className="tabular-nums">{reference.count}</span>
            </li>
          ))}
        </ul>
        <DialogFooter>
          <Button size="sm" variant="outline" onClick={onClose}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MasterStatusField({
  entity,
  value,
  onChange,
  disabled,
  readOnly,
  endpoint,
}: {
  readonly entity?: ApMasterBase | null;
  readonly value: boolean;
  readonly onChange: (value: boolean) => void;
  readonly disabled: boolean;
  readonly readOnly?: boolean;
  readonly endpoint: (bu: string) => string;
}) {
  const bu = useBuCode();
  const [checking, setChecking] = useState(false);
  const [blocked, setBlocked] = useState<ApMasterDependencies>();
  const tf = useTranslations("field");
  async function change(next: boolean) {
    if (disabled || checking) return;
    if (next || !entity?.is_active) {
      onChange(next);
      return;
    }
    if (!bu) return;
    setChecking(true);
    try {
      const dependencies = await readMasterDependencies(
        endpoint(bu),
        entity.id,
      );
      if (dependencies.can_deactivate) onChange(false);
      else setBlocked(dependencies);
    } catch (error) {
      reportApiError(error);
    } finally {
      setChecking(false);
    }
  }
  if (readOnly)
    return (
      <Field>
        <FieldLabel>{tf("status")}</FieldLabel>
        <FieldPlainText>
          <StatusBadge active={value} />
        </FieldPlainText>
      </Field>
    );
  return (
    <>
      <StatusSwitch
        checked={value}
        onCheckedChange={(next) => void change(next)}
        disabled={disabled || checking}
      />
      <MasterDependencyDialog
        dependencies={blocked}
        onClose={() => setBlocked(undefined)}
      />
    </>
  );
}

export function MasterDeleteDialog({
  target,
  open,
  onOpenChange,
  endpoint,
  remove,
  isPending,
  error,
  reset,
}: {
  readonly target: ApMasterBase | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly endpoint: (bu: string) => string;
  readonly remove: (
    target: { id: string; doc_version: number },
    options: { onSuccess: () => void },
  ) => void;
  readonly isPending: boolean;
  readonly error: unknown;
  readonly reset: () => void;
}) {
  const bu = useBuCode();
  const t = useTranslations("config.apMaster");
  const tc = useTranslations("common");
  const query = useQuery({
    queryKey: [
      "ap-master-dependencies",
      endpoint(bu ?? ""),
      target?.id,
      target?.doc_version,
    ],
    enabled: open && !!bu && !!target,
    queryFn: () => readMasterDependencies(endpoint(bu!), target!.id),
    staleTime: 0,
  });
  const blocked =
    dependencyDetails(error) ??
    (query.data?.can_delete === false ? query.data : undefined);
  const close = () => {
    if (!isPending) {
      reset();
      onOpenChange(false);
    }
  };
  if (blocked)
    return <MasterDependencyDialog dependencies={blocked} onClose={close} />;
  if (open && query.error)
    return (
      <Dialog open onOpenChange={(next) => !next && close()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("dependencyCheckFailed")}</DialogTitle>
            <DialogDescription>{t("dependencyCheckFailed")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button size="sm" variant="outline" onClick={close}>
              {tc("close")}
            </Button>
            <Button size="sm" onClick={() => void query.refetch()}>
              {tc("retry")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  return (
    <DeleteDialog
      open={open}
      onOpenChange={(next) => !next && close()}
      title={t("deleteTitle")}
      description={
        query.error
          ? t("dependencyCheckFailed")
          : t("deleteConfirm", { name: target?.code ?? "" })
      }
      isPending={isPending || query.isFetching}
      onConfirm={() => {
        if (target && query.data?.can_delete && !query.isFetching)
          remove(
            { id: target.id, doc_version: target.doc_version },
            {
              onSuccess: () => {
                toast.success(t("deleteSuccess"));
                close();
              },
            },
          );
      }}
    />
  );
}
