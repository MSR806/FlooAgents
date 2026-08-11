export type SkillTreeEntry =
  | { kind: "folder"; path: string; name: string; depth: number }
  | { kind: "file"; path: string; name: string; depth: number; contents: string };

export function skillTreeEntries(
  content: string,
  files: { path: string; contents: string }[] = [],
): SkillTreeEntry[] {
  const entries: SkillTreeEntry[] = [
    { kind: "file", path: "SKILL.md", name: "SKILL.md", depth: 0, contents: content },
  ];
  const folders = new Set<string>();
  // Normalizing can collapse two inputs ("./lib/a.ts" and "lib/a.ts") onto one path; emitting both
  // would hand the file list a duplicate React key.
  const seen = new Set<string>(["SKILL.md"]);

  // Byte-stable, not localeCompare: that uses the runtime's default locale, so CI and a user's
  // machine can order the tree differently.
  const byPath = (a: { path: string }, b: { path: string }) =>
    a.path < b.path ? -1 : a.path > b.path ? 1 : 0;

  for (const file of [...files].sort(byPath)) {
    const parts = file.path.split("/").filter((part) => part && part !== ".");
    // Compare the normalized path: "SKILL.md/" and "./SKILL.md" both name the file we already
    // emitted above, and would otherwise render a second SKILL.md row.
    const path = parts.join("/");
    if (parts.length === 0 || seen.has(path)) continue;
    seen.add(path);

    for (let depth = 0; depth < parts.length - 1; depth++) {
      const path = parts.slice(0, depth + 1).join("/");
      if (folders.has(path)) continue;
      folders.add(path);
      entries.push({ kind: "folder", path, name: parts[depth], depth });
    }

    entries.push({
      kind: "file",
      path,
      name: parts.at(-1) as string,
      depth: parts.length - 1,
      contents: file.contents,
    });
  }

  return entries;
}
