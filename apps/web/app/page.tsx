"use client";

import { ArrowUp, MessageSquare, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { BUILDER_AGENT_ID, builderChatHref, relativeTime } from "@/lib/builder";
import HarnessImage from "./agents/HarnessImage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

type Agent = { id: string; name: string; harness: { id: string; config: { model: string } } };
type Conversation = { conversationId: string; title: string; updatedAt: number };

export default function HomePage() {
  const router = useRouter();
  const [prompt, setPrompt] = useState("");
  // null = still checking. The builder ships in config/builtin-agents, but a deployment can drop
  // it — home has to degrade rather than break.
  const [builderReady, setBuilderReady] = useState<boolean | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [harnessImages, setHarnessImages] = useState<Record<string, string>>({});
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [now, setNow] = useState<number | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    // Set after mount so server and client agree on relative timestamps.
    setNow(Date.now());
    fetch(`${API_BASE}/agents/${BUILDER_AGENT_ID}`)
      .then((r) => setBuilderReady(r.ok))
      .catch(() => setBuilderReady(false));
    fetch(`${API_BASE}/agents`)
      .then((r) => r.json() as Promise<Agent[]>)
      .then(setAgents)
      .catch(() => setAgents([]));
    fetch(`${API_BASE}/harnesses`)
      .then((r) => r.json() as Promise<{ id: string; image?: string }[]>)
      .then((hs) =>
        setHarnessImages(
          Object.fromEntries(hs.flatMap(({ id, image }) => (image ? [[id, image]] : []))),
        ),
      )
      .catch(() => setHarnessImages({}));
    fetch(`${API_BASE}/chat/sessions?agentId=${BUILDER_AGENT_ID}`)
      .then((r) => (r.ok ? (r.json() as Promise<Conversation[]>) : []))
      .then((list) => setConversations(list.slice(0, 3)))
      .catch(() => setConversations([]));
  }, []);

  useEffect(() => {
    if (builderReady) inputRef.current?.focus();
  }, [builderReady]);

  function start() {
    if (!prompt.trim() || !builderReady) return;
    router.push(builderChatHref(prompt));
  }

  return (
    <div className="flex min-h-[calc(100svh-6rem)] flex-col items-center justify-center gap-10">
      <div className="w-full max-w-2xl">
        <h1 className="text-center font-display text-3xl font-black tracking-[-0.04em] text-balance text-foreground sm:text-4xl">
          What agent do you want to build?
        </h1>

        {builderReady === false ? (
          <div className="mt-8 text-center">
            <p className="text-sm text-muted-foreground">
              The built-in agent builder isn&apos;t available in this deployment.
            </p>
            <Button size="sm" className="mt-4" render={<Link href="/agents/new" />}>
              <Plus /> New agent
            </Button>
          </div>
        ) : (
          <div className="mt-8 flex items-end gap-2 rounded-lg border border-border bg-card p-3 transition-colors focus-within:border-foreground">
            <textarea
              ref={inputRef}
              value={prompt}
              disabled={!builderReady}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  start();
                }
              }}
              rows={2}
              placeholder="A support agent that reads our Linear issues and drafts replies…"
              className="min-w-0 flex-1 resize-none bg-transparent font-mono text-sm leading-6 outline-none placeholder:text-muted-foreground"
            />
            <Button
              size="icon-sm"
              aria-label="Start building"
              disabled={!prompt.trim() || !builderReady}
              onClick={start}
            >
              <ArrowUp />
            </Button>
          </div>
        )}
      </div>

      {agents.length > 0 ? (
        <section className="w-full max-w-3xl">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 className="font-mono text-[0.7rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
              Your agents
            </h2>
            <Link
              href="/agents"
              className="font-mono text-[0.7rem] text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              All agents →
            </Link>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {agents.slice(0, 3).map((agent) => (
              <li key={agent.id}>
                <Link
                  href={`/chat/${agent.id}`}
                  className="flex h-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-4 transition-colors hover:border-foreground"
                >
                  <span className="flex size-9 items-center justify-center rounded-sm bg-tile p-1.5 ring-1 ring-border">
                    <HarnessImage src={harnessImages[agent.harness.id]} size={36} />
                  </span>
                  <span className="truncate font-mono text-[0.85rem] font-bold">{agent.name}</span>
                  <span className="font-mono text-[0.7rem] text-muted-foreground">
                    {agent.harness.config.model}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {conversations.length > 0 && now !== null ? (
        <section className="w-full max-w-3xl">
          <h2 className="mb-3 font-mono text-[0.7rem] font-medium tracking-[0.12em] text-muted-foreground uppercase">
            Pick up where you left off
          </h2>
          <ul className="flex flex-col gap-1">
            {conversations.map((c) => (
              <li key={c.conversationId}>
                <Link
                  href={`/chat/${BUILDER_AGENT_ID}?conversation=${c.conversationId}`}
                  className="flex min-w-0 items-center gap-3 rounded-sm px-2 py-1.5 transition-colors hover:bg-accent"
                >
                  <MessageSquare className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-sm">{c.title}</span>
                  <span className="shrink-0 font-mono text-[0.7rem] text-muted-foreground">
                    {relativeTime(c.updatedAt, now)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
