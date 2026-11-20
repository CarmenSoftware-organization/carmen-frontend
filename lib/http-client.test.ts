import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { httpClient } from "./http-client";
import { ApiError } from "./api-error";
import { tokenStore } from "@/lib/auth/token-store";
import { setRuntimeConfigForTests } from "@/lib/runtime-config";

vi.mock("@/lib/auth/auth-api", () => ({ refreshTokens: vi.fn() }));

beforeEach(() => {
  setRuntimeConfigForTests({
    BACKEND_URL: "https://api.test",
    X_APP_ID: "app-1",
  });
  tokenStore.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// =========================================================================
// HTTP methods
// =========================================================================
describe("httpClient.get", () => {
  it("sends GET request with correct URL", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const res = await httpClient.get("/api/proxy/test");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.test/test",
      expect.objectContaining({ method: "GET" }),
    );
    expect(res.status).toBe(200);
  });
});

describe("httpClient.post", () => {
  it("sends POST with JSON body and Content-Type header", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(201));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.post("/api/proxy/items", { name: "test" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ name: "test" });
  });

  it("sends POST without body when body is undefined", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.post("/api/proxy/trigger");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.body).toBeUndefined();
  });
});

describe("httpClient.put", () => {
  it("sends PUT request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.put("/api/proxy/items/1", { name: "updated" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
  });
});

describe("httpClient.patch", () => {
  it("sends PATCH request", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.patch("/api/proxy/items/1", { name: "patched" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PATCH");
  });
});

describe("httpClient.delete", () => {
  it("sends DELETE request without body", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.delete("/api/proxy/items/1");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("DELETE");
    expect(init.body).toBeUndefined();
  });
});

// =========================================================================
// FormData handling — must not stringify or set Content-Type
// =========================================================================
describe("FormData handling", () => {
  it("does not JSON.stringify FormData nor set Content-Type", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    const form = new FormData();
    form.append("file", "x");
    await httpClient.post("/api/proxy/upload", form);
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeInstanceOf(FormData);
    expect(init.headers["Content-Type"]).toBeUndefined();
  });
});

// =========================================================================
// 403 handling
// =========================================================================
describe("403 handling", () => {
  it("throws ApiError with FORBIDDEN code", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(403)));
    try {
      await httpClient.get("/api/proxy/admin");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("FORBIDDEN");
      expect((err as ApiError).statusCode).toBe(403);
    }
  });
});

// =========================================================================
// 403 handling — license 403 vs permission 403 (C5)
//
// license 403 (LicenseInterceptor) และ permission 403 (PermissionGuard) มีแค่
// `body.error.code` ที่แยกได้เด็ดขาด (phase-c-backend-contract.md ข้อ 5) — เทสต์
// เดิมด้านบน ("403 handling") ครอบ body ว่าง `{}` (ไม่มี error เลย) อยู่แล้วและ
// ต้องเขียวเหมือนเดิมทุกประการ ชุดนี้ครอบเพิ่มเฉพาะการแยก reason ของ dialog
// =========================================================================
describe("403 handling — license vs permission (C5)", () => {
  function capturePermissionDenied() {
    const onDetail = vi.fn();
    const handler = (e: Event) => onDetail((e as CustomEvent).detail);
    window.addEventListener("permission-denied", handler);
    return {
      onDetail,
      stop: () => window.removeEventListener("permission-denied", handler),
    };
  }

  it("dispatches reason 'license' for LICENSE_REQUIRED and still throws FORBIDDEN", async () => {
    const { onDetail, stop } = capturePermissionDenied();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(403, {
          success: false,
          status: 403,
          message: "This feature is not included in your subscription",
          error: { code: "LICENSE_REQUIRED", id: 2110001 },
          feature: "procurement.purchase_request",
          bu_codes: ["BU01"],
        }),
      ),
    );

    try {
      await httpClient.get("/api/proxy/purchase-requests");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("FORBIDDEN");
      expect((err as ApiError).statusCode).toBe(403);
    }

    expect(onDetail).toHaveBeenCalledTimes(1);
    expect(onDetail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ reason: "license" }),
    );
    stop();
  });

  it("dispatches reason 'expired' for LICENSE_EXPIRED", async () => {
    const { onDetail, stop } = capturePermissionDenied();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(403, {
          message: "Your subscription has expired — data is read-only",
          error: { code: "LICENSE_EXPIRED", id: 2110002 },
          feature: "procurement.purchase_request",
          bu_codes: ["BU01"],
        }),
      ),
    );

    try {
      await httpClient.post("/api/proxy/purchase-requests", { note: "x" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("FORBIDDEN");
    }

    expect(onDetail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ reason: "expired" }),
    );
    stop();
  });

  // Task 5.3: โค้ดที่สาม — เกินโควตาที่นั่ง (SEAT_LIMIT_EXCEEDED, evaluateSeat ฝั่ง backend)
  it("dispatches reason 'seat' for SEAT_LIMIT_EXCEEDED", async () => {
    const { onDetail, stop } = capturePermissionDenied();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(
        jsonResponse(403, {
          message: "This cluster has more users than the seats purchased",
          error: { code: "SEAT_LIMIT_EXCEEDED" },
          bu_codes: ["BU01"],
        }),
      ),
    );

    try {
      await httpClient.post("/api/proxy/purchase-requests", { note: "x" });
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("FORBIDDEN");
    }

    expect(onDetail.mock.calls[0][0]).toEqual(
      expect.objectContaining({ reason: "seat" }),
    );
    stop();
  });

  // permission 403 จริง (PermissionGuard) — error เหลือแค่ {message:"Forbidden"}
  // ไม่มี code เลย ต้องเห็น event เดิมทุกประการ (ไม่มี key `reason`)
  it("keeps the exact pre-C5 event shape for a real permission-403 body", async () => {
    const { onDetail, stop } = capturePermissionDenied();
    const message =
      "Permission denied: You do not have the required permissions for BU(s): BU01";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(403, { message, error: { message: "Forbidden" } }),
        ),
    );

    try {
      await httpClient.get("/api/proxy/admin");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("FORBIDDEN");
    }

    expect(onDetail).toHaveBeenCalledWith({ message });
    stop();
  });

  // body รูปแปลก — ต้องไม่ throw และตกไปเส้นทาง permission เดิม (ไม่มี reason)
  it.each([
    ["null body", null],
    ["body with no error key at all", { message: "Forbidden" }],
    [
      "error as a plain string, not an object",
      { message: "Forbidden", error: "Forbidden" },
    ],
  ])(
    "does not throw on %s and falls back to the permission path",
    async (_label, body) => {
      const { onDetail, stop } = capturePermissionDenied();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValueOnce(jsonResponse(403, body)),
      );

      try {
        await httpClient.get("/api/proxy/whatever");
        expect.unreachable("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe("FORBIDDEN");
        expect((err as ApiError).statusCode).toBe(403);
      }

      expect(onDetail).toHaveBeenCalledTimes(1);
      expect(onDetail.mock.calls[0][0].reason).toBeUndefined();
      stop();
    },
  );
});

// =========================================================================
// 401 retry — second 401 after a refresh clears the session
// =========================================================================
describe("401 retry handling", () => {
  it("clears session and throws when the retried request is also 401", async () => {
    const { refreshTokens } = await import("@/lib/auth/auth-api");
    (refreshTokens as ReturnType<typeof vi.fn>).mockResolvedValueOnce("ok");
    tokenStore.set("at-stale");
    // ครั้งแรก 401 → refresh สำเร็จ → retry → 401 อีกครั้ง
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401))
      .mockResolvedValueOnce(jsonResponse(401));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await httpClient.get("/api/proxy/secure");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("UNAUTHORIZED");
    }
    // ไม่ refresh ซ้ำ (เรียกครั้งเดียว) และ session ถูกเคลียร์
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenStore.get()).toBeNull();
  });

  // 401 ที่ข้อความมีคำว่า "permission" เคยลัดไป dialog ทันทีโดยไม่ refresh —
  // token ที่หมดอายุพอดีจึงกลายเป็น "ไม่มีสิทธิ์" ทั้งที่แค่ต้อง refresh
  it("refreshes and retries first even when the 401 message mentions permission", async () => {
    const { refreshTokens } = await import("@/lib/auth/auth-api");
    // mock ระดับโมดูล — นับสะสมข้ามเทส ต้องล้างก่อนถึงจะเช็คจำนวนครั้งได้
    (refreshTokens as ReturnType<typeof vi.fn>).mockClear();
    (refreshTokens as ReturnType<typeof vi.fn>).mockResolvedValueOnce("ok");
    tokenStore.set("at-stale");
    const body = {
      message:
        "Access denied. You do not have permission for the following BU code(s): BU01",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, body))
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await httpClient.get("/api/proxy/secure");

    expect(res.status).toBe(200);
    expect(refreshTokens).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(tokenStore.get()).toBe("at-stale");
  });

  // gateway เก่าที่ยังตอบ 401 ให้เรื่องสิทธิ์ BU — หลัง retry แล้วยังโดน ต้องเป็น
  // FORBIDDEN + เด้ง dialog ไม่ใช่เคลียร์ session แล้วเตะออกจากระบบ
  it("keeps the session on a permission 401 that survives the retry", async () => {
    const { refreshTokens } = await import("@/lib/auth/auth-api");
    (refreshTokens as ReturnType<typeof vi.fn>).mockClear();
    (refreshTokens as ReturnType<typeof vi.fn>).mockResolvedValueOnce("ok");
    tokenStore.set("at-fresh");
    const body = {
      message:
        "Access denied. You do not have permission for the following BU code(s): BU01",
    };
    const events: CustomEvent[] = [];
    const handler = (e: Event) => events.push(e as CustomEvent);
    window.addEventListener("permission-denied", handler);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(401, body))
      .mockResolvedValueOnce(jsonResponse(401, body));
    vi.stubGlobal("fetch", fetchMock);

    try {
      await httpClient.get("/api/proxy/secure");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect((err as ApiError).code).toBe("FORBIDDEN");
      expect((err as ApiError).statusCode).toBe(403);
    } finally {
      window.removeEventListener("permission-denied", handler);
    }

    expect(events).toHaveLength(1);
    expect(tokenStore.get()).toBe("at-fresh");
  });
});

// =========================================================================
// External public endpoints — auth interception is skipped
// =========================================================================
describe("/api/external/* handling", () => {
  it("returns the raw 401 response instead of throwing/refreshing", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(401));
    vi.stubGlobal("fetch", fetchMock);
    const res = await httpClient.get("/api/external/pl/tok-123");
    // ไม่ throw ApiError และไม่เรียก refresh/retry — คืน response ดิบให้ hook จัดการ
    expect(res.status).toBe(401);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// 429 handling
// =========================================================================
describe("429 handling", () => {
  it("throws ApiError with RATE_LIMITED code and retryable=true", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(429)));
    try {
      await httpClient.get("/api/proxy/data");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("RATE_LIMITED");
      expect((err as ApiError).statusCode).toBe(429);
      expect((err as ApiError).retryable).toBe(true);
    }
  });
});

// =========================================================================
// Error normalization — network errors become ApiError
// =========================================================================
describe("error normalization", () => {
  it("converts a network failure into a NETWORK_ERROR ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValueOnce(new TypeError("fetch failed")),
    );
    try {
      await httpClient.get("/api/proxy/data");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("NETWORK_ERROR");
      expect((err as ApiError).retryable).toBe(true);
    }
  });

  it("converts an AbortError into a TIMEOUT ApiError", async () => {
    const abort = new DOMException("aborted", "AbortError");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValueOnce(abort));
    try {
      await httpClient.get("/api/proxy/data");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("TIMEOUT");
    }
  });
});

// =========================================================================
// Default request timeout — every request gets an abort signal so a hung
// backend can never freeze the call forever
// =========================================================================
describe("default request timeout", () => {
  it("attaches a default abort signal when the caller provides none", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.get("/api/proxy/data");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("uses the caller-provided signal instead of the default timeout", async () => {
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    const controller = new AbortController();
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    await httpClient.get("/api/proxy/data", { signal: controller.signal });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBe(controller.signal);
    expect(timeoutSpy).not.toHaveBeenCalled();
  });

  it("maps a fired timeout (TimeoutError) to a TIMEOUT ApiError", async () => {
    // จำลอง AbortSignal.timeout ด้วย controller ที่เราสั่ง abort เองได้
    const controller = new AbortController();
    const timeoutSpy = vi
      .spyOn(AbortSignal, "timeout")
      .mockReturnValueOnce(controller.signal);
    // fetch ที่เคารพ signal: reject ด้วย TimeoutError เมื่อถูก abort
    const fetchMock = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(new DOMException("timed out", "TimeoutError")),
          );
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const pending = httpClient.get("/api/proxy/slow");
    controller.abort(); // จำลองว่า timeout ครบกำหนด
    try {
      await pending;
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).code).toBe("TIMEOUT");
      expect((err as ApiError).retryable).toBe(true);
    }
    expect(timeoutSpy).toHaveBeenCalledWith(30_000);
  });
});

// =========================================================================
// Normal responses pass through
// =========================================================================
describe("normal responses", () => {
  it("returns 200 response as-is", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(jsonResponse(200, { data: [1, 2, 3] })),
    );
    const res = await httpClient.get("/api/proxy/data");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toEqual([1, 2, 3]);
  });

  it("returns 404 response as-is", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(404)));
    const res = await httpClient.get("/api/proxy/missing");
    expect(res.status).toBe(404);
  });

  it("returns 500 response as-is", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse(500)));
    const res = await httpClient.get("/api/proxy/error");
    expect(res.status).toBe(500);
  });
});

// =========================================================================
// SPA URL rewrite + auth
// =========================================================================
describe("SPA URL rewrite + auth", () => {
  it("rewrites /api/proxy/* to the backend origin with bearer + x-app-id", async () => {
    tokenStore.set("at-1");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    await httpClient.get("/api/proxy/api/config/HQ/units");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.test/api/config/HQ/units");
    expect(init.headers.Authorization).toBe("Bearer at-1");
    expect(init.headers["x-app-id"]).toBe("app-1");
  });

  it("retries once with the refreshed token after 401", async () => {
    tokenStore.set("expired");
    const { refreshTokens } = await import("@/lib/auth/auth-api");
    vi.mocked(refreshTokens).mockImplementation(async () => {
      tokenStore.set("fresh");
      return "ok";
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 401 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const res = await httpClient.get("/api/proxy/api/user/profile");

    expect(res.status).toBe(200);
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer fresh",
    );
  });

  it("clears the token store when refresh fails after 401", async () => {
    tokenStore.set("expired");
    const { refreshTokens } = await import("@/lib/auth/auth-api");
    vi.mocked(refreshTokens).mockResolvedValue("rejected");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("{}", { status: 401 })),
    );

    await expect(httpClient.get("/api/proxy/api/user/profile")).rejects.toThrow(
      "Session expired",
    );
    expect(tokenStore.get()).toBeNull();
  });

  it("rejects non-/api/ URLs", async () => {
    await expect(httpClient.get("https://evil.com/x")).rejects.toThrow(
      "Invalid request URL",
    );
  });
});
