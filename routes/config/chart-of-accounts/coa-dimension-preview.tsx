import { useState } from "react";
import { useTranslations } from "use-intl";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { useGlDimensionValues } from "@/hooks/use-gl-dimensions";
import type { DimensionMaster } from "@/types/accounting-master";
import { CoaMultiSelect } from "./coa-multi-select";

import {
  updateAllowedValues,
  type DimensionPreview,
} from "./coa-dimension-preview-state";

export function CoaDimensionPreview({
  dimension,
  value,
  onChange,
  readOnly,
}: {
  dimension: DimensionMaster;
  value: DimensionPreview;
  onChange: (value: DimensionPreview) => void;
  readOnly: boolean;
}) {
  const t = useTranslations("config.chartOfAccounts.dimensionPreview");
  const [open, setOpen] = useState(false);
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0">
      <div className="min-w-0 text-xs">
        <span className="mr-2 font-mono font-medium">{dimension.code}</span>
        <span className="break-words">{dimension.name}</span>
        <p className="text-micro text-muted-foreground mt-1">
          {t("summary", {
            count: value.allowedValueIds.length,
            hasDefault: value.defaultValueId ? "yes" : "no",
          })}
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
      >
        <Settings2 className="size-3.5" />
        {t("configure")}
      </Button>
      {open && (
        <DimensionPreviewDialog
          dimension={dimension}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function DimensionPreviewDialog({
  dimension,
  value,
  onChange,
  readOnly,
  onClose,
}: {
  dimension: DimensionMaster;
  value: DimensionPreview;
  onChange: (value: DimensionPreview) => void;
  readOnly: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("config.chartOfAccounts.dimensionPreview");
  const [draft, setDraft] = useState(value);
  const isLookup = !dimension.data_type || dimension.data_type === "lookup";
  const query = useGlDimensionValues(isLookup);
  const selectedIds = new Set([
    ...draft.allowedValueIds,
    ...(draft.defaultValueId ? [draft.defaultValueId] : []),
  ]);
  const options = (query.data ?? [])
    .filter(
      (item) =>
        item.dimension_id === dimension.id &&
        (item.is_active || selectedIds.has(item.id)),
    )
    .map((item) => ({ value: item.id, code: item.code, name: item.name }));
  const allowedSet = new Set(draft.allowedValueIds);
  const defaults = draft.allowedValueIds.length
    ? options.filter((item) => allowedSet.has(item.value))
    : options;
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("title", { name: dimension.name })}</DialogTitle>
          <DialogDescription>{t("previewNotice")}</DialogDescription>
        </DialogHeader>
        {!isLookup ? (
          <p className="text-muted-foreground text-xs">{t("listOnly")}</p>
        ) : query.isError ? (
          <div role="alert" className="space-y-2 text-xs">
            <p className="text-destructive">{t("loadError")}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
            >
              {t("retry")}
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <Field>
              <FieldLabel>{t("allowedValues")}</FieldLabel>
              <CoaMultiSelect
                label={t("allowedValues")}
                options={options}
                value={draft.allowedValueIds}
                onChange={(ids) => setDraft(updateAllowedValues(draft, ids))}
                disabled={query.isLoading}
                readOnly={readOnly}
              />
              <p className="text-micro text-muted-foreground">
                {t("allValuesNote")}
              </p>
            </Field>
            <Field>
              <FieldLabel>{t("defaultValue")}</FieldLabel>
              <CoaMultiSelect
                single
                label={t("defaultValue")}
                options={defaults}
                value={draft.defaultValueId ? [draft.defaultValueId] : []}
                onChange={(ids) =>
                  setDraft({ ...draft, defaultValueId: ids[0] ?? null })
                }
                disabled={query.isLoading}
                readOnly={readOnly}
              />
              <p className="text-micro text-muted-foreground">
                {t("defaultNote")}
              </p>
            </Field>
          </div>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("close")}
          </Button>
          {!readOnly && isLookup && (
            <Button
              type="button"
              size="sm"
              disabled={query.isLoading || query.isError}
              onClick={() => {
                onChange(draft);
                onClose();
              }}
            >
              {t("applyPreview")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
