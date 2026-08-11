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

  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split("/").filter(Boolean);
    if (parts.length === 0 || file.path === "SKILL.md") continue;

    for (let depth = 0; depth < parts.length - 1; depth++) {
      const path = parts.slice(0, depth + 1).join("/");
      if (folders.has(path)) continue;
      folders.add(path);
      entries.push({ kind: "folder", path, name: parts[depth], depth });
    }

    entries.push({
      kind: "file",
      path: file.path,
      name: parts.at(-1) as string,
      depth: parts.length - 1,
      contents: file.contents,
    });
  }

  return entries;
}
