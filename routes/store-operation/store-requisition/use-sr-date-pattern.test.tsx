import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router";
import { IntlProvider } from "use-intl";
import { useForm } from "react-hook-form";
import type { ReactNode } from "react";
import en from "@/messages/en.json";
import { ApiError } from "@/lib/api-error";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";
import type { SrFormValues } from "./sr-form-schema";
import type { StoreRequisition } from "@/types/store-requisition";

/**
 * 422 ที่แปลว่า "ถามกลับ" ไม่ใช่ "พัง"
 *
 * backend ตีใบเบิกกลับด้วย `SR_DATE_PATTERN_REQUIRED` /
 * `SR_ISSUE_DATE_PATTERN_REQUIRED` เมื่อวันนี้อยู่นอกงวดบัญชีที่เปิดอยู่ทุกงวด
 * โดยตั้งใจให้ถามผู้ใช้แล้วยิงซ้ำพร้อมคำตอบ — ถ้าวันไหนโค้ดนี้กลายเป็น toast
 * เฉย ๆ ผู้ใช้จะตันสนิท กดกี่ครั้งก็ได้ 422 เดิม เทสต์นี้มีไว้กันวันนั้น
 */

const reportApiError = vi.fn();
vi.mock("@/lib/api-error-handler", () => ({
  reportApiError: (err: unknown) => reportApiError(err),
  skipsGlobalErrorToast: () => true,
}));

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU1" }));

// fetch ปลอมด้านล่างคืน object ของใบเบิกให้ทุก request รวม /user/profile ด้วย —
// ปล่อยไว้ useProfile จะอ่าน business_unit ที่ไม่มีแล้วพัง · งวด active ตั้งต่อเทสต์
// (ไม่มี currentPeriod = ไม่มีคำถามเรื่องวันที่)
let currentPeriod: { start_at: string; end_at: string } | undefined;
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ currentPeriod, dateFormat: "DD/MM/YYYY" }),
}));

type MutateOpts = {
  onSuccess?: (res: unknown) => void;
  onError?: (err: unknown) => void;
};

function fakeMutation() {
  const payloads: Record<string, unknown>[] = [];
  return {
    payloads,
    isPending: false,
    mutate: vi.fn((payload: Record<string, unknown>, opts?: MutateOpts) => {
      payloads.push(payload);
      opts?.onSuccess?.({});
    }),
    mutateAsync: vi.fn(async () => ({ data: { id: "sr-1" } })),
  };
}

const approveSr = fakeMutation();
const submitSr = fakeMutation();
const otherMutation = fakeMutation();

vi.mock("./use-sr", () => ({
  useCreateStoreRequisition: () => otherMutation,
  useUpdateStoreRequisition: () => otherMutation,
  useSubmitStoreRequisition: () => submitSr,
  useApproveStoreRequisition: () => approveSr,
  useIssueStoreRequisition: () => approveSr,
  useRejectStoreRequisition: () => otherMutation,
  useReviewStoreRequisition: () => otherMutation,
  useDeleteStoreRequisition: () => otherMutation,
}));

const { useSrFormActions } = await import("./use-sr-form-actions");

const catalogError = (appCode: string) =>
  new ApiError(
    "VALIDATION_ERROR",
    "dev fallback",
    422,
    false,
    undefined,
    "backend message",
    appCode,
  );

/** ตอบตามสคริปต์ทีละครั้ง — `null` = สำเร็จ */
function scriptMutation(
  mutation: ReturnType<typeof fakeMutation>,
  script: (ApiError | null)[],
) {
  mutation.mutate.mockImplementation(
    (payload: Record<string, unknown>, opts?: MutateOpts) => {
      mutation.payloads.push(payload);
      const err = script.shift();
      if (err) opts?.onError?.(err);
      else opts?.onSuccess?.({});
    },
  );
}

const scriptApprove = (script: (ApiError | null)[]) =>
  scriptMutation(approveSr, script);

const storeRequisition = {
  id: "sr-1",
  sr_no: "SR-0001",
  doc_version: 3,
  store_requisition_detail: [{ id: "d1" }],
} as unknown as StoreRequisition;

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return (
    <QueryClientProvider client={qc}>
      <IntlProvider locale="en" messages={en}>
        <MemoryRouter>{children}</MemoryRouter>
      </IntlProvider>
    </QueryClientProvider>
  );
}

function renderActions() {
  return renderHook(
    () => {
      const form = useForm<SrFormValues>({
        defaultValues: {
          items: [{ id: "d1", issued_qty: 2 }],
        } as unknown as SrFormValues,
      });
      return useSrFormActions({
        // dimension ปิดอยู่ — ตัวตรวจผ่านเสมอ
        lineDimensions: { validateBeforeSubmit: () => true } as never,
        form,
        storeRequisition,
        defaultValues: { items: [] } as unknown as SrFormValues,
        mode: "view",
        setMode: () => {},
      });
    },
    { wrapper },
  );
}

beforeEach(() => {
  setRuntimeConfigForTests({ BACKEND_URL: "", X_APP_ID: "app-test" });
  reportApiError.mockClear();
  currentPeriod = undefined;
  for (const m of [approveSr, submitSr]) {
    m.mutate.mockReset();
    m.payloads.length = 0;
  }
  // Response ใหม่ทุกครั้ง — body อ่านได้รอบเดียว และ submit ดึงใบสดหลัง save อีกรอบ
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ data: storeRequisition }), {
          status: 200,
        }),
    ),
  );
});

describe("issue blocked by the open-period question", () => {
  it("asks instead of toasting, then retries with the answer", async () => {
    scriptApprove([catalogError("SR_ISSUE_DATE_PATTERN_REQUIRED"), null]);

    const { result } = renderActions();
    act(() => result.current.handleIssue());

    await waitFor(() =>
      expect(result.current.datePattern?.field).toBe("issue_date_pattern"),
    );
    expect(reportApiError).not.toHaveBeenCalled();

    act(() => result.current.datePattern?.retry("today"));

    expect(approveSr.payloads).toHaveLength(2);
    expect(approveSr.payloads[0]).not.toHaveProperty("issue_date_pattern");
    // doc_version เดิม — รอบที่ถูกตีกลับไม่ได้แตะใบ ไม่ต้องไปดึงใหม่
    expect(approveSr.payloads[1]).toMatchObject({
      issue_date_pattern: "today",
      doc_version: 3,
    });
    await waitFor(() => expect(result.current.datePattern).toBeNull());
  });

  it("still reports any other error the normal way", async () => {
    scriptApprove([catalogError("SR_NOT_FOUND")]);

    const { result } = renderActions();
    act(() => result.current.handleIssue());

    await waitFor(() => expect(reportApiError).toHaveBeenCalledTimes(1));
    expect(result.current.datePattern).toBeNull();
  });
});

describe("submit asks for the date inside the submit dialog", () => {
  // งวดที่วันนี้ไม่มีทางอยู่ข้างใน / งวดที่ครอบวันนี้แน่ ๆ — ไม่ต้องแช่นาฬิกา
  const PAST_PERIOD = {
    start_at: "2000-01-01T00:00:00.000Z",
    end_at: "2000-01-31T00:00:00.000Z",
  };
  const WIDE_PERIOD = {
    start_at: "2000-01-01T00:00:00.000Z",
    end_at: "2100-12-31T00:00:00.000Z",
  };

  it("sends the pattern picked in the submit dialog on the first request", async () => {
    currentPeriod = PAST_PERIOD;
    scriptMutation(submitSr, [null]);

    const { result } = renderActions();
    expect(result.current.submitDatePatternPeriod).toEqual(PAST_PERIOD);

    act(() => result.current.setSubmitDatePattern("open-period"));
    await act(() => result.current.confirmSubmitSr());

    await waitFor(() => expect(submitSr.payloads).toHaveLength(1));
    expect(submitSr.payloads[0]).toMatchObject({
      id: "sr-1",
      sr_date_pattern: "open-period",
    });
    // ไม่มีกล่องที่สองเด้งตาม
    expect(result.current.datePattern).toBeNull();
  });

  it("asks nothing and sends no pattern while today is inside the period", async () => {
    currentPeriod = WIDE_PERIOD;
    scriptMutation(submitSr, [null]);

    const { result } = renderActions();
    expect(result.current.submitDatePatternPeriod).toBeUndefined();

    await act(() => result.current.confirmSubmitSr());

    await waitFor(() => expect(submitSr.payloads).toHaveLength(1));
    expect(submitSr.payloads[0]).not.toHaveProperty("sr_date_pattern");
  });

  it("falls back to the date dialog, alone, when the backend still asks", async () => {
    // profile ค้าง (เช่น เพิ่งปิดงวด) — FE คิดว่าวันนี้อยู่ในงวด แต่ backend ไม่
    currentPeriod = WIDE_PERIOD;
    scriptMutation(submitSr, [catalogError("SR_DATE_PATTERN_REQUIRED"), null]);

    const { result } = renderActions();
    act(() => result.current.setShowSubmit(true));
    await act(() => result.current.confirmSubmitSr());

    await waitFor(() =>
      expect(result.current.datePattern?.field).toBe("sr_date_pattern"),
    );
    expect(result.current.showSubmit).toBe(false);
    expect(reportApiError).not.toHaveBeenCalled();

    act(() => result.current.datePattern?.retry("today"));
    expect(submitSr.payloads[1]).toMatchObject({ sr_date_pattern: "today" });
  });
});
