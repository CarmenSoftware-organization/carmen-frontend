import { act, renderHook } from "@testing-library/react";
import type { ColumnDef } from "@tanstack/react-table";
import { describe, expect, it } from "vitest";
import {
  configTableLayout,
  useConfigTableLayout,
} from "./use-config-list-table";

const columns: ColumnDef<object>[] = [
  { id: "code", size: 100 },
  { id: "name", size: 180 },
  { id: "group", size: 180 },
  { id: "status", size: 100 },
];
const layout = { grow: "name", widths: {}, secondary: ["group"] };

describe("config table box layout", () => {
  it("counts the unrendered select column and hides secondary data before it overflows", () => {
    const result = configTableLayout(columns, layout, 662, {}, 175);
    expect(result.visibility.group).toBe(false);
    expect(result.columns.find((c) => c.id === "name")?.meta?.grow).toBe(true);
    expect(
      result.columns
        .filter((c) => result.visibility[c.id!] !== false)
        .reduce((sum, c) => sum + c.size!, 175),
    ).toBeLessThanOrEqual(662);
  });

  it("falls back to proportional widths when required columns cannot fit", () => {
    expect(
      configTableLayout(columns, layout, 300, {}, 175).columns.some(
        (c) => c.meta?.grow,
      ),
    ).toBe(false);
  });

  it("restores responsive columns on resize without discarding user preferences", () => {
    const { result, rerender } = renderHook(
      ({ width }) => useConfigTableLayout(columns, layout, width, {}, 175),
      { initialProps: { width: 662 } },
    );
    expect(result.current.state.columnVisibility.group).toBe(false);
    act(() =>
      result.current.onColumnVisibilityChange((current) => ({
        ...current,
        status: false,
      })),
    );
    rerender({ width: 1200 });
    expect(result.current.state.columnVisibility.group).not.toBe(false);
    expect(result.current.state.columnVisibility.status).toBe(false);
    act(() =>
      result.current.onColumnVisibilityChange((current) => ({
        ...current,
        group: false,
      })),
    );
    rerender({ width: 662 });
    rerender({ width: 1200 });
    expect(result.current.state.columnVisibility.group).toBe(false);
  });
});
