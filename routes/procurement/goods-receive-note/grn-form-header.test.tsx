import { describe, it, expect, vi } from "vitest";
import { useEffect } from "react";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useForm } from "react-hook-form";
import en from "@/messages/en.json";
import { renderForm } from "@/lib/test-utils/form-characterization";
import type { GrnFormValues } from "./grn-form-schema";
import { GrnFormHeader } from "./grn-form-header";

// lookup ทั้งสามยิง API เอง — ไม่เกี่ยวกับช่องเลขใบแจ้งหนี้ ตัดทิ้ง
vi.mock("@/components/lookup/lookup-vendor", () => ({
  LookupVendor: () => null,
}));
vi.mock("@/components/lookup/lookup-currency", () => ({
  LookupCurrency: () => null,
}));
vi.mock("@/components/lookup/lookup-credit-term", () => ({
  LookupCreditTerm: () => null,
}));

const MESSAGE = "Invoice no. INV-001 is already used on GRN26100001";

function Harness() {
  // form เป็น reference เดิมตลอด — ไม่ปิด compiler แล้ว JSX ข้างล่างถูกแช่ ลูกไม่เห็น error ใหม่
  // (grn-form ตัวจริงก็ "use no memo" ด้วยเหตุผลเดียวกับ GrnFormHeader)
  "use no memo";
  const form = useForm<GrnFormValues>({
    defaultValues: { invoice_no: "INV-001" } as GrnFormValues,
  });
  const { setError } = form;
  // useServerFieldErrors ตั้ง error แบบนี้เมื่อ backend ตีกลับ GRN_INVOICE_NO_DUPLICATE
  useEffect(() => {
    setError("invoice_no", { type: "server", message: MESSAGE });
  }, [setError]);
  return <GrnFormHeader form={form} disabled={false} />;
}

describe("GrnFormHeader — เลขใบแจ้งหนี้ซ้ำจาก backend", () => {
  it("กรอบแดง + ไอคอน ไม่มีข้อความใต้ช่อง · hover แล้วเห็นข้อความ", async () => {
    renderForm(<Harness />);
    const input = screen.getByPlaceholderText(
      en.procurement.goodsReceiveNote.invoiceNoPlaceholder,
    );

    await waitFor(() => expect(input).toHaveAttribute("aria-invalid", "true"));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText(MESSAGE)).toBeNull();

    await userEvent.hover(input);
    expect(await screen.findByRole("tooltip")).toHaveTextContent(MESSAGE);
  });
});
