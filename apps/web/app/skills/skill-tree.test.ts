import { expect, test } from "bun:test";
import { skillTreeEntries } from "./skill-tree";

test("skillTreeEntries includes SKILL.md and shared folders once", () => {
  expect(
    skillTreeEntries("# Skill", [
      { path: "scripts/run.ts", contents: "run();" },
      { path: "references/setup.md", contents: "# Setup" },
      { path: "references/examples/basic.md", contents: "Basic" },
    ]).map(({ kind, path, depth }) => ({ kind, path, depth })),
  ).toEqual([
    { kind: "file", path: "SKILL.md", depth: 0 },
    { kind: "folder", path: "references", depth: 0 },
    { kind: "folder", path: "references/examples", depth: 1 },
    { kind: "file", path: "references/examples/basic.md", depth: 2 },
    { kind: "file", path: "references/setup.md", depth: 1 },
    { kind: "folder", path: "scripts", depth: 0 },
    { kind: "file", path: "scripts/run.ts", depth: 1 },
  ]);
});

test("skips SKILL.md however the path is written, so the tree never shows it twice", () => {
  for (const path of ["SKILL.md", "./SKILL.md", "SKILL.md/"]) {
    const entries = skillTreeEntries("body", [{ path, contents: "dupe" }]);
    expect(entries.filter((entry) => entry.name === "SKILL.md")).toHaveLength(1);
    // The surviving entry is the real one, not the duplicate's contents.
    expect(entries[0]).toMatchObject({ path: "SKILL.md", contents: "body" });
  }
});

test("normalizes '.' segments so entry paths (and React keys) stay unique", () => {
  const entries = skillTreeEntries("body", [
    { path: "./lib/a.ts", contents: "a" },
    { path: "lib/a.ts", contents: "a" },
  ]);
  const paths = entries.map((entry) => entry.path);
  expect(new Set(paths).size).toBe(paths.length);
});

test("orders files byte-stably rather than by runtime locale", () => {
  const entries = skillTreeEntries("body", [
    { path: "b.ts", contents: "" },
    { path: "A.ts", contents: "" },
    { path: "a.ts", contents: "" },
  ]);
  expect(entries.filter((e) => e.kind === "file").map((e) => e.path)).toEqual([
    "SKILL.md",
    "A.ts",
    "a.ts",
    "b.ts",
  ]);
});
