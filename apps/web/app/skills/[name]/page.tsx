"use client";

import { BookOpen, ChevronDown, FileText, FolderOpen } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SkillForm, { type SkillValues } from "../SkillForm";
import { skillTreeEntries } from "../skill-tree";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export default function SkillDetailPage() {
  const { name } = useParams<{ name: string }>();
  const [skill, setSkill] = useState<SkillValues | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [selectedPath, setSelectedPath] = useState("SKILL.md");

  useEffect(() => {
    fetch(`${API_BASE}/skills/${name}`)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<SkillValues>;
      })
      .then(setSkill)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load skill"),
      );
  }, [name]);

  const entries = skillTreeEntries(skill?.content ?? "", skill?.files);
  const selectedEntry = entries.find((entry) => entry.path === selectedPath);
  const selected = selectedEntry?.kind === "file" ? selectedEntry : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-7 pb-12">
      <nav className="flex min-w-0 items-center gap-2 text-sm" aria-label="Breadcrumb">
        <Link href="/skills" className="text-muted-foreground hover:text-foreground">
          Skills
        </Link>
        <span className="text-muted-foreground" aria-hidden="true">
          /
        </span>
        <span className="truncate font-medium">{name}</span>
      </nav>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : skill === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <PageHeader
            className="mb-0"
            icon={<BookOpen className="size-5 text-muted-foreground" />}
            title={skill.name}
            description={skill.description}
          >
            {!editing ? (
              <Button
                variant="outline"
                size="sm"
                className="self-start px-4"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            ) : null}
          </PageHeader>

          {editing ? (
            <section className="border-t pt-7">
              <SkillForm
                mode="edit"
                initial={skill}
                onSaved={(saved) => {
                  setSkill(saved);
                  setSelectedPath("SKILL.md");
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            </section>
          ) : (
            <div className="grid min-w-0 overflow-hidden rounded-lg border bg-card lg:grid-cols-[16rem_minmax(0,1fr)]">
              <aside
                className="min-w-0 border-b bg-muted/20 lg:border-r lg:border-b-0"
                aria-label="Skill files"
              >
                <div className="border-b px-3 py-2.5 font-mono text-[0.7rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
                  Files
                </div>
                <div className="max-h-64 overflow-y-auto p-2 lg:max-h-[42rem]">
                  {entries.map((entry) =>
                    entry.kind === "folder" ? (
                      <div
                        key={`folder:${entry.path}`}
                        className="flex h-8 min-w-0 items-center gap-1.5 pr-2 text-sm text-muted-foreground"
                        style={{ paddingLeft: 8 + entry.depth * 16 }}
                      >
                        <ChevronDown className="size-3.5 shrink-0" />
                        <FolderOpen className="size-4 shrink-0" />
                        <span className="truncate" title={entry.path}>
                          {entry.name}
                        </span>
                      </div>
                    ) : (
                      <button
                        key={`file:${entry.path}`}
                        type="button"
                        className={`flex h-8 w-full min-w-0 items-center gap-2 rounded-sm pr-2 text-left font-mono text-[0.78rem] transition-colors ${
                          selected?.path === entry.path
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                        style={{ paddingLeft: 12 + entry.depth * 16 }}
                        onClick={() => setSelectedPath(entry.path)}
                      >
                        <FileText className="size-4 shrink-0" />
                        <span className="truncate" title={entry.path}>
                          {entry.name}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              </aside>

              <section className="min-w-0" aria-label="Selected skill file">
                <header className="flex min-w-0 items-center justify-between gap-3 border-b px-4 py-3">
                  <code className="truncate text-xs font-medium" title={selected?.path}>
                    {selected?.path}
                  </code>
                  <Badge variant="secondary" className="shrink-0">
                    Read-only
                  </Badge>
                </header>
                <div className="min-w-0 p-4 sm:p-6">
                  {selected?.path.toLowerCase().endsWith(".md") ? (
                    <Markdown>{selected.contents}</Markdown>
                  ) : (
                    <pre className="max-w-full overflow-x-auto rounded-lg bg-muted p-4 text-xs leading-6">
                      <code>{selected?.contents}</code>
                    </pre>
                  )}
                </div>
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Markdown({ children }: { children: string }) {
  return (
    <div className="break-words text-[15px] leading-7 text-foreground/90 [&_a]:underline [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:break-all [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h1]:mt-8 [&_h1]:mb-3 [&_h1:first-child]:mt-0 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3 [&_h2:first-child]:mt-0 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:my-4 [&_ol]:list-decimal [&_p]:my-4 [&_p:first-child]:mt-0 [&_pre]:my-5 [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:break-normal [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:my-4 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: tableChildren }) => (
            <div className="my-5 max-w-full overflow-x-auto rounded-lg border">
              <table className="w-full border-collapse text-left text-sm">{tableChildren}</table>
            </div>
          ),
          th: ({ children: cellChildren }) => (
            <th className="border-b bg-muted px-3 py-2 font-medium">{cellChildren}</th>
          ),
          tr: ({ children: rowChildren }) => (
            <tr className="border-b last:border-b-0">{rowChildren}</tr>
          ),
          td: ({ children: cellChildren }) => <td className="px-3 py-2">{cellChildren}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
