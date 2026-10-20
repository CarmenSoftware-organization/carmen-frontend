import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClientProvider, useMutation } from "@tanstack/react-query";
import { IntlProvider } from "use-intl";
import { toast } from "sonner";
import en from "@/messages/en.json";
import { ApiError, ERROR_CODES } from "@/lib/api-error";
import { makeQueryClient } from "./providers";
import { ApiErrorToaster } from "./api-error-toaster";

vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());

function renderFailingMutation(error: unknown, meta?: Record<string, unknown>) {
  const queryClient = makeQueryClient();
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <IntlProvider locale="en" messages={en} timeZone="Asia/Bangkok">
        <ApiErrorToaster />
        {children}
      </IntlProvider>
    </QueryClientProvider>
  );

  const { result } = renderHook(
    () =>
      useMutation({
        mutationFn: async () => {
          throw error;
        },
        meta,
      }),
    { wrapper },
  );
  result.current.mutate(undefined);
  return result;
}

const apiError = (
  code: (typeof ERROR_CODES)[keyof typeof ERROR_CODES],
  status?: number,
) => new ApiError(code, "Failed to fetch comments", status);

describe("ApiErrorToaster", () => {
  it("translates a network failure instead of showing the dev's string", async () => {
    renderFailingMutation(apiError(ERROR_CODES.NETWORK_ERROR));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      en.errors.network,
      expect.anything(),
    );
    // the hardcoded English fallback must never reach the user
    expect(toast.error).not.toHaveBeenCalledWith(
      "Failed to fetch comments",
      expect.anything(),
    );
  });

  // ข้อความจาก backend ไม่ถูกส่งต่อให้ผู้ใช้ — มันเป็นภาษาอังกฤษของ dev บ้าง
  // stack trace ของ Prisma บ้าง อ่านไม่รู้เรื่องทั้งคู่ (ดู lib/error-message.ts)
  it("uses our own wording instead of the backend 4xx message", async () => {
    renderFailingMutation(
      new ApiError(
        ERROR_CODES.VALIDATION_ERROR,
        "Failed to create location",
        400,
        false,
        undefined,
        "This code is already in use",
      ),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [message] = vi.mocked(toast.error).mock.calls[0];
    expect(message).not.toBe("This code is already in use");
    expect(message).not.toBe("Failed to create location");
  });

  // toast เป็นประโยคเดียว ไม่มี description — รายละเอียดดิบอยู่ใน console เท่านั้น
  it("ขึ้นบรรทัดเดียว ค้าง 5 วิ ไม่มีรายละเอียดทางเทคนิคห้อยท้าย", async () => {
    renderFailingMutation(
      new ApiError(ERROR_CODES.INTERNAL_ERROR, "boom", 500),
    );

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    const [, options] = vi.mocked(toast.error).mock.calls[0];
    expect(options).toEqual({ duration: 8000 });
  });

  // 401/403 already redirect to login / open PermissionDeniedDialog — a toast
  // on top is noise the user cannot act on.
  it.each([
    ["401", ERROR_CODES.UNAUTHORIZED],
    ["403", ERROR_CODES.FORBIDDEN],
  ])("stays quiet for %s, which has its own UI", async (_label, code) => {
    const result = renderFailingMutation(apiError(code));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("stays quiet when the mutation opts out via meta", async () => {
    const result = renderFailingMutation(
      apiError(ERROR_CODES.INTERNAL_ERROR, 500),
      { skipGlobalErrorToast: true },
    );

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("still toasts a mutation whose meta says nothing about toasts", async () => {
    renderFailingMutation(apiError(ERROR_CODES.TIMEOUT), { other: true });

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith(
      en.errors.timeout,
      expect.anything(),
    );
  });
});
