import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// CHROME_PATH overrides the standard Chrome/Chromium locations; absence is a failure.
const browser =
  process.env.CHROME_PATH ??
  [
    join(
      process.env.PROGRAMFILES ?? "C:/Program Files",
      "Google/Chrome/Application/chrome.exe",
    ),
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ].find(existsSync);
if (!browser || !existsSync(browser))
  throw new Error(
    "Chrome not found. Set CHROME_PATH to a Chrome/Chromium executable.",
  );

const root = resolve(import.meta.dirname, "..");
const profile = mkdtempSync(join(tmpdir(), "carmen-ui-layout-"));
if (
  dirname(resolve(profile)) !== resolve(tmpdir()) ||
  !basename(profile).startsWith("carmen-ui-layout-")
) {
  throw new Error("Refusing to use an unexpected browser profile path");
}
const server = await createServer({
  configFile: false,
  root,
  logLevel: "error",
  plugins: [
    react({ babel: { plugins: ["babel-plugin-react-compiler"] } }),
    tailwindcss(),
  ],
  resolve: { alias: { "@": root } },
  server: { host: "127.0.0.1", port: 0 },
});
const child = spawn(
  browser,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profile}`,
    "about:blank",
  ],
  { windowsHide: true, stdio: ["ignore", "ignore", "pipe"] },
);
let stderr = "";
child.stderr.on("data", (chunk: Buffer) => {
  stderr = (stderr + chunk.toString()).slice(-2000);
});
const closed = new Promise<void>((done) => child.once("close", () => done()));
let startupError: Error | undefined;
child.once("error", (error) => {
  startupError = error;
});
let socket: WebSocket | undefined;
let load: (() => void) | undefined;
let nextId = 0;
const pending = new Map<
  number,
  {
    resolve: (value: unknown) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }
>();

function command(
  method: string,
  params: Record<string, unknown> = {},
): Promise<unknown> {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Chrome command timed out: ${method}`));
    }, 15000);
    pending.set(id, { resolve, reject, timer });
    socket!.send(JSON.stringify({ id, method, params }));
  });
}

async function run(url: string, width: number, height: number) {
  await command("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: false,
  });
  const loaded = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("UI fixture navigation timed out")),
      15000,
    );
    load = () => {
      clearTimeout(timer);
      resolve();
    };
  });
  await Promise.all([command("Page.navigate", { url }), loaded]);
  const evaluated = (await command("Runtime.evaluate", {
    expression: `(async () => { for (let i = 0; i < 100; i++) { const result = document.getElementById('ui-layout-result'); if (result && result.dataset.status !== 'running') return { status: result.dataset.status, details: JSON.parse(result.textContent) }; await new Promise(r => setTimeout(r, 100)); } throw new Error('UI fixture did not report a result'); })()`,
    awaitPromise: true,
    returnByValue: true,
  })) as {
    exceptionDetails?: { text: string };
    result: {
      value?: {
        status: string;
        details: {
          viewport: { width: number; height: number };
          theme: string;
          errors: string[];
        };
      };
    };
  };
  if (evaluated.exceptionDetails || !evaluated.result.value)
    throw new Error(JSON.stringify(evaluated));
  const result = evaluated.result.value;
  if (
    result.details.viewport.width !== width ||
    result.details.viewport.height !== height
  ) {
    throw new Error(
      `Chrome viewport ${JSON.stringify(result.details.viewport)} differs from ${width}×${height}`,
    );
  }
  return result;
}

try {
  await server.listen();
  const portFile = join(profile, "DevToolsActivePort");
  for (let i = 0; !existsSync(portFile) && i < 100; i++) {
    if (startupError || child.exitCode !== null)
      throw startupError ?? new Error(stderr);
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  if (!existsSync(portFile)) throw new Error(`Chrome did not start: ${stderr}`);
  const port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
  const target = (await (
    await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {
      method: "PUT",
    })
  ).json()) as { webSocketDebuggerUrl: string };
  socket = new WebSocket(target.webSocketDebuggerUrl);
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data)) as {
      id?: number;
      method?: string;
      result?: unknown;
      error?: { message: string };
    };
    if (message.method === "Page.loadEventFired") load?.();
    if (message.id) {
      const request = pending.get(message.id);
      if (!request) return;
      clearTimeout(request.timer);
      pending.delete(message.id);
      if (message.error) request.reject(new Error(message.error.message));
      else request.resolve(message.result);
    }
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Chrome connection timed out")),
      10000,
    );
    socket!.addEventListener(
      "open",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    socket!.addEventListener(
      "error",
      () => {
        clearTimeout(timer);
        reject(new Error("Could not connect to Chrome"));
      },
      { once: true },
    );
  });
  await command("Page.enable");
  const address = server.httpServer!.address();
  if (!address || typeof address === "string")
    throw new Error("Vite did not bind a TCP port");
  const url = `http://127.0.0.1:${address.port}/test/ui/lookup-layout.html`;
  const probe = await run(`${url}?probe-shrink`, 1366, 768);
  if (
    probe.status !== "fail" ||
    !probe.details.errors.some((error) =>
      error.startsWith("table-empty: width"),
    )
  ) {
    throw new Error(
      "UI gate failed to detect the shrink-width regression probe",
    );
  }
  console.log(
    "PASS negative probe: detects a lookup shrinking inside a table cell",
  );
  for (const [width, height] of [
    [390, 844],
    [768, 1024],
    [1366, 768],
    [1920, 1080],
    [3840, 2160],
  ]) {
    for (const theme of ["light", "dark"]) {
      const result = await run(`${url}?theme=${theme}`, width, height);
      if (result.status !== "pass" || result.details.theme !== theme)
        throw new Error(JSON.stringify(result));
      console.log(`PASS lookup geometry ${width}×${height} ${theme}`);
    }
  }
} finally {
  for (const request of pending.values()) clearTimeout(request.timer);
  socket?.close();
  child.kill();
  await closed;
  await server.close();
  rmSync(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 100,
  });
}
