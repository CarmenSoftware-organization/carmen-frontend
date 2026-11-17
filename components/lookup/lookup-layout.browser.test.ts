import { execFile } from "node:child_process";
import { resolve } from "node:path";
import { promisify } from "node:util";
import { expect, it } from "vitest";

it("keeps lookup geometry valid in a real browser, including a failing shrink probe", async () => {
  try {
    const { stdout } = await promisify(execFile)(
      "bun",
      ["scripts/check-ui-layout.ts"],
      {
        cwd: resolve(import.meta.dirname, "../.."),
        windowsHide: true,
        timeout: 210000,
      },
    );
    expect(stdout).toContain("PASS negative probe");
    expect(stdout.match(/PASS lookup geometry/g)).toHaveLength(10);
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      [failure.message, failure.stdout, failure.stderr]
        .filter(Boolean)
        .join("\n"),
    );
  }
}, 240000);
