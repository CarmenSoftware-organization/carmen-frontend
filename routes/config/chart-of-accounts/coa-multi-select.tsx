import { useId, useMemo, useState } from "react";
import { ChevronsUpDown, X } from "lucide-react";
import { useTranslations } from "use-intl";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { VirtualCommandList } from "@/components/ui/virtual-command-list";

export interface CoaSelectOption {
  value: string;
  code: string;
  name: string;
}

export function CoaMultiSelect({
  label,
  options,
  value,
  onChange,
  disabled,
  readOnly,
  single,
}: {
  label: string;
  options: CoaSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
  readOnly?: boolean;
  single?: boolean;
}) {
  const t = useTranslations("config.chartOfAccounts.selection");
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const listId = useId();
  const selected = useMemo(() => new Set(value), [value]);
  const allOptions = useMemo(() => {
    const known = new Set(options.map((option) => option.value));
    return [
      ...options,
      ...value
        .filter((id) => !known.has(id))
        .map((id) => ({ value: id, code: id, name: t("unavailable") })),
    ];
  }, [options, value, t]);
  const optionMap = useMemo(
    () => new Map(allOptions.map((option) => [option.value, option])),
    [allOptions],
  );
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return allOptions.filter(
      (option) =>
        ((!readOnly && !selectedOnly) || selected.has(option.value)) &&
        `${option.code} ${option.name}`.toLocaleLowerCase().includes(query),
    );
  }, [allOptions, readOnly, selectedOnly, selected, search]);

  const toggle = (id: string) => {
    if (readOnly || disabled) return;
    onChange(
      single
        ? selected.has(id)
          ? []
          : [id]
        : selected.has(id)
          ? value.filter((item) => item !== id)
          : [...value, id],
    );
    if (single) setOpen(false);
  };

  return (
    <div className="min-w-0 space-y-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setSearch("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-label={label}
            aria-expanded={open}
            aria-controls={listId}
            disabled={disabled}
            className="w-full min-w-0 justify-between text-xs"
          >
            <span className="truncate">
              {single && value.length
                ? `${optionMap.get(value[0])?.code ?? value[0]} · ${optionMap.get(value[0])?.name ?? ""}`
                : value.length
                  ? t("selectedCount", { count: value.length })
                  : t(single ? "noDefault" : "placeholder")}
            </span>
            <ChevronsUpDown className="text-muted-foreground size-3.5 shrink-0" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-(--radix-popover-trigger-width) max-w-[calc(100vw-2rem)] min-w-64 p-0"
        >
          <div className="space-y-2 border-b p-2">
            <Input
              aria-label={t("searchLabel", { label })}
              placeholder={t("searchPlaceholder")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 text-xs"
            />
            <div className="text-micro text-muted-foreground flex flex-wrap items-center justify-between gap-2">
              <span aria-live="polite">
                {t("resultsCount", { count: filtered.length })}
              </span>
              {!readOnly && !single && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  aria-pressed={selectedOnly}
                  onClick={() => setSelectedOnly(!selectedOnly)}
                >
                  {t(selectedOnly ? "showAll" : "showSelected", {
                    count: value.length,
                  })}
                </Button>
              )}
              {!readOnly && single && value.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange([]);
                    setOpen(false);
                  }}
                >
                  {t("clearDefault")}
                </Button>
              )}
            </div>
          </div>
          <div id={listId} role="group" aria-label={label}>
            <VirtualCommandList
              items={filtered}
              maxHeight={240}
              estimateSize={36}
              measureRows
              emptyMessage={t("noResults")}
            >
              {(option) => (
                <label className="hover:bg-accent flex min-w-0 cursor-pointer items-start gap-2 rounded-sm px-2 py-2 text-xs">
                  <Checkbox
                    aria-label={`${option.code} — ${option.name}`}
                    checked={selected.has(option.value)}
                    disabled={readOnly}
                    onCheckedChange={() => toggle(option.value)}
                    className="mt-0.5 shrink-0"
                  />
                  <span className="min-w-0 break-words">
                    <span className="mr-2 font-mono font-medium">
                      {option.code}
                    </span>
                    {option.name}
                  </span>
                </label>
              )}
            </VirtualCommandList>
          </div>
        </PopoverContent>
      </Popover>
      {!single && value.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {value.slice(0, 3).map((id) => (
            <Badge
              key={id}
              variant="secondary"
              size="sm"
              className="max-w-full gap-1.5"
            >
              <span className="truncate" title={optionMap.get(id)?.name}>
                {optionMap.get(id)?.code ?? id}
              </span>
              {!readOnly && !disabled && (
                <button
                  type="button"
                  aria-label={t("remove", {
                    code: optionMap.get(id)?.code ?? id,
                  })}
                  onClick={() => toggle(id)}
                  className="focus-visible:outline-ring rounded-sm focus-visible:outline-2"
                >
                  <X className="size-3" />
                </button>
              )}
            </Badge>
          ))}
          {value.length > 3 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onClick={() => {
                setSelectedOnly(true);
                setOpen(true);
              }}
            >
              +{value.length - 3}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
