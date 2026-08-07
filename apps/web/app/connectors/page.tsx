"use client";

import { Cable, Search } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type ComposioToolkit,
  type ConnectionFeedback,
  parseConnectionFeedback,
  parseToolkitPage,
  toolkitSearchUrl,
} from "./connectors-helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

type Connector = {
  name: string;
  kind: "api" | "mcp";
  auth: "none" | "api_key" | "oauth";
  connected: boolean;
  requiredCreds: string[];
  toolCount?: number;
};

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[] | null>(null);
  const [customError, setCustomError] = useState<string | null>(null);
  const [toolkits, setToolkits] = useState<ComposioToolkit[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [toolkitError, setToolkitError] = useState<string | null>(null);
  const [toolkitLoading, setToolkitLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [feedback, setFeedback] = useState<ConnectionFeedback | null>(null);

  const loadCustom = useCallback(() => {
    setCustomError(null);
    fetch(`${API_BASE}/connectors`)
      .then((response) => {
        if (!response.ok) throw new Error(`Request failed (${response.status})`);
        return response.json() as Promise<{ connectors: Connector[] }>;
      })
      .then((data) => setConnectors(data.connectors))
      .catch(() => setCustomError("Failed to load custom tools"));
  }, []);

  const loadToolkits = useCallback(async (search: string, cursor?: string) => {
    setToolkitLoading(true);
    setToolkitError(null);
    try {
      const response = await fetch(toolkitSearchUrl(API_BASE, search, cursor));
      if (!response.ok) throw new Error(`Request failed (${response.status})`);
      const page = parseToolkitPage(await response.json());
      setConfigured(page.configured);
      setToolkits((current) => (cursor ? [...current, ...page.items] : page.items));
      setNextCursor(page.nextCursor);
    } catch {
      setToolkitError("Failed to load Composio toolkits");
    } finally {
      setToolkitLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCustom();
    void loadToolkits("");
    setFeedback(parseConnectionFeedback(window.location.search));
  }, [loadCustom, loadToolkits]);

  function search(event: React.FormEvent) {
    event.preventDefault();
    const nextQuery = query.trim();
    setActiveQuery(nextQuery);
    void loadToolkits(nextQuery);
  }

  return (
    <div className="flex flex-col gap-10">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Tools</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure the concrete tools available to agents and user grants.
        </p>
      </div>

      {feedback ? (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className={
            feedback.kind === "error"
              ? "text-sm text-destructive"
              : "text-sm text-green-700 dark:text-green-400"
          }
        >
          {feedback.message}
        </p>
      ) : null}

      <section aria-labelledby="custom-tools-heading" className="grid gap-4">
        <div>
          <h2 id="custom-tools-heading" className="text-lg font-semibold">
            Custom tools
          </h2>
          <p className="text-sm text-muted-foreground">Tools hosted directly by your gateway.</p>
        </div>

        {customError ? <p className="text-sm text-destructive">{customError}</p> : null}
        {connectors === null ? (
          <p className="py-4 text-sm text-muted-foreground">Loading custom tools…</p>
        ) : connectors.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            No custom tools configured.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-3">
            {connectors.map((connector) => (
              <ConnectorCard key={connector.name} connector={connector} onChange={loadCustom} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="composio-tools-heading" className="grid gap-4">
        <div>
          <h2 id="composio-tools-heading" className="text-lg font-semibold">
            Composio tools
          </h2>
          <p className="text-sm text-muted-foreground">
            Connect a shared Composio project, then enable the upstream toolkits you need.
          </p>
        </div>

        {configured === null ? (
          <p className="py-4 text-sm text-muted-foreground">Loading Composio setup…</p>
        ) : (
          <div className="rounded-xl border bg-card p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-medium">Composio project API key</p>
                <p className="text-xs text-muted-foreground">
                  One shared project key is used for all agents.
                </p>
              </div>
              <Badge variant={configured ? "secondary" : "outline"}>
                {configured ? "Configured" : "Setup required"}
              </Badge>
            </div>
            <ApiKeyField
              name="composio"
              credKey="api_key"
              connected={configured}
              onSaved={() => loadToolkits(activeQuery)}
            />
          </div>
        )}

        <form className="flex flex-col gap-2 sm:flex-row" onSubmit={search}>
          <Label htmlFor="toolkit-search" className="sr-only">
            Search Composio toolkits
          </Label>
          <Input
            id="toolkit-search"
            type="search"
            value={query}
            placeholder="Search toolkits"
            disabled={!configured}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={!configured || toolkitLoading}>
            <Search /> Search
          </Button>
        </form>

        {toolkitError ? <p className="text-sm text-destructive">{toolkitError}</p> : null}
        {!configured && configured !== null ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            Add the Composio project API key to browse and connect toolkits.
          </p>
        ) : toolkitLoading && toolkits.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Loading toolkits…</p>
        ) : toolkits.length === 0 ? (
          <p className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
            No toolkits found.
          </p>
        ) : (
          <>
            <ul className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2">
              {toolkits.map((toolkit) => (
                <ToolkitCard key={toolkit.slug} toolkit={toolkit} />
              ))}
            </ul>
            {nextCursor ? (
              <Button
                className="justify-self-center"
                variant="outline"
                disabled={toolkitLoading}
                onClick={() => loadToolkits(activeQuery, nextCursor)}
              >
                {toolkitLoading ? "Loading…" : "Load more"}
              </Button>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}

function ConnectorCard({ connector, onChange }: { connector: Connector; onChange: () => void }) {
  const { name, auth, connected, requiredCreds } = connector;
  return (
    <li className="rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-background">
            <Cable className="size-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-medium">{name}</p>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <ConnectionStatus connected={connected} />
              <span>auth: {auth}</span>
              {connector.toolCount !== undefined ? <span>{connector.toolCount} tools</span> : null}
            </div>
          </div>
        </div>
        {auth === "oauth" ? <OAuthConnect name={name} connected={connected} /> : null}
      </div>

      {auth === "none" ? (
        <p className="mt-3 text-xs text-muted-foreground">No setup needed.</p>
      ) : null}

      {auth === "api_key" ? (
        <div className="mt-4 flex flex-col gap-3 border-t pt-4">
          {requiredCreds.map((key) => (
            <ApiKeyField
              key={key}
              name={name}
              credKey={key}
              connected={connected}
              onSaved={onChange}
            />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function ToolkitCard({ toolkit }: { toolkit: ComposioToolkit }) {
  const connect = () => {
    window.location.assign(
      `${API_BASE}/composio/toolkits/${encodeURIComponent(toolkit.slug)}/connect`,
    );
  };

  return (
    <li className="flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-4 sm:flex-row sm:items-start">
      <div className="flex min-w-0 flex-1 gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-background">
          {toolkit.logo ? (
            <Image
              src={toolkit.logo}
              alt=""
              width={28}
              height={28}
              className="size-7 object-contain"
              unoptimized
            />
          ) : (
            <Cable className="size-4 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{toolkit.name}</p>
            {toolkit.noAuth ? (
              <Badge variant="outline">No auth required</Badge>
            ) : toolkit.connected ? (
              <Badge variant="secondary">Connected</Badge>
            ) : (
              <Badge variant="outline">Not connected</Badge>
            )}
          </div>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{toolkit.description}</p>
          <p className="mt-2 text-xs text-muted-foreground">
            {toolkit.toolsCount} {toolkit.toolsCount === 1 ? "tool" : "tools"}
          </p>
        </div>
      </div>
      {!toolkit.noAuth ? (
        <Button
          className="w-full sm:w-auto"
          variant={toolkit.connected ? "outline" : "default"}
          size="sm"
          onClick={connect}
        >
          {toolkit.connected ? "Reconnect" : "Connect"}
        </Button>
      ) : null}
    </li>
  );
}

function ConnectionStatus({ connected }: { connected: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-full ${connected ? "bg-green-500" : "bg-destructive"}`} />
      {connected ? "Connected" : "Not connected"}
    </span>
  );
}

function ApiKeyField({
  name,
  credKey,
  connected,
  onSaved,
}: {
  name: string;
  credKey: string;
  connected: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(!connected);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `${API_BASE}/connectors/${encodeURIComponent(name)}/credentials`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ key: credKey, value }),
        },
      );
      if (!response.ok) throw new Error(`Save failed (${response.status})`);
      setValue("");
      setEditing(false);
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center gap-4">
        <span className="flex-1 text-sm font-medium">{credKey}</span>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Update
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <Label htmlFor={`cred-${name}-${credKey}`}>{credKey}</Label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={`cred-${name}-${credKey}`}
          type="password"
          value={value}
          placeholder={`Paste ${credKey}`}
          onChange={(event) => setValue(event.target.value)}
          autoComplete="off"
        />
        <Button onClick={save} disabled={saving || !value}>
          {saving ? "Saving…" : "Save"}
        </Button>
      </div>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

function OAuthConnect({ name, connected }: { name: string; connected: boolean }) {
  const connect = () => {
    window.location.assign(`${API_BASE}/connectors/${encodeURIComponent(name)}/connect`);
  };
  return (
    <Button
      className="w-full sm:w-auto"
      variant={connected ? "outline" : "default"}
      size="sm"
      onClick={connect}
    >
      {connected ? "Reconnect" : "Connect"}
    </Button>
  );
}
