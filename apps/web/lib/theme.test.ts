import { describe, expect, it } from "bun:test";
import { resolveTheme, THEME_INIT_SCRIPT, THEME_STORAGE_KEY } from "./theme";

describe("resolveTheme", () => {
  it("defaults to paper when nothing is stored", () => {
    expect(resolveTheme(null)).toBe("paper");
  });

  it("returns ink only for the exact stored value", () => {
    expect(resolveTheme("ink")).toBe("ink");
  });

  it("falls back to paper for anything unrecognised", () => {
    expect(resolveTheme("paper")).toBe("paper");
    expect(resolveTheme("dark")).toBe("paper");
    expect(resolveTheme("")).toBe("paper");
  });
});

describe("THEME_INIT_SCRIPT", () => {
  it("adds .dark exactly when ink is stored", () => {
    const run = (stored: string | null) => {
      const classes = new Set<string>();
      const fn = new Function(
        "localStorage",
        "document",
        THEME_INIT_SCRIPT,
      ) as (localStorage: unknown, document: unknown) => void;
      fn(
        { getItem: (k: string) => (k === THEME_STORAGE_KEY ? stored : null) },
        { documentElement: { classList: { add: (c: string) => classes.add(c) } } },
      );
      return classes.has("dark");
    };

    expect(run("ink")).toBe(true);
    expect(run(null)).toBe(false);
    expect(run("paper")).toBe(false);
  });
});
