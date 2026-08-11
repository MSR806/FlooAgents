"use client";

import { BookOpen, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

type Skill = { name: string; description: string };

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API_BASE}/skills`)
      .then((r) => r.json() as Promise<Skill[]>)
      .then(setSkills)
      .catch(() => setError("Failed to load skills"));
  }, []);

  useEffect(load, [load]);

  async function remove(name: string) {
    if (!confirm(`Delete skill "${name}"?`)) return;
    await fetch(`${API_BASE}/skills/${name}`, { method: "DELETE" });
    load();
  }

  return (
    <section>
      <PageHeader title="Skills">
        <Button size="sm" render={<Link href="/skills/new" />} nativeButton={false}>
          <Plus /> New skill
        </Button>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {skills === null ? (
        <p className="py-6 text-sm text-muted-foreground">Loading skills…</p>
      ) : skills.length === 0 ? (
        <p className="py-6 text-sm text-muted-foreground">
          No skills yet — create one to give agents reusable instructions.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {skills.map((skill) => (
            <li
              key={skill.name}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-background">
                  <BookOpen className="size-4 text-muted-foreground" />
                </div>
                <Link href={`/skills/${skill.name}`} className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[0.9rem] font-bold">{skill.name}</p>
                </Link>
              </div>
              <p className="line-clamp-2 text-sm text-muted-foreground">{skill.description}</p>
              <div className="mt-auto flex items-center border-t border-border pt-2.5">
                <Button
                  variant="ghost"
                  size="xs"
                  className="ml-auto"
                  onClick={() => remove(skill.name)}
                >
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
