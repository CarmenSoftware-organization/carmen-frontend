import { useEffect } from "react";
import { createRoot } from "react-dom/client";
import { IntlProvider } from "use-intl";
import { LookupCombobox } from "@/components/lookup/lookup-combobox";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import en from "@/messages/en.json";
import "@/styles/globals.css";

const params = new URLSearchParams(location.search);
document.documentElement.classList.toggle(
  "dark",
  params.get("theme") === "dark",
);
const items = [
  { id: "short", label: "119991 — Bank clearing" },
  { id: "long", label: "QA-CC-03 — Food and Beverage Operations ".repeat(6) },
];
const cases = [
  { id: "empty", value: "" },
  { id: "selected", value: "short" },
  { id: "long", value: "long" },
  { id: "disabled", value: "short", disabled: true },
  { id: "loading", value: "", isLoading: true },
  { id: "error", value: "", error: "Select an account" },
];

export function Lookup({
  value,
  disabled,
  className,
  readOnly,
  isLoading,
  error,
}: {
  value: string;
  disabled?: boolean;
  className?: string;
  readOnly?: boolean;
  isLoading?: boolean;
  error?: string;
}) {
  return (
    <LookupCombobox
      value={value}
      disabled={disabled}
      className={className}
      readOnly={readOnly}
      isLoading={isLoading}
      error={error}
      items={items}
      getId={(item) => item.id}
      getLabel={(item) => item.label}
      onValueChange={() => {}}
    />
  );
}

function report(errors: string[]) {
  const result = document.getElementById("ui-layout-result")!;
  result.dataset.status = errors.length ? "fail" : "pass";
  result.textContent = JSON.stringify({
    viewport: { width: innerWidth, height: innerHeight },
    theme: document.documentElement.classList.contains("dark")
      ? "dark"
      : "light",
    errors,
  });
}

export function Fixture() {
  useEffect(() => {
    void (async () => {
      await document.fonts.ready;
      await new Promise<void>((resolve) => setTimeout(resolve, 100));
      const errors: string[] = [];
      const reference = document
        .querySelector("input")!
        .getBoundingClientRect().height;
      const containers =
        document.querySelectorAll<HTMLElement>("[data-ui-fill]");
      if (containers.length !== 12) errors.push("Expected twelve fill cases");
      containers.forEach((container) => {
        const trigger = container.querySelector("button");
        if (!trigger) {
          errors.push(`${container.dataset.uiFill}: missing trigger`);
          return;
        }
        const style = getComputedStyle(container);
        const expected =
          container.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        const rect = trigger.getBoundingClientRect();
        if (Math.abs(rect.width - expected) > 1)
          errors.push(
            `${container.dataset.uiFill}: width ${rect.width} must fill ${expected}`,
          );
        if (Math.abs(rect.height - reference) > 1)
          errors.push(
            `${container.dataset.uiFill}: height ${rect.height} differs from Input ${reference}`,
          );
        if (container.dataset.uiFill?.endsWith("disabled") && !trigger.disabled)
          errors.push(`${container.dataset.uiFill}: trigger is not disabled`);
        const label = trigger.querySelector("span");
        if (label && label.getBoundingClientRect().right > rect.right + 1)
          errors.push(`${container.dataset.uiFill}: label overflow`);
      });
      const compact = document.querySelector<HTMLElement>("[data-ui-compact]")!;
      if (
        compact.querySelector("button")!.getBoundingClientRect().width >=
        compact.clientWidth - 1
      )
        errors.push("Explicit compact override must remain compact");
      if (document.querySelector("[data-ui-readonly] button"))
        errors.push("Read-only lookup must be plain text");
      const inline = document.querySelector<HTMLElement>("[data-ui-inline]")!;
      const [lookup, action] = [...inline.querySelectorAll("button")].map(
        (button) => button.getBoundingClientRect(),
      );
      if (
        lookup.right > action.left ||
        action.right > inline.getBoundingClientRect().right + 1
      )
        errors.push("Inline lookup overlaps its sibling action or overflows");
      if (Math.abs(lookup.width - (inline.clientWidth - action.width - 8)) > 1)
        errors.push("Inline flex lookup does not fill the remaining space");
      if (document.documentElement.scrollWidth > innerWidth)
        errors.push("Page horizontal overflow");
      report(errors);
    })().catch((error: unknown) => report([String(error)]));
  }, []);

  return (
    <main className="space-y-4 p-4">
      <Input size="sm" aria-label="Height reference" />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {cases.map((item) => (
          <Field key={item.id} data-ui-fill={`field-${item.id}`}>
            <FieldLabel>{item.id}</FieldLabel>
            <Lookup {...item} />
          </Field>
        ))}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] table-fixed">
          <tbody>
            {cases.map((item) => (
              <tr key={item.id}>
                <td
                  className="w-1/2 px-3 py-2"
                  data-ui-fill={`table-${item.id}`}
                >
                  <Lookup
                    {...item}
                    className={
                      params.has("probe-shrink") && item.id === "empty"
                        ? "w-fit"
                        : undefined
                    }
                  />
                </td>
                <td className="px-3 py-2">
                  <Input size="sm" aria-label={`${item.id} adjacent input`} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div data-ui-compact>
        <Lookup value="short" className="w-fit" />
      </div>
      <div data-ui-inline className="flex min-w-0 items-center gap-2">
        <Lookup value="long" className="min-w-0 flex-1" />
        <Button size="sm">Add</Button>
      </div>
      <Field data-ui-readonly>
        <FieldLabel>Read only</FieldLabel>
        <Lookup value="short" readOnly />
      </Field>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <IntlProvider locale="en" messages={en}>
    <Fixture />
  </IntlProvider>,
);
