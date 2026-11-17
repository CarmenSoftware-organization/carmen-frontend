import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";

vi.mock("@/hooks/use-bu-code", () => ({
  useBuCode: vi.fn(() => "BU001"),
}));

vi.mock("@/lib/http-client", () => ({
  httpClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { useBuCode } from "@/hooks/use-bu-code";
import { httpClient } from "@/lib/http-client";
import { createConfigCrud } from "../use-config-crud";

interface Widget {
  id: string;
  name: string;
  is_active: boolean;
}

interface CreateWidget {
  name: string;
  is_active: boolean;
}

function jsonRes(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  function Wrapper({ children }: { children: ReactNode }) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  }
  return Wrapper;
}

const crud = createConfigCrud<Widget, CreateWidget>({
  queryKey: "widgets",
  endpoint: (buCode) => `/api/proxy/api/config/${buCode}/widgets`,
  label: "widget",
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useBuCode).mockReturnValue("BU001");
});

// =========================================================================
// useList
// =========================================================================
describe("useList", () => {
  it("fetches list with buCode in query key", async () => {
    const data = {
      data: [{ id: "1", name: "W1", is_active: true }],
      paginate: { total: 1, page: 1, perpage: 10, pages: 1 },
    };
    vi.mocked(httpClient.get).mockResolvedValue(jsonRes(200, data));

    const { result } = renderHook(() => crud.useList(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.data).toHaveLength(1);
    expect(result.current.data?.data[0].name).toBe("W1");
  });

  it("does not fetch when buCode is undefined", () => {
    vi.mocked(useBuCode).mockReturnValue(undefined as unknown as string);

    const { result } = renderHook(() => crud.useList(), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
    expect(httpClient.get).not.toHaveBeenCalled();
  });

  it("passes params to API", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(
      jsonRes(200, {
        data: [],
        paginate: { total: 0, page: 2, perpage: 5, pages: 0 },
      }),
    );

    renderHook(() => crud.useList({ search: "test", page: 2, perpage: 5 }), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(httpClient.get).toHaveBeenCalled();
    });

    const url = vi.mocked(httpClient.get).mock.calls[0][0];
    expect(url).toContain("search=test");
    expect(url).toContain("page=2");
  });
});

// =========================================================================
// useById
// =========================================================================
describe("useById", () => {
  it("fetches single record by id", async () => {
    vi.mocked(httpClient.get).mockResolvedValue(
      jsonRes(200, { data: { id: "1", name: "Widget 1", is_active: true } }),
    );

    const { result } = renderHook(() => crud.useById("1"), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe("Widget 1");
  });

  it("does not fetch when id is undefined", () => {
    const { result } = renderHook(() => crud.useById(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current.fetchStatus).toBe("idle");
  });
});

// =========================================================================
// useCreate
// =========================================================================
describe("useCreate", () => {
  it("creates successfully and calls post", async () => {
    vi.mocked(httpClient.post).mockResolvedValue(jsonRes(201, { id: "2" }));

    const { result } = renderHook(() => crud.useCreate(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ name: "New Widget", is_active: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpClient.post).toHaveBeenCalledWith(
      "/api/proxy/api/config/BU001/widgets",
      { name: "New Widget", is_active: true },
    );
  });
});

// =========================================================================
// useUpdate
// =========================================================================
describe("useUpdate", () => {
  it.each([undefined, "none"] as const)(
    "keeps default refetch behavior unless this form requests %s",
    async (refetchType) => {
      vi.mocked(httpClient.get).mockResolvedValue(
        jsonRes(200, { data: [], paginate: { pages: 1 } }),
      );
      vi.mocked(httpClient.put).mockResolvedValue(jsonRes(200, { ok: true }));
      const { result } = renderHook(
        () => ({
          query: crud.useList(),
          mutation: crud.useUpdate(
            refetchType ? { invalidateRefetchType: refetchType } : undefined,
          ),
        }),
        { wrapper: createWrapper() },
      );
      await waitFor(() => expect(result.current.query.isSuccess).toBe(true));
      await act(async () => {
        await result.current.mutation.mutateAsync({
          id: "1",
          name: "Changed",
          is_active: true,
        });
      });
      await waitFor(() =>
        expect(httpClient.get).toHaveBeenCalledTimes(
          refetchType === "none" ? 1 : 2,
        ),
      );
      if (refetchType === "none")
        expect(result.current.query.isStale).toBe(true);
    },
  );

  it("updates successfully and calls put", async () => {
    vi.mocked(httpClient.put).mockResolvedValue(jsonRes(200, { ok: true }));

    const { result } = renderHook(() => crud.useUpdate(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ id: "1", name: "Updated", is_active: false });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpClient.put).toHaveBeenCalledWith(
      "/api/proxy/api/config/BU001/widgets/1",
      { name: "Updated", is_active: false },
    );
  });

  it("uses PATCH when configured", async () => {
    const patchCrud = createConfigCrud<Widget, CreateWidget>({
      queryKey: "widgets-patch",
      endpoint: (buCode) => `/api/proxy/api/config/${buCode}/widgets`,
      label: "widget",
      updateMethod: "PATCH",
    });

    vi.mocked(httpClient.patch).mockResolvedValue(jsonRes(200, { ok: true }));

    const { result } = renderHook(() => patchCrud.useUpdate(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate({ id: "1", name: "Patched", is_active: true });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpClient.patch).toHaveBeenCalled();
    expect(httpClient.put).not.toHaveBeenCalled();
  });
});

// =========================================================================
// useDelete
// =========================================================================
describe("useDelete", () => {
  it("deletes successfully", async () => {
    vi.mocked(httpClient.delete).mockResolvedValue(jsonRes(200, { ok: true }));

    const { result } = renderHook(() => crud.useDelete(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.mutate("1");
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(httpClient.delete).toHaveBeenCalledWith(
      "/api/proxy/api/config/BU001/widgets/1",
    );
  });
});
