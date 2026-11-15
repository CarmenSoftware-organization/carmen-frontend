import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { IntlProvider } from "use-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import en from "@/messages/en.json";
import { DEFAULT_ATTACHMENT_POLICY } from "@/lib/attachment-policy";
import { httpClient } from "@/lib/http-client";
import { ApAttachmentsPanel } from "./ap-attachments";
import { useApAttachments } from "./use-ap-attachments";

vi.mock("@/hooks/use-bu-code", () => ({ useBuCode: () => "BU" }));
vi.mock("@/hooks/use-profile", () => ({
  useProfile: () => ({ dateFormat: "yyyy-MM-dd" }),
}));
vi.mock("@/hooks/use-attachment-policy", () => ({
  useAttachmentPolicy: () => DEFAULT_ATTACHMENT_POLICY,
}));
vi.mock("@/lib/http-client", () => ({
  httpClient: { post: vi.fn(), get: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
const wrapper = ({ children }: { children: ReactNode }) => (
  <IntlProvider locale="en" messages={en}>
    {children}
  </IntlProvider>
);

describe("AP attachment save lifecycle", () => {
  beforeEach(() => vi.resetAllMocks());

  it("uploads only on save and retries only failed uploads while preserving deleted-file history", async () => {
    const deleted = {
      deleted: true as const,
      deleted_at: "2026-11-15",
      deleted_by_id: null,
    };
    const { result } = renderHook(() => useApAttachments([deleted]), {
      wrapper,
    });
    act(() =>
      result.current.add([
        new File(["a"], "a.pdf", { type: "application/pdf" }),
        new File(["b"], "b.pdf", { type: "application/pdf" }),
      ]),
    );
    expect(httpClient.post).not.toHaveBeenCalled();
    vi.mocked(httpClient.post)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ data: { fileToken: "BU/a" } })),
      )
      .mockRejectedValueOnce(new Error("storage unavailable"));
    await act(async () => {
      await expect(result.current.prepare()).rejects.toThrow(
        "storage unavailable",
      );
    });
    vi.mocked(httpClient.post).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { fileToken: "BU/b" } })),
    );
    await act(async () => {
      expect(await result.current.prepare()).toEqual([
        deleted,
        {
          originalName: "a.pdf",
          fileToken: "BU/a",
          contentType: "application/pdf",
        },
        {
          originalName: "b.pdf",
          fileToken: "BU/b",
          contentType: "application/pdf",
        },
      ]);
    });
    expect(httpClient.post).toHaveBeenCalledTimes(3);
    expect(
      (vi.mocked(httpClient.post).mock.calls[2][1] as FormData).get("file"),
    ).toHaveProperty("name", "b.pdf");
    act(() => result.current.reset());
    expect(result.current.attachments).toEqual([deleted]);
    expect(result.current.files).toEqual([]);
  });

  it("keeps disallowed files out of the staged payload", () => {
    function Panel() {
      const state = useApAttachments();
      return <ApAttachmentsPanel state={state} editable disabled={false} />;
    }
    render(<Panel />, { wrapper });
    fireEvent.change(screen.getByLabelText("Attach files"), {
      target: {
        files: [
          new File(["payload"], "bad.exe", {
            type: "application/x-msdownload",
          }),
        ],
      },
    });
    expect(screen.queryByText("bad.exe")).not.toBeInTheDocument();
    expect(httpClient.post).not.toHaveBeenCalled();
  });

  it("reuses prepared uploads when retrying an AP save", async () => {
    const { result } = renderHook(() => useApAttachments(), { wrapper });
    act(() =>
      result.current.add([
        new File(["payload"], "invoice.pdf", { type: "application/pdf" }),
      ]),
    );
    vi.mocked(httpClient.post).mockResolvedValueOnce(
      new Response(JSON.stringify({ data: { fileToken: "BU/invoice" } })),
    );
    let first: Awaited<ReturnType<typeof result.current.prepare>>;
    await act(async () => {
      first = await result.current.prepare();
    });
    await act(async () => {
      expect(await result.current.prepare()).toEqual(first);
    });
    expect(httpClient.post).toHaveBeenCalledOnce();
  });

  it("restores original attachments when cancelling a detach", () => {
    const original = {
      originalName: "original.pdf",
      fileToken: "BU/original",
      contentType: "application/pdf",
    };
    const { result } = renderHook(() => useApAttachments([original]), {
      wrapper,
    });
    act(() => result.current.remove(0));
    expect(result.current.attachments).toEqual([]);
    act(() => result.current.reset());
    expect(result.current.attachments).toEqual([original]);
    expect(httpClient.post).not.toHaveBeenCalled();
  });
});
