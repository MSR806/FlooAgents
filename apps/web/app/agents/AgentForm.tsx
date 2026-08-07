"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import MultiSelect, { type Group } from "../components/MultiSelect";
import {
  type AgentValues,
  type HarnessDefinition,
  harnessSelection,
  parseAgentValues,
  parseHarnessRegistry,
} from "./agent-form-helpers";

export type { AgentValues } from "./agent-form-helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

/**
 * High-level Gilly tool capabilities the agent may be granted. These abstractions are what we store
 * and show; the harness maps them to concrete SDK tools. Any tool (or skill) gives the agent a
 * per-session workspace; see the harness loop.
 */
const TOOL_GROUPS: Group[] = [
  {
    label: "",
    options: [
      { value: "Read", description: "read files and search the workspace" },
      { value: "Write", description: "create and edit files" },
      { value: "Bash", description: "run shell commands" },
    ],
  },
];

type ConnectorInfo = { name: string; auth: string; connected: boolean };

const EMPTY: AgentValues = {
  id: "",
  name: "",
  harness: { id: "", config: { model: "" } },
  systemPrompt: "",
};

/** Derive a URL-safe handle from the agent's name (lowercase, hyphenated). */
const slugify = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export default function AgentForm({
  mode,
  initial,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initial?: AgentValues;
  /** Called with the saved config instead of navigating away (used by the detail page). */
  onSaved?: (agent: AgentValues) => void;
  /** Called instead of navigating home on cancel. */
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [values, setValues] = useState<AgentValues>(initial ?? EMPTY);
  const [harnesses, setHarnesses] = useState<HarnessDefinition[]>([]);
  const [harnessStatus, setHarnessStatus] = useState<"loading" | "ready" | "error">("loading");
  const [allSkills, setAllSkills] = useState<{ name: string; description: string }[]>([]);
  const [allConnectors, setAllConnectors] = useState<ConnectorInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/harnesses`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed (${r.status})`);
        return r.json();
      })
      .then((registry) => {
        setHarnesses(parseHarnessRegistry(registry));
        setHarnessStatus("ready");
      })
      .catch(() => {
        setHarnesses([]);
        setHarnessStatus("error");
      });
    fetch(`${API_BASE}/skills`)
      .then((r) => r.json() as Promise<{ name: string; description: string }[]>)
      .then(setAllSkills)
      .catch(() => setAllSkills([]));
    fetch(`${API_BASE}/connectors`)
      .then((r) => r.json() as Promise<{ connectors: ConnectorInfo[] }>)
      .then((d) => setAllConnectors(d.connectors ?? []))
      .catch(() => setAllConnectors([]));
  }, []);

  const set = <K extends keyof AgentValues>(key: K, value: AgentValues[K]) =>
    setValues((v) => ({ ...v, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // On create the handle is derived from the name; on edit it's fixed (it's the address).
    const id = mode === "create" ? slugify(values.name) : values.id;
    if (!id) {
      setError("Enter a name with at least one letter or number.");
      return;
    }
    setSaving(true);
    const payload = {
      ...values,
      id,
      tools: values.tools?.length ? values.tools : undefined,
      skills: values.skills?.length ? values.skills : undefined,
      connectors: values.connectors?.length ? values.connectors : undefined,
    };
    const url = mode === "create" ? `${API_BASE}/agents` : `${API_BASE}/agents/${id}`;
    try {
      const res = await fetch(url, {
        method: mode === "create" ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Request failed (${res.status})`);
      }
      const saved = parseAgentValues(await res.json());
      if (onSaved) onSaved(saved);
      else router.push(mode === "create" ? `/chat/${id}` : "/agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  const selection = harnessSelection(harnesses, values.harness);
  const selectedHarnessName = selection.selected?.name ?? values.harness.id;
  const selectedModelName = selection.selected?.models.find(
    (model) => model.id === values.harness.config.model,
  )?.name;

  return (
    <form className="flex max-w-2xl flex-col gap-5" onSubmit={submit}>
      <div className="grid gap-2">
        <Label htmlFor="agent-name">Name</Label>
        <Input
          id="agent-name"
          value={values.name}
          required
          placeholder="Coder"
          onChange={(e) => set("name", e.target.value)}
        />
        {mode === "create" ? (
          <p className="text-xs text-muted-foreground">
            Handle: <code>{slugify(values.name) || "…"}</code> (auto-generated, used in the URL)
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Handle: <code>{values.id}</code> (fixed)
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agent-harness">Harness</Label>
        <Select
          value={values.harness.id}
          onValueChange={(id) => id && set("harness", { id, config: { model: "" } })}
        >
          <SelectTrigger id="agent-harness" className="w-full">
            <SelectValue placeholder="Select a harness">
              {selectedHarnessName || undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {selection.enabled.map((harness) => (
              <SelectItem key={harness.id} value={harness.id}>
                {harness.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {harnessStatus === "loading" ? (
          <p className="text-xs text-muted-foreground">Loading available harnesses…</p>
        ) : harnessStatus === "error" ? (
          <p className="text-xs text-destructive">Harness registry unavailable.</p>
        ) : values.harness.id && !selection.selected ? (
          <p className="text-xs text-destructive">
            This harness is unavailable or disabled. Select a replacement before saving.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agent-model">Model</Label>
        <Select
          value={values.harness.config.model}
          disabled={!selection.selected}
          onValueChange={(model) =>
            model && set("harness", { id: values.harness.id, config: { model } })
          }
        >
          <SelectTrigger id="agent-model" className="w-full">
            <SelectValue placeholder="Select a model">
              {(selectedModelName ?? values.harness.config.model) || undefined}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {selection.selected?.models.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {selection.selected && values.harness.config.model && !selection.modelValid ? (
          <p className="text-xs text-destructive">
            This model is not offered by the selected harness. Select a replacement before saving.
          </p>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="agent-prompt">System prompt</Label>
        <Textarea
          id="agent-prompt"
          value={values.systemPrompt}
          required
          rows={5}
          placeholder="Role, scope, and style — not the task."
          onChange={(e) => set("systemPrompt", e.target.value)}
        />
      </div>

      <div className="grid gap-2">
        <Label>Built-in tools</Label>
        <MultiSelect
          groups={TOOL_GROUPS}
          selected={values.tools ?? []}
          onChange={(tools) => set("tools", tools)}
          placeholder="No tools (chat-only)"
        />
      </div>

      <div className="grid gap-2">
        <Label>Skills</Label>
        {allSkills.length === 0 ? (
          <p className="text-xs text-muted-foreground">No skills yet — create one to attach it.</p>
        ) : (
          <MultiSelect
            groups={[
              {
                label: "Skills",
                options: allSkills.map((s) => ({ value: s.name, description: s.description })),
              },
            ]}
            selected={values.skills ?? []}
            onChange={(skills) => set("skills", skills)}
            placeholder="No skills attached"
          />
        )}
      </div>

      <div className="grid gap-2">
        <Label>Tools</Label>
        {allConnectors.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No tools available — configure one on the{" "}
            <a href="/connectors" className="underline">
              Tools
            </a>{" "}
            page first.
          </p>
        ) : (
          <MultiSelect
            groups={[
              {
                label: "Tools",
                options: allConnectors.map((c) => ({
                  value: c.name,
                  description: `${c.connected ? "connected" : "not connected"} · auth: ${c.auth}`,
                })),
              },
            ]}
            selected={values.connectors ?? []}
            onChange={(connectors) => set("connectors", connectors)}
            placeholder="No tools — agent can't call external tools"
          />
        )}
        <p className="text-xs text-muted-foreground">
          What this agent may reach. A user still needs a matching grant to call a tool.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !selection.valid}>
          {saving ? "Saving…" : mode === "create" ? "Create & chat" : "Save"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => (onCancel ? onCancel() : router.push("/agents"))}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}
