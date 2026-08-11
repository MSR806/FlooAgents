"use client";

import { MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import type { SlackConnection } from "./connection-helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const DOT: Record<SlackConnection["status"], string> = {
  active: "bg-success",
  disabled: "bg-muted-foreground",
  error: "bg-destructive",
};

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<SlackConnection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetch(`${API_BASE}/slack/connections`)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<SlackConnection[]>;
      })
      .then(setConnections)
      .catch((err: unknown) =>
        setError(err instanceof Error ? err.message : "Failed to load connections"),
      );
  }, []);

  useEffect(load, [load]);

  async function remove(c: SlackConnection) {
    if (!confirm(`Delete Slack bot "${c.name}"? It will stop responding.`)) return;
    setError(null);
    try {
      const response = await fetch(`${API_BASE}/slack/connections/${c.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete connection");
    }
  }

  return (
    <section>
      <PageHeader title="Connections">
        <Button size="sm" render={<Link href="/connections/new" />} nativeButton={false}>
          <Plus /> New connection
        </Button>
      </PageHeader>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {connections === null ? (
        error ? null : (
          <p className="py-6 text-sm text-muted-foreground">Loading connections…</p>
        )
      ) : connections.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card px-6 py-16 text-center">
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg border bg-background">
            <MessageSquare className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">Connect a Slack workspace</p>
          <p className="text-sm text-muted-foreground">
            Create a Slack app and add its tokens. You can connect it to an agent afterward.
          </p>
          <Link href="/connections/new" className="mt-2 text-sm font-medium text-primary">
            Get started →
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {connections.map((c) => (
            <li
              key={c.id}
              className="flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand"
            >
              <div className="flex min-w-0 items-start gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-sm border border-border bg-background">
                  <MessageSquare className="size-4 text-muted-foreground" />
                </div>
                <Link href={`/connections/${c.id}`} className="min-w-0 flex-1">
                  <p className="truncate font-mono text-[0.9rem] font-bold">{c.name}</p>
                  <p className="truncate font-mono text-[0.72rem] text-muted-foreground">
                    {c.teamName ?? c.teamId ?? "Workspace unavailable"}
                  </p>
                </Link>
              </div>

              {c.status === "error" && c.lastError ? (
                <p className="truncate text-xs text-destructive">{c.lastError}</p>
              ) : null}

              <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-border pt-2.5 font-mono text-[0.7rem] text-muted-foreground">
                {c.agentId ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className={`size-2 rounded-full ${DOT[c.status]}`} />
                      {c.status}
                    </span>
                    <span className="truncate">{c.agentId}</span>
                  </>
                ) : (
                  <span className="text-foreground">available</span>
                )}
                <div className="ml-auto flex shrink-0 gap-1">
                  <Button
                    variant="outline"
                    size="xs"
                    render={<Link href={`/connections/${c.id}`} />}
                    nativeButton={false}
                  >
                    Edit
                  </Button>
                  <Button variant="ghost" size="xs" onClick={() => remove(c)}>
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
