import { describe, it, expect } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { useForm } from "react-hook-form";
import { IntlProvider } from "use-intl";
import en from "@/messages/en.json";
import { ApiError, ERROR_CODES } from "@/lib/api-error";
import { claimFieldError } from "@/lib/server-field-errors";
import { useServerFieldErrors } from "./use-server-field-errors";

const MESSAGE =
  "Invoice number E2E-2609-grnA is already used by GRN260900002 for this vendor";

const duplicate = () =>
  new ApiError(
    // ApiError.from แปลง 409 เป็น VALIDATION_ERROR (4xx ที่ไม่ใช่ 401/403/404/429)
    ERROR_CODES.VALIDATION_ERROR,
    "Failed to update GRN",
    409,
    false,
    undefined,
    MESSAGE,
    "GRN_INVOICE_NO_DUPLICATE",
    undefined,
    { invoice_no: "E2E-2609-grnA", grn_no: "GRN260900002" },
    4060036, // catalog id ตาม response จริงของ dev — มี id จึงใช้ข้อความ catalog
  );

function GrnLikeForm({
  disabled = false,
  showField = true,
}: {
  readonly disabled?: boolean;
  readonly showField?: boolean;
}) {
  const form = useForm<{ invoice_no: string }>({
    defaultValues: { invoice_no: "E2E-2609-grnA" },
  });
  useServerFieldErrors(form, { GRN_INVOICE_NO_DUPLICATE: "invoice_no" });
  const error = form.formState.errors.invoice_no;
  return (
    <form>
      {showField && (
        <input
          aria-label="Invoice No."
          disabled={disabled}
          {...form.register("invoice_no")}
        />
      )}
      {error && <p data-testid="field-error">{error.message}</p>}
    </form>
  );
}

const renderForm = (props: Parameters<typeof GrnLikeForm>[0] = {}) => {
  const ui = (p: Parameters<typeof GrnLikeForm>[0]) => (
    <IntlProvider locale="en" messages={en} timeZone="Asia/Bangkok">
      <GrnLikeForm {...p} />
    </IntlProvider>
  );
  const result = render(ui(props));
  return {
    rerender: (p: Parameters<typeof GrnLikeForm>[0]) => result.rerender(ui(p)),
  };
};

describe("useServerFieldErrors", () => {
  it("puts the server message on the field, focuses it and takes the error from the toast", async () => {
    renderForm();

    let claimed = false;
    act(() => {
      claimed = claimFieldError(duplicate());
    });

    expect(claimed).toBe(true);
    expect(await screen.findByTestId("field-error")).toHaveTextContent(MESSAGE);
    await waitFor(() =>
      expect(screen.getByLabelText("Invoice No.")).toHaveFocus(),
    );
  });

  // The wait for a field disabled by the pending save (focusWhenEnabled) is not covered here:
  // jsdom ends up focusing the field even with the old hook, so a test passes against the bug.
  // Verified in Chromium on the GRN page instead — old hook: focus stayed off the field, new: on it.

  it("leaves the error to the toast when the field is not on screen", () => {
    renderForm({ showField: false });

    expect(claimFieldError(duplicate())).toBe(false);
  });
});
