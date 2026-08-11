"use client";

import { Check, Copy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { type SlackConnection, slackBotName, slackStartupError } from "./connection-helpers";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

// Socket Mode → no public URL, so the manifest is static except the bot name (mirrors
// docs/slack-app-manifest.yaml). The name lands in both display_information and bot_user.
const buildManifest = (botName: string) => `display_information:
  name: ${botName}
  description: Any agent. Any harness. Any channel.
  background_color: "#091c32"
features:
  bot_user:
    display_name: ${botName}
    always_online: true
oauth_config:
  scopes:
    bot:
      - chat:write
      - app_mentions:read
      - reactions:write
      - channels:history
      - groups:history
      - users:read
settings:
  event_subscriptions:
    bot_events:
      - app_mention
  socket_mode_enabled: true
`;

export type ConnectionValues = {
  name: string;
  botToken: string;
  appToken: string;
};

const CREATE_STEPS = ["Name", "Create app", "Tokens"];

export default function ConnectionForm({
  mode,
  id,
  initial,
  onSaved,
  onCancel,
  bindTo,
  returnTo,
}: {
  mode: "create" | "edit";
  /** Connection id (edit mode). */
  id?: string;
  initial?: Partial<ConnectionValues>;
  onSaved?: () => void;
  onCancel?: () => void;
  bindTo?: string;
  returnTo?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Create-wizard state. `suffix` → botName `flooagents-<suffix>` (also the connection name).
  const [step, setStep] = useState(0);
  const [suffix, setSuffix] = useState("");
  const botName = slackBotName(suffix);

  // Shared token state (create + edit).
  const [name, setName] = useState(initial?.name ?? "");
  const [botToken, setBotToken] = useState("");
  const [appToken, setAppToken] = useState("");

  async function copyManifest() {
    await navigator.clipboard.writeText(buildManifest(botName || "flooagents-bot"));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function verifyBotToken() {
    setTesting(true);
    setTestResult(null);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/slack/connections/test`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ botToken }),
      });
      const body = (await res.json()) as { ok?: boolean; team?: string; error?: string };
      if (res.ok && body.ok) setTestResult(`Connected to ${body.team || "workspace"} ✓`);
      else setError(body.error ?? "Bot token verification failed");
    } catch {
      setError("Bot token verification failed");
    } finally {
      setTesting(false);
    }
  }

  async function bindCreatedConnection(connectionId: string) {
    const response = await fetch(
      `${API_BASE}/agents/${encodeURIComponent(bindTo as string)}/slack-connection`,
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
    if (startupError) throw new Error(startupError);
    router.push(returnTo ?? "/connections");
  }

  async function submit() {
    setError(null);
    setSaving(true);
    if (createdId && bindTo) {
      try {
        await bindCreatedConnection(createdId);
      } catch (err) {
        setError(
          `Bot created, but it could not be connected: ${err instanceof Error ? err.message : "Binding failed"}`,
        );
        setSaving(false);
      }
      return;
    }

    // On edit, only send tokens the user re-entered (blank = keep existing).
    const payload =
      mode === "create"
        ? { name: botName, botToken, appToken }
        : {
            name,
            ...(botToken ? { botToken } : {}),
            ...(appToken ? { appToken } : {}),
          };
    const url =
      mode === "create" ? `${API_BASE}/slack/connections` : `${API_BASE}/slack/connections/${id}`;
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
      const saved = (await res.json()) as SlackConnection;
      if (mode === "create" && bindTo) {
        setCreatedId(saved.id);
        try {
          await bindCreatedConnection(saved.id);
        } catch (err) {
          throw new Error(
            `Bot created, but it could not be connected: ${err instanceof Error ? err.message : "Binding failed"}`,
          );
        }
      } else if (onSaved) onSaved();
      else router.push("/connections");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  // --- Edit: a flat form (the Slack app already exists; just rename / rotate tokens) ---
  if (mode === "edit") {
    return (
      <div className="flex max-w-2xl flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="conn-name">Name</Label>
          <Input id="conn-name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="conn-bot">Bot token</Label>
          <Input
            id="conn-bot"
            type="password"
            value={botToken}
            placeholder="Leave blank to keep current"
            autoComplete="off"
            onChange={(e) => {
              setBotToken(e.target.value);
              setTestResult(null);
            }}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="conn-app">App token</Label>
          <Input
            id="conn-app"
            type="password"
            value={appToken}
            placeholder="Leave blank to keep current"
            autoComplete="off"
            onChange={(e) => setAppToken(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={verifyBotToken}
            disabled={testing || !botToken}
          >
            {testing ? "Verifying…" : "Verify bot token"}
          </Button>
          {testResult ? <span className="text-sm text-success">{testResult}</span> : null}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="button" onClick={submit} disabled={saving || !name}>
            {saving ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.push("/connections"))}
          >
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // --- Create: a next/next wizard ---
  const canAdvance =
    step === 0 ? !!botName : step === 2 ? !!botToken.trim() && !!appToken.trim() : true;
  const last = step === CREATE_STEPS.length - 1;

  return (
    <div className="flex max-w-2xl flex-col gap-5">
      {/* Stepper header */}
      <ol className="flex items-center gap-2 text-xs">
        {CREATE_STEPS.map((label, i) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex size-5 items-center justify-center rounded-full text-[11px] ${
                i < step
                  ? "bg-primary text-primary-foreground"
                  : i === step
                    ? "border border-primary text-primary"
                    : "border text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="size-3" /> : i + 1}
            </span>
            <span className={i === step ? "font-medium" : "text-muted-foreground"}>{label}</span>
            {i < CREATE_STEPS.length - 1 ? <span className="text-muted-foreground">→</span> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <div className="grid gap-2">
          <Label htmlFor="conn-suffix">Bot name</Label>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">flooagents-</span>
            <Input
              id="conn-suffix"
              value={suffix}
              autoFocus
              placeholder="acme"
              onChange={(e) => setSuffix(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Your bot will be named <code>{botName || "flooagents-…"}</code> in Slack and in this
            list.
          </p>
        </div>
      ) : null}

      {step === 1 ? (
        <div className="flex flex-col gap-3 text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-4">
            <li>
              Open{" "}
              <a
                href="https://api.slack.com/apps?new_app=1"
                target="_blank"
                rel="noreferrer"
                className="underline"
              >
                api.slack.com/apps
              </a>{" "}
              → <strong>Create New App</strong> → <strong>From a manifest</strong>.
            </li>
            <li>
              Pick your workspace, paste the manifest below (bot named <code>{botName}</code>), and
              create the app.
            </li>
            <li>
              <strong>Install to Workspace</strong> — you'll grab the tokens on the next step.
            </li>
          </ol>
          <div>
            <Button type="button" variant="outline" size="sm" onClick={copyManifest}>
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
              {copied ? "Copied" : "Copy manifest"}
            </Button>
          </div>
          <pre className="max-h-56 overflow-auto rounded-lg border bg-background p-3 text-xs">
            {buildManifest(botName)}
          </pre>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="conn-bot">Bot token</Label>
            <Input
              id="conn-bot"
              type="password"
              value={botToken}
              placeholder="xoxb-…"
              autoComplete="off"
              onChange={(e) => {
                setBotToken(e.target.value);
                setTestResult(null);
              }}
            />
            <p className="text-xs text-muted-foreground">
              <em>OAuth &amp; Permissions</em> → Bot User OAuth Token.
            </p>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="conn-app">App token</Label>
            <Input
              id="conn-app"
              type="password"
              value={appToken}
              placeholder="xapp-…"
              autoComplete="off"
              onChange={(e) => setAppToken(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              <em>Basic Information → App-Level Tokens</em>, scope <code>connections:write</code>.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={verifyBotToken}
              disabled={testing || !botToken}
            >
              {testing ? "Verifying…" : "Verify bot token"}
            </Button>
            {testResult ? <span className="text-sm text-success">{testResult}</span> : null}
          </div>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        {createdId ? null : step > 0 ? (
          <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            onClick={() => (onCancel ? onCancel() : router.push(returnTo ?? "/connections"))}
          >
            Cancel
          </Button>
        )}
        {createdId ? (
          <>
            <Button type="button" onClick={submit} disabled={saving}>
              {saving ? "Connecting…" : "Retry connection"}
            </Button>
            <Button
              variant="outline"
              render={<Link href={`/connections/${createdId}`} />}
              nativeButton={false}
            >
              Continue to bot
            </Button>
          </>
        ) : last ? (
          <Button
            type="button"
            onClick={submit}
            disabled={saving || !botToken.trim() || !appToken.trim()}
          >
            {saving ? "Saving…" : "Create Slack bot"}
          </Button>
        ) : (
          <Button type="button" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}
