"use client";

import { X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { type SlackConnection, slackStartupError } from "../../connections/connection-helpers";
import AgentForm, { type AgentValues } from "../AgentForm";
import {
  type GatewayTool,
  gatewayToolkitNames,
  parseAgentValues,
  parseGatewayTools,
} from "../agent-form-helpers";
import HarnessImage from "../HarnessImage";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

const CONNECTION_DOT: Record<SlackConnection["status"], string> = {
  active: "bg-success",
  disabled: "bg-muted-foreground",
  error: "bg-destructive",
};

export default function AgentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentValues | null>(null);
  const [harnessImages, setHarnessImages] = useState<Record<string, string>>({});
  const [gatewayCatalog, setGatewayCatalog] = useState<GatewayTool[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [connections, setConnections] = useState<SlackConnection[] | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState("");
  const [binding, setBinding] = useState(false);
  const slackDialog = useRef<HTMLDialogElement>(null);

  const loadConnections = useCallback(async () => {
    setConnectionError(null);
    try {
      const response = await fetch(`${API_BASE}/slack/connections`);
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const items = (await response.json()) as SlackConnection[];
      setConnections(items);
      setSelectedConnectionId(items.find((connection) => connection.agentId === id)?.id ?? "");
      return true;
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : "Failed to load Slack connections");
      return false;
    }
  }, [id]);

  useEffect(() => {
    fetch(`${API_BASE}/agents/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then(parseAgentValues)
      .then(setAgent)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Failed to load agent"));
    fetch(`${API_BASE}/harnesses`)
      .then((r) => r.json() as Promise<{ id: string; image?: string }[]>)
      .then((harnesses) =>
        setHarnessImages(
          Object.fromEntries(harnesses.flatMap(({ id, image }) => (image ? [[id, image]] : []))),
        ),
      )
      .catch(() => setHarnessImages({}));
    fetch(`${API_BASE}/tools`)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json();
      })
      .then(parseGatewayTools)
      .then(setGatewayCatalog)
      .catch(() => setGatewayCatalog([]));
    void loadConnections();
  }, [id, loadConnections]);

  const currentConnection = connections?.find((connection) => connection.agentId === id);
  const selectableConnections =
    connections?.filter((connection) => !connection.agentId || connection.agentId === id) ?? [];
  const retryCurrent =
    !!currentConnection &&
    selectedConnectionId === currentConnection.id &&
    currentConnection.status !== "active";

  async function setSlackConnection(connectionId: string | null) {
    if (
      connectionId &&
      currentConnection &&
      connectionId !== currentConnection.id &&
      !confirm(`Replace Slack bot "${currentConnection.name}" for this agent?`)
    ) {
      return;
    }

    setBinding(true);
    setConnectionError(null);
    try {
      const response = await fetch(
        `${API_BASE}/agents/${encodeURIComponent(id)}/slack-connection`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ connectionId }),
        },
      );
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${response.status})`);
      }
      const bound = (await response.json()) as SlackConnection | null;
      const startupError = slackStartupError(bound);
      if (!(await loadConnections())) return;
      if (startupError) {
        setConnectionError(startupError);
        return;
      }
      slackDialog.current?.close();
    } catch (err) {
      setConnectionError(err instanceof Error ? err.message : "Failed to update Slack connection");
    } finally {
      setBinding(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 pb-12">
      <Link href="/agents" className="text-sm text-muted-foreground hover:text-foreground">
        ← Agents
      </Link>

      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : agent === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <header className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-lg bg-tile p-3 ring-1 ring-border">
                <HarnessImage src={harnessImages[agent.harness.id]} size={64} />
              </div>
              <div className="min-w-0">
                <h1 className="font-display text-2xl font-black tracking-[-0.03em]">
                  {agent.name}
                </h1>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
                  <code className="text-xs">{agent.id}</code>
                  <span aria-hidden="true">·</span>
                  <code className="text-xs">{agent.harness.id}</code>
                  <span aria-hidden="true">·</span>
                  <code className="break-all text-xs">{agent.harness.config.model}</code>
                </p>
              </div>
            </div>
            {!editing ? (
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="px-4"
                  onClick={() => slackDialog.current?.showModal()}
                >
                  <SlackIcon className="size-4" />
                  {currentConnection?.name ?? "Add to Slack"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="px-4"
                  onClick={() => setEditing(true)}
                >
                  Update
                </Button>
              </div>
            ) : null}
          </header>

          <dialog
            ref={slackDialog}
            aria-labelledby="slack-connection-heading"
            className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/40"
            onClick={(event) => {
              if (event.target === event.currentTarget) event.currentTarget.close();
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.close();
            }}
          >
            <div className="flex flex-col">
              <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
                <div>
                  <h2 id="slack-connection-heading" className="font-semibold">
                    Connect to Slack
                  </h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Choose the Slack bot that should run this agent.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Close"
                  onClick={() => slackDialog.current?.close()}
                >
                  <X />
                </Button>
              </header>
              <div className="flex flex-col gap-4 px-5 py-5">
                {connectionError ? (
                  <div
                    className="flex flex-wrap items-center gap-3"
                    role="alert"
                    aria-live="assertive"
                  >
                    <p className="text-sm text-destructive">{connectionError}</p>
                    <Button variant="outline" size="sm" onClick={() => void loadConnections()}>
                      Retry
                    </Button>
                  </div>
                ) : null}
                {connections === null ? (
                  connectionError ? null : (
                    <p className="text-sm text-muted-foreground">Loading Slack connections…</p>
                  )
                ) : (
                  <div className="flex flex-col gap-5">
                    {currentConnection ? (
                      <div className="flex flex-col gap-2 rounded-lg bg-muted/50 p-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <Link
                            href={`/connections/${currentConnection.id}`}
                            className="font-medium hover:underline"
                          >
                            {currentConnection.name}
                          </Link>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-sm text-muted-foreground">
                            <span>
                              {currentConnection.teamName ??
                                currentConnection.teamId ??
                                "Workspace unavailable"}
                            </span>
                            <span className="inline-flex items-center gap-1.5 capitalize">
                              <span
                                className={`size-2 rounded-full ${CONNECTION_DOT[currentConnection.status]}`}
                              />
                              {currentConnection.status}
                            </span>
                          </div>
                          {currentConnection.status === "error" && currentConnection.lastError ? (
                            <p className="mt-1 text-xs text-destructive">
                              {currentConnection.lastError}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="self-start"
                          disabled={binding}
                          onClick={() => setSlackConnection(null)}
                        >
                          Disconnect
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">Not connected</p>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="grid min-w-0 flex-1 gap-2">
                        <Label htmlFor="agent-slack-connection">Slack bot</Label>
                        <select
                          id="agent-slack-connection"
                          value={selectedConnectionId}
                          disabled={selectableConnections.length === 0 || binding}
                          className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
                          onChange={(event) => setSelectedConnectionId(event.target.value)}
                        >
                          <option value="" disabled>
                            Select an available bot
                          </option>
                          {selectableConnections.map((connection) => (
                            <option key={connection.id} value={connection.id}>
                              {connection.name}
                              {connection.id === currentConnection?.id ? " (current)" : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <footer className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
                <Button
                  variant="link"
                  size="sm"
                  className="px-0"
                  render={
                    <Link
                      href={{
                        pathname: "/connections/new",
                        query: { bindTo: id, returnTo: `/agents/${id}` },
                      }}
                    />
                  }
                  nativeButton={false}
                >
                  Create new bot
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => slackDialog.current?.close()}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    disabled={
                      binding ||
                      !selectedConnectionId ||
                      (selectedConnectionId === currentConnection?.id && !retryCurrent)
                    }
                    onClick={() => setSlackConnection(selectedConnectionId)}
                  >
                    {binding
                      ? "Saving…"
                      : retryCurrent
                        ? "Retry"
                        : currentConnection
                          ? "Change bot"
                          : "Connect"}
                  </Button>
                </div>
              </footer>
            </div>
          </dialog>

          {editing ? (
            <section className="border-t pt-8">
              <AgentForm
                mode="edit"
                initial={agent}
                onSaved={(a) => {
                  setAgent(a);
                  setEditing(false);
                }}
                onCancel={() => setEditing(false)}
              />
            </section>
          ) : (
            <>
              <section aria-labelledby="capabilities-heading">
                <h2 id="capabilities-heading" className="mb-3 text-sm font-semibold">
                  Capabilities
                </h2>
                <CapabilityRow
                  label="Built-in tools"
                  items={agent.tools}
                  empty="None (chat-only)"
                />
                <CapabilityRow
                  label="Skills"
                  items={agent.skills}
                  empty="None"
                  href={(skill) => `/skills/${skill}`}
                />
                <CapabilityRow
                  label="Gateway toolkits"
                  items={gatewayToolkitNames(agent.gatewayTools, gatewayCatalog)}
                  empty="None"
                  href={() => "/connectors"}
                />
              </section>

              <section className="border-t pt-8" aria-labelledby="instructions-heading">
                <h2 id="instructions-heading" className="mb-5 text-lg font-semibold">
                  Instructions
                </h2>
                <InstructionsMarkdown>{agent.systemPrompt}</InstructionsMarkdown>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SlackIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#36C5F0"
        d="M5.04 15.17a2.53 2.53 0 1 1-2.52-2.53h2.52v2.53Zm1.28 0a2.53 2.53 0 1 1 5.05 0v6.32a2.53 2.53 0 1 1-5.05 0v-6.32Z"
      />
      <path
        fill="#2EB67D"
        d="M8.83 5.04a2.53 2.53 0 1 1 2.54-2.52v2.52H8.83Zm0 1.28a2.53 2.53 0 1 1 0 5.05H2.52a2.53 2.53 0 1 1 0-5.05h6.31Z"
      />
      <path
        fill="#ECB22E"
        d="M18.96 8.83a2.53 2.53 0 1 1 2.52 2.54h-2.52V8.83Zm-1.28 0a2.53 2.53 0 1 1-5.05 0V2.52a2.53 2.53 0 1 1 5.05 0v6.31Z"
      />
      <path
        fill="#E01E5A"
        d="M15.17 18.96a2.53 2.53 0 1 1-2.54 2.52v-2.52h2.54Zm0-1.28a2.53 2.53 0 1 1 0-5.05h6.31a2.53 2.53 0 1 1 0 5.05h-6.31Z"
      />
    </svg>
  );
}

function CapabilityRow({
  label,
  items,
  empty,
  href,
}: {
  label: string;
  items?: string[];
  empty: string;
  /** When set, each badge links to href(item). */
  href?: (item: string) => string;
}) {
  return (
    <div className="grid gap-2 border-t py-4 sm:grid-cols-[160px_minmax(0,1fr)] sm:items-start sm:gap-6">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {items?.length ? (
        <span className="flex flex-wrap gap-1.5">
          {items.map((item) =>
            href ? (
              <Link key={item} href={href(item)}>
                <Badge variant="outline" className="hover:bg-muted hover:underline">
                  {item}
                </Badge>
              </Link>
            ) : (
              <Badge key={item} variant="outline">
                {item}
              </Badge>
            ),
          )}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">{empty}</span>
      )}
    </div>
  );
}

function InstructionsMarkdown({ children }: { children: string }) {
  return (
    <div className="max-w-3xl break-words text-[15px] leading-7 text-foreground/90 [&_a]:underline [&_blockquote]:my-5 [&_blockquote]:border-l-2 [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.9em] [&_h1]:mt-8 [&_h1]:mb-3 [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:mt-7 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:ml-5 [&_ol]:my-4 [&_ol]:list-decimal [&_p]:my-4 [&_p:first-child]:mt-0 [&_pre]:my-5 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-muted [&_pre]:p-4 [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_strong]:font-semibold [&_ul]:my-4 [&_ul]:list-disc">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          table: ({ children: tableChildren }) => (
            <div className="my-5 overflow-x-auto rounded-lg border">
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
