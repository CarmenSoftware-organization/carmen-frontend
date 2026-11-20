import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRuntimeConfig,
  isDevAppEnv,
  loadRuntimeConfig,
  setRuntimeConfigForTests,
} from "@/lib/runtime-config";

describe("runtime-config", () => {
  beforeEach(() => setRuntimeConfigForTests(null));
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("loads and normalizes config.json (strips trailing slash)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            BACKEND_URL: "https://api.example.com/",
            X_APP_ID: "app-1",
          }),
        ),
      ),
    );
    const config = await loadRuntimeConfig();
    expect(config.BACKEND_URL).toBe("https://api.example.com");
    expect(getRuntimeConfig().X_APP_ID).toBe("app-1");
  });

  it("accepts empty BACKEND_URL (dev proxy mode)", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify({ BACKEND_URL: "", X_APP_ID: "app-1" })),
        ),
    );
    const config = await loadRuntimeConfig();
    expect(config.BACKEND_URL).toBe("");
  });

  it("throws when config.json is missing keys", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(new Response(JSON.stringify({ BACKEND_URL: "x" }))),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow(/X_APP_ID/);
  });

  it("throws with status code when fetch returns a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 404 })),
    );
    await expect(loadRuntimeConfig()).rejects.toThrow(/config\.json \(404\)/);
  });

  it("getRuntimeConfig throws before load", () => {
    expect(() => getRuntimeConfig()).toThrow(/not loaded/);
  });

  it.each([
    ["dev", true],
    ["local", true],
    [" DEV ", true],
    ["uat", false],
    ["prod", false],
    [undefined, false],
  ])("isDevAppEnv() with APP_ENV=%s → %s", async (appEnv, expected) => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response(
            JSON.stringify({
              BACKEND_URL: "",
              X_APP_ID: "app-1",
              APP_ENV: appEnv,
            }),
          ),
        ),
    );
    await loadRuntimeConfig();
    expect(isDevAppEnv()).toBe(expected);
  });

  it("isDevAppEnv() is false before config loads", () => {
    expect(isDevAppEnv()).toBe(false);
  });
});
