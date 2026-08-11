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
