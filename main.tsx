import "./styles/globals.css";
import "./styles/badge-status.css";
import "./styles/toast.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import { applyScale, readStoredScale } from "@/lib/font-scale";
import { applyColorTheme, readStoredColorTheme } from "@/lib/color-theme";

// เรียกซ้ำที่นี่แม้ index.html จะมี inline script ทำงานนี้อยู่ก่อนแล้ว (ตั้งใจ
// ให้ซ้ำซ้อน) — inline script เป็นจุดเดียวที่ apply scale ก่อน React mount ถ้าวันหนึ่ง
// มี CSP `script-src` แบบไม่มี 'unsafe-inline' (ไม่มีตอนนี้) inline script จะถูกบล็อก
// เงียบๆ แล้ว <html> ไม่ได้ class เลย ฟอนต์กลับเป็น normal ทุกครั้งที่โหลด ทั้งที่เมนู
// ยังโชว์ค่าที่ผู้ใช้เลือกไว้ (อ่านจาก localStorage ไม่ใช่ DOM) บรรทัดนี้จึงทำให้
// inline script เป็นแค่ FOUC optimisation ไม่ใช่จุดเดียวที่พึ่งได้
applyScale(readStoredScale());
applyColorTheme(readStoredColorTheme());

const PRELOAD_RELOAD_KEY = "carmen.preload-reload";

/**
 * Self-heal stale lazy-chunk imports after a deploy that removed old hashed
 * assets. Every route is a `lazy:` module, so a deploy mid-session makes the
 * next navigation to an unvisited route fail its dynamic import — Vite fires
 * `vite:preloadError`. Reload once (guarded against reload loops) so the
 * session picks up the new asset manifest instead of hitting an error boundary.
 */
window.addEventListener("vite:preloadError", () => {
  try {
    if (sessionStorage.getItem(PRELOAD_RELOAD_KEY)) return;
    sessionStorage.setItem(PRELOAD_RELOAD_KEY, "1");
  } catch {
    // sessionStorage unavailable — reload anyway (worst case: one extra reload)
  }
  window.location.reload();
});

/**
 * Boot ลำดับ: config → restore session → render
 * refresh ก่อน render ตัดปัญหา flash ของ login page ตอน reload ขณะ logged-in
 */
async function boot() {
  try {
    const { loadRuntimeConfig } = await import("@/lib/runtime-config");
    const runtimeConfig = await loadRuntimeConfig();

    const { refreshTokens } = await import("@/lib/auth/auth-api");
    // rejected = ไม่ logged-in → RequireAuth พาไป /login เอง · unreachable (server ล่ม) →
    // RequireAuth แสดงหน้า "ติดต่อเซิร์ฟเวอร์ไม่ได้" ที่ลองใหม่เอง โดยไม่ลบ refresh token
    await refreshTokens();

    // Telemetry — import แบบ dynamic โดยตั้งใจ: environment ที่ไม่เปิดจะไม่โหลด
    // OTel SDK (~60-80 KB) ลงเครื่องผู้ใช้เลย ต้องอยู่หลัง refreshTokens เพราะ
    // exporter ต้องมี token ไปด้วย
    if (runtimeConfig.OTEL_ENABLED) {
      try {
        const { initTelemetry } = await import("@/lib/telemetry");
        initTelemetry({ serviceName: "carmen-spa", version: __APP_VERSION__ });
      } catch (e) {
        // telemetry ล้มต้องไม่กัน app ขึ้น — เครื่องมือสังเกตการณ์ห้ามเป็นเหตุให้ระบบล่ม
        console.warn("[telemetry] init failed", e);
      }
    }

    const { router } = await import("./routes/router");
    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    );
    // Successful boot — clear the reload guard so a future deploy can self-heal.
    try {
      sessionStorage.removeItem(PRELOAD_RELOAD_KEY);
    } catch {
      // ignore
    }
  } catch (error) {
    console.error("[boot] failed", error);
    // boot ล้ม = ผู้ใช้เข้าระบบไม่ได้เลย ซึ่งเป็นบั๊กกลุ่มที่กระทบหนักที่สุดและ
    // มองไม่เห็นจากฝั่งเรา ส่งผ่านช่อง anonymous เพราะตอนนี้ยังไม่มี token
    void import("@/lib/telemetry")
      .then((m) =>
        m.reportPreLoginError(
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error.stack : undefined,
        ),
      )
      .catch(() => {
        /* ส่งไม่ได้ก็ต้องไม่สร้าง error ใหม่ทับ */
      });
    document.getElementById("root")!.innerHTML =
      '<div style="font-family: system-ui; padding: 2rem; color: #b91c1c">Failed to load application configuration. Please try again or contact support.</div>';
  }
}

void boot();
