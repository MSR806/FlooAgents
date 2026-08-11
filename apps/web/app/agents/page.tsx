"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import HarnessImage from "./HarnessImage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

type Agent = { id: string; name: string; harness: { id: string; config: { model: string } } };
type Harness = { id: string; image?: string };

export default function AgentsPage() {
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [harnessImages, setHarnessImages] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`${API_BASE}/agents`)
      .then((r) => r.json() as Promise<Agent[]>)
      .then(setAgents)
      .catch(() => setError("Failed to load agents"));
    fetch(`${API_BASE}/harnesses`)
      .then((r) => r.json() as Promise<Harness[]>)
      .then((harnesses) =>
        setHarnessImages(
          Object.fromEntries(harnesses.flatMap(({ id, image }) => (image ? [[id, image]] : []))),
        ),
      )
      .catch(() => setHarnessImages({}));
  }, []);

  useEffect(load, [load]);

  async function remove(id: string) {
    if (!confirm(`Delete agent "${id}"?`)) return;
    await fetch(`${API_BASE}/agents/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <section>
      <PageHeader title="Agents">
        <Button size="sm" render={<Link href="/agents/new" />} nativeButton={false}>
          <Plus /> New agent
        </Button>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {agents === null ? (
        <p className="py-6 text-sm text-muted-foreground">Loading agents…</p>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg border bg-background">
            <Sparkles className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">Set up your first agent</p>
          <p className="text-sm text-muted-foreground">
            Takes about 30 seconds — give it a name, a model, and a prompt.
          </p>
          <Link href="/agents/new" className="mt-2 text-sm font-medium text-primary">
            Get started →
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-tile p-1.5 ring-1 ring-border">
                  <HarnessImage src={harnessImages[agent.harness.id]} size={36} />
                </div>
                <Link href={`/agents/${agent.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[0.9rem] font-bold">{agent.name}</p>
                  <p className="truncate font-mono text-[0.72rem] text-muted-foreground">
                    {agent.id}
                  </p>
                </Link>
              </div>

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 font-mono text-[0.7rem] text-muted-foreground">
                <span>{agent.harness.id}</span>
                <span>{agent.harness.config.model}</span>
                <div className="ml-auto flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="xs"
                    render={<Link href={`/chat/${agent.id}`} />}
                    nativeButton={false}
                  >
                    Chat
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => remove(agent.id)}>
                    Delete
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
