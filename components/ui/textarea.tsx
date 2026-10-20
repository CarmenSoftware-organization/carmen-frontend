import * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({
  className,
  maxLength,
  ref: forwardedRef,
  ...props
}: React.ComponentProps<"textarea">) {
  const [length, setLength] = React.useState(0);
  const innerRef = React.useRef<HTMLTextAreaElement | null>(null);
  const showCounter = maxLength != null;

  const handleRef = React.useCallback(
    (el: HTMLTextAreaElement | null) => {
      innerRef.current = el;
      if (el && showCounter) setLength(el.value.length);
      if (typeof forwardedRef === "function") forwardedRef(el);
      else if (forwardedRef) forwardedRef.current = el;
    },
    [forwardedRef, showCounter],
  );

  const textareaElement = (
    <textarea
      ref={showCounter ? handleRef : forwardedRef}
      data-slot="textarea"
      maxLength={maxLength}
      className={cn(
        "border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive bg-field flex field-sizing-content min-h-16 w-full rounded-md border px-3 py-2 text-xs transition-[color,box-shadow] outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
        showCounter && "pb-5",
        className,
      )}
      {...props}
      onFocus={(e: React.FocusEvent<HTMLTextAreaElement>) => {
        e.currentTarget.select();
        if (showCounter) setLength(e.currentTarget.value.length);
        props.onFocus?.(e);
      }}
      {...(showCounter && {
        onInput: (e: React.InputEvent<HTMLTextAreaElement>) => {
          setLength(e.currentTarget.value.length);
          props.onInput?.(e);
        },
      })}
    />
  );

  if (!showCounter) return textareaElement;

  return (
    <div className="relative">
      {textareaElement}
      <span className="text-micro-eyebrow text-muted-foreground/60 pointer-events-none absolute right-2 bottom-1.5 tabular-nums">
        {length}/{maxLength}
      </span>
    </div>
  );
}

export { Textarea };
