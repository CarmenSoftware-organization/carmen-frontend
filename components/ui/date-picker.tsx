import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useProfile } from "@/hooks/use-profile";
import { formatDate } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  readonly value?: string;
  readonly onValueChange?: (value: string) => void;
  readonly disabled?: boolean;
  readonly placeholder?: string;
  readonly className?: string;
  readonly fromDate?: Date;
  readonly toDate?: Date;
  readonly size?: "xs" | "sm" | "default";
  readonly includeTime?: boolean;
  readonly hideClear?: boolean;
  readonly invalid?: boolean;
  readonly readOnly?: boolean;
}

export function DatePicker({
  value,
  onValueChange,
  disabled,
  placeholder = "Pick a date",
  className,
  fromDate,
  toDate,
  size = "sm",
  includeTime,
  hideClear,
  invalid,
  readOnly,
}: DatePickerProps) {
  const { dateFormat, dateTimeFormat } = useProfile();
  const [open, setOpen] = useState(false);

  const selected = value ? new Date(value) : undefined;

  const displayFormat = includeTime ? dateTimeFormat : dateFormat;

  if (readOnly) {
    return (
      <span
        className={cn(
          "inline-flex min-h-8 items-center text-xs",
          !value && "text-muted-foreground",
          className,
        )}
      >
        {value ? formatDate(value, displayFormat) : "—"}
      </span>
    );
  }

  const handleSelect = (date: Date | undefined) => {
    if (!date) return;
    if (includeTime && selected) {
      date.setHours(selected.getHours(), selected.getMinutes());
    }
    onValueChange?.(date.toISOString());
    if (!includeTime) setOpen(false);
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const date = selected ? new Date(selected) : new Date();
    date.setHours(hours, minutes);
    onValueChange?.(date.toISOString());
  };

  const timeValue = selected
    ? `${String(selected.getHours()).padStart(2, "0")}:${String(selected.getMinutes()).padStart(2, "0")}`
    : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <div className="relative">
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            size={size}
            aria-invalid={invalid || undefined}
            className={cn(
              "bg-field justify-start font-normal",
              value && !disabled && !hideClear && "pr-7",
              !value && "text-muted-foreground",
              className,
            )}
          >
            <CalendarIcon />
            {value ? (
              formatDate(value, displayFormat)
            ) : (
              <span>{placeholder}</span>
            )}
          </Button>
        </PopoverTrigger>
        {value && !disabled && !hideClear && (
          <button
            type="button"
            className="absolute top-1/2 right-2 -translate-y-1/2 opacity-50 hover:opacity-100"
            onClick={() => onValueChange?.("")}
            aria-label="Clear"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          defaultMonth={selected}
          disabled={[
            ...(fromDate ? [{ before: fromDate }] : []),
            ...(toDate ? [{ after: toDate }] : []),
          ]}
        />
        {includeTime && (
          <div className="border-t px-3 py-2">
            <Input
              type="time"
              value={timeValue}
              onChange={handleTimeChange}
              className="h-8 text-xs"
              disabled={!selected}
            />
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
