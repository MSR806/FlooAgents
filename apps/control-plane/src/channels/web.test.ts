import { afterEach, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BUILT_IN_HARNESSES } from "@agent-platform/core";
import {
  appendRunStep,
  completeRun,
  createDb,
  createRun,
  failRun,
  getOrCreateSession,
} from "@agent-platform/db";
import type { createEngine } from "../engine.ts";
import { LocalSkillStore } from "../stores/local-skill-store.ts";
import type { SkillStore } from "../stores/skill-store.ts";
import { createWebHandler } from "./web.ts";

// Gateway proxy routes only need db + gateway config; engine/skillStore are unused by them.
const handler = () =>
  createWebHandler({
    engine: {} as ReturnType<typeof createEngine>,
    db: createDb(":memory:"),
    skillStore: {} as SkillStore,
    port: 0,
    gatewayUrl: "http://gw",
    adminToken: "admin-secret",
  });

const delegatedRunRequest = (url: string, init: RequestInit = {}) => {
  const headers = new Headers(init.headers);
  headers.set("x-admin-token", "admin-secret");
  return new Request(url, { ...init, headers });
};

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("harness registry API lists and updates definitions", async () => {
  const fetch = handler();
  const res = await fetch(new Request("http://x/api/harnesses"));

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual(
    [...BUILT_IN_HARNESSES].sort((a, b) => a.id.localeCompare(b.id)),
  );

  const claude = BUILT_IN_HARNESSES.find((harness) => harness.id === "claude");
  const update = await fetch(
    new Request("http://x/api/harnesses/claude", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...claude, enabled: false }),
    }),
  );
  expect(update.status).toBe(200);
  expect(await update.json()).toMatchObject({ id: "claude", enabled: false });
  expect(
    (
      await fetch(
        new Request("http://x/api/harnesses/missing", {
          method: "PUT",
          body: JSON.stringify({ name: "Missing", enabled: true, models: [] }),
        }),
      )
    ).status,
  ).toBe(404);
});

test("agent API returns nested harness summaries and rejects unavailable selections", async () => {
  const db = createDb(":memory:");
  const fetch = createWebHandler({
    engine: {} as ReturnType<typeof createEngine>,
    db,
    skillStore: {} as SkillStore,
    port: 0,
  });
  const agent = {
    id: "helper",
    name: "Helper",
    harness: { id: "codex", config: { model: "gpt-5.2" } },
    systemPrompt: "Help.",
  };
  expect(
    (
      await fetch(
        new Request("http://x/api/agents", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(agent),
        }),
      )
    ).status,
  ).toBe(201);
  expect(await (await fetch(new Request("http://x/api/agents"))).json()).toEqual([
    { id: "helper", name: "Helper", harness: agent.harness },
  ]);

  const bad = await fetch(
    new Request("http://x/api/agents", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...agent,
        id: "bad",
        harness: { id: "codex", config: { model: "not-offered" } },
      }),
    }),
  );
  expect(bad.status).toBe(400);
  expect(await bad.json()).toEqual({ error: 'Harness "codex" does not offer model "not-offered"' });
  expect((await fetch(new Request("http://x/api/agents/%E0%A4%A"))).status).toBe(404);
});

test("PUT credentials proxy injects x-admin-token and forwards the body", async () => {
  let seen: Request | undefined;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    seen = new Request(input as string, init);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;

  const res = await handler()(
    new Request("http://x/api/connectors/github/credentials", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key: "github_pat", value: "SECRET" }),
    }),
  );

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
  expect(seen?.url).toBe("http://gw/admin/credentials/github");
  expect(seen?.headers.get("x-admin-token")).toBe("admin-secret");
  expect(await seen?.text()).toBe(JSON.stringify({ key: "github_pat", value: "SECRET" }));
});

test("GET connectors accepts a browser request and authenticates to the gateway", async () => {
  let seen: Request | undefined;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    seen = new Request(input as string, init);
    return Response.json({ connectors: [] });
  }) as unknown as typeof fetch;

  const res = await handler()(new Request("http://x/api/connectors"));
  expect(await res.json()).toEqual({ connectors: [] });
  expect(seen?.headers.get("x-admin-token")).toBe("admin-secret");
});

test("connect proxy relays the gateway's 302 Location to the browser", async () => {
  let seen: Request | undefined;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    seen = new Request(input as string, init);
    return new Response(null, {
      status: 302,
      headers: { location: "https://auth.atlassian.com/authorize" },
    });
  }) as unknown as typeof fetch;

  const res = await handler()(new Request("http://x/api/connectors/jira/connect"));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("https://auth.atlassian.com/authorize");
  expect(seen?.headers.get("x-admin-token")).toBe("admin-secret");
});

test("connect proxy bounces back to the connectors page when already connected (200)", async () => {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ ok: true, message: "already connected" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    })) as unknown as typeof fetch;

  const res = await handler()(new Request("http://x/api/connectors/jira/connect"));
  expect(res.status).toBe(302);
  expect(res.headers.get("location")).toBe("/connectors?connected=jira");
});

test("GET /api/tools proxies the unified gateway catalog", async () => {
  let seen: Request | undefined;
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    seen = new Request(input as string, init);
    return Response.json({
      tools: [
        {
          name: "gmail.send_email",
          description: "Send email",
          source: "composio",
          toolkit: "gmail",
          connected: true,
        },
      ],
    });
  }) as unknown as typeof fetch;

  const res = await handler()(new Request("http://x/api/tools"));
  expect(seen?.headers.get("x-admin-token")).toBe("admin-secret");
  expect(await res.json()).toEqual({
    tools: [
      {
        name: "gmail.send_email",
        description: "Send email",
        source: "composio",
        toolkit: "gmail",
        connected: true,
      },
    ],
  });
});

test("GET /api/tools reports an unavailable gateway", async () => {
  globalThis.fetch = (async () => {
    throw new Error("offline");
  }) as unknown as typeof fetch;

  const res = await handler()(new Request("http://x/api/tools"));
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "gateway unavailable" });
});

test("gateway proxies fail closed when internal admin auth is not configured", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return Response.json({ tools: [] });
  }) as unknown as typeof fetch;
  const webFetch = createWebHandler({
    engine: {} as ReturnType<typeof createEngine>,
    db: createDb(":memory:"),
    skillStore: {} as SkillStore,
    port: 0,
    gatewayUrl: "http://gw",
  });

  const requests = [
    new Request("http://x/api/connectors"),
    new Request("http://x/api/tools"),
    new Request("http://x/api/composio/toolkits"),
    new Request("http://x/api/composio/toolkits/gmail/connect"),
    new Request("http://x/api/connectors/jira/connect"),
    new Request("http://x/api/connectors/github/credentials", { method: "PUT" }),
  ];
  for (const request of requests) {
    expect((await webFetch(request)).status).toBe(503);
  }
  expect(calls).toBe(0);
});

test("Composio toolkit proxies preserve query, inject admin auth, and relay redirects", async () => {
  const seen: Request[] = [];
  globalThis.fetch = (async (input: Request | string | URL, init?: RequestInit) => {
    const req = new Request(input as string, init);
    seen.push(req);
    if (req.url.includes("/connect")) {
      return new Response(null, {
        status: 302,
        headers: { location: "https://connect.composio.dev" },
      });
    }
    return Response.json({ configured: true, items: [], nextCursor: "next" });
  }) as unknown as typeof fetch;

  const list = await handler()(new Request("http://x/api/composio/toolkits?query=mail&cursor=one"));
  expect(await list.json()).toEqual({ configured: true, items: [], nextCursor: "next" });
  expect(seen[0]?.url).toBe("http://gw/admin/composio/toolkits?query=mail&cursor=one");
  expect(seen[0]?.headers.get("x-admin-token")).toBe("admin-secret");

  const connect = await handler()(new Request("http://x/api/composio/toolkits/gmail/connect"));
  expect(connect.status).toBe(302);
  expect(connect.headers.get("location")).toBe("https://connect.composio.dev");
  expect(seen[1]?.headers.get("x-admin-token")).toBe("admin-secret");
});

test("web API does not advertise cross-origin access or handle CORS preflight", async () => {
  const res = await handler()(new Request("http://x/api/tools", { method: "OPTIONS" }));
  expect(res.status).toBe(404);
  expect(res.headers.get("access-control-allow-origin")).toBeNull();
});

test("POST /api/skills persists a skill with supporting files; GET returns them", async () => {
  const dir = mkdtempSync(join(tmpdir(), "platform-web-skills-"));
  const fetch = createWebHandler({
    engine: {} as ReturnType<typeof createEngine>,
    db: createDb(":memory:"),
    skillStore: new LocalSkillStore(dir),
    port: 0,
    gatewayUrl: "http://gw",
    adminToken: "admin-secret",
  });

  const create = await fetch(
    new Request("http://x/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "cac",
        description: "Run CAC.",
        content: "# CAC",
        files: [{ path: "cac.ts", contents: "console.log(1)" }],
      }),
    }),
  );
  expect(create.status).toBe(201);

  const detail = await (await fetch(new Request("http://x/api/skills/cac"))).json();
  expect(detail).toEqual({
    name: "cac",
    description: "Run CAC.",
    content: "# CAC",
    files: [{ path: "cac.ts", contents: "console.log(1)" }],
  });

  const bad = await fetch(
    new Request("http://x/api/skills", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "evil",
        description: "d",
        content: "c",
        files: [{ path: "../escape.ts", contents: "x" }],
      }),
    }),
  );
  expect(bad.status).toBe(400);
});

test("POST /api/chat emits heartbeats while the engine is silent", async () => {
  const engine = {
    async *stream() {
      await Bun.sleep(15);
      yield { type: "done", finalText: "Done.", harnessSessionId: null } as const;
    },
  } as unknown as ReturnType<typeof createEngine>;
  const fetch = createWebHandler({
    engine,
    db: createDb(":memory:"),
    skillStore: {} as SkillStore,
    port: 0,
    heartbeatMs: 5,
  });

  const response = await fetch(
    new Request("http://x/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId: "helper", message: "wait" }),
    }),
  );
  const events = (await response.text())
    .split("\n\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line.slice("data: ".length)));

  expect(events[0]).toEqual({ type: "heartbeat" });
  expect(events.at(-1)).toEqual({ type: "done", finalText: "Done.", harnessSessionId: null });
});

test("POST /api/agents/:id/runs starts a background run; GET /api/runs/:id reads it", async () => {
  let seen: Record<string, unknown> | undefined;
  const engine = {
    start(input: Record<string, unknown>) {
      if (input.agentId === "missing") throw new Error("Unknown agent: missing");
      seen = input;
      return { runId: "run-1" };
    },
  } as ReturnType<typeof createEngine>;
  const db = createDb(":memory:");
  const fetch = createWebHandler({
    engine,
    db,
    skillStore: {} as SkillStore,
    port: 0,
    adminToken: "admin-secret",
  });

  const res = await fetch(
    delegatedRunRequest("http://x/api/agents/helper/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "do it", userId: "user-1" }),
    }),
  );

  expect(res.status).toBe(202);
  expect(await res.json()).toEqual({ runId: "run-1" });
  expect(seen).toMatchObject({
    agentId: "helper",
    source: "gateway",
    userMessage: "do it",
    userId: "user-1",
  });
  expect(String(seen?.sourceKey).startsWith("gateway:")).toBe(true);

  const bad = await fetch(
    delegatedRunRequest("http://x/api/agents/helper/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  expect(bad.status).toBe(400);
  const unauthorized = await fetch(
    new Request("http://x/api/agents/helper/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "do it", userId: "user-1" }),
    }),
  );
  expect(unauthorized.status).toBe(401);
  const missing = await fetch(
    delegatedRunRequest("http://x/api/agents/missing/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "do it", userId: "user-1" }),
    }),
  );
  expect(missing.status).toBe(404);

  const session = getOrCreateSession(db, {
    agentId: "helper",
    source: "gateway",
    sourceKey: "gateway:status-test",
  });
  const run = createRun(db, session.id, "do it");
  const rawSummary =
    'bun .claude/skills/marketing-metrics/metrics.ts branch_cpi --slug "t6ypbyjup32s" --start 2026-06-23 --end 2026-06-29';
  appendRunStep(db, run.id, { type: "message", text: "Checking" });
  appendRunStep(db, run.id, { type: "tool", name: "Bash", summary: rawSummary });
  expect(await (await fetch(new Request(`http://x/api/runs/${run.id}`))).json()).toEqual({
    id: run.id,
    status: "running",
    steps: [
      { type: "message", text: "Checking" },
      { type: "tool", name: "Bash", summary: rawSummary },
    ],
  });
  completeRun(db, run.id, "Done.");
  const status = await fetch(new Request(`http://x/api/runs/${run.id}`));
  expect(await status.json()).toEqual({
    id: run.id,
    status: "completed",
    steps: [
      { type: "message", text: "Checking" },
      { type: "tool", name: "Bash", summary: rawSummary },
    ],
    output: "Done.",
  });
  const failed = createRun(db, session.id, "fail");
  appendRunStep(db, failed.id, { type: "error", error: "boom" });
  failRun(db, failed.id, "boom");
  expect(await (await fetch(new Request(`http://x/api/runs/${failed.id}`))).json()).toEqual({
    id: failed.id,
    status: "error",
    steps: [{ type: "error", error: "boom" }],
    runError: "boom",
  });
  expect((await fetch(new Request("http://x/api/runs/missing"))).status).toBe(404);
});

test("web chat session history lists conversations and returns turns with tool steps", async () => {
  const db = createDb(":memory:");
  const fetch = createWebHandler({
    engine: {} as ReturnType<typeof createEngine>,
    db,
    skillStore: {} as SkillStore,
    port: 0,
  });
  const session = getOrCreateSession(db, {
    agentId: "helper",
    source: "web",
    sourceKey: "web:conversation-1",
  });
  const run = createRun(db, session.id, "  Inspect   the build  ");
  appendRunStep(db, run.id, { type: "message", text: "I’ll inspect the configuration." });
  appendRunStep(db, run.id, { type: "tool", name: "Read", summary: "package.json" });
  completeRun(db, run.id, "The build is healthy.");
  getOrCreateSession(db, {
    agentId: "helper",
    source: "slack",
    sourceKey: "slack:thread-1",
  });

  const list = await fetch(new Request("http://x/api/chat/sessions?agentId=helper"));
  expect(await list.json()).toEqual([
    {
      conversationId: "conversation-1",
      title: "Inspect the build",
      createdAt: session.createdAt,
      updatedAt: run.createdAt,
    },
  ]);

  const detail = await fetch(
    new Request("http://x/api/chat/sessions/conversation-1?agentId=helper"),
  );
  expect(await detail.json()).toEqual({
    conversationId: "conversation-1",
    createdAt: session.createdAt,
    runs: [
      {
        id: run.id,
        status: "completed",
        input: "  Inspect   the build  ",
        output: "The build is healthy.",
        error: null,
        createdAt: run.createdAt,
        steps: [
          { type: "message", text: "I’ll inspect the configuration." },
          { type: "tool", name: "Read", summary: "package.json" },
        ],
      },
    ],
  });
  expect(
    (await fetch(new Request("http://x/api/chat/sessions/conversation-1?agentId=other"))).status,
  ).toBe(404);
  expect((await fetch(new Request("http://x/api/chat/sessions"))).status).toBe(400);
});

// --- Slack connections: redaction + blank-token-keep (no Slack network needed) ---

import { makeVault } from "@agent-platform/core";
import {
  createAgent,
  createSlackConnection,
  getAgent,
  getSlackConnection,
  setSlackConnectionStatus,
} from "@agent-platform/db";
import type { SlackManager } from "./slack-manager.ts";

/** A no-op Slack manager that records which lifecycle calls the routes make. */
function fakeManager(stopFailures = 0, onRemove?: (id: string) => Promise<void>) {
  const calls: string[] = [];
  let remainingStopFailures = stopFailures;
  const mgr = {
    name: "slack",
    start: async () => {},
    add: async (c: { id: string }) => void calls.push(`add:${c.id}`),
    remove: async (id: string) => {
      calls.push(`remove:${id}`);
      await onRemove?.(id);
      if (remainingStopFailures > 0) {
        remainingStopFailures -= 1;
        throw new Error("stop failed");
      }
    },
    restart: async (c: { id: string }) => void calls.push(`restart:${c.id}`),
  } as unknown as SlackManager;
  return { mgr, calls };
}

/** Handler wired with a real vault, a fake manager, and a seeded agent + connection. */
function slackHandler(stopFailures = 0, onRemove?: (id: string) => Promise<void>) {
  const db = createDb(":memory:");
  const vault = makeVault("test-key");
  const { mgr, calls } = fakeManager(stopFailures, onRemove);
  createAgent(db, {
    id: "coder",
    name: "Coder",
    harness: { id: "claude", config: { model: "claude-sonnet-4-5" } },
    systemPrompt: "x",
  });
  createSlackConnection(db, {
    id: "conn-1",
    name: "Acme",
    agentId: "coder",
    botToken: vault.encrypt("xoxb-secret"),
    appToken: vault.encrypt("xapp-secret"),
    teamId: "T1",
    teamName: "Acme Inc",
    status: "active",
    createdAt: 1,
  });
  const fetch = createWebHandler({
    engine: {} as ReturnType<typeof createEngine>,
    db,
    skillStore: {} as SkillStore,
    port: 0,
    vault,
    slackManager: mgr,
    testSlackAuth: async () => ({ ok: true, team: "Acme Inc", teamId: "T1" }),
  });
  return { fetch, db, vault, calls };
}

test("GET connections never leaks tokens (redacted list + detail)", async () => {
  const { fetch } = slackHandler();
  const list = (await (
    await fetch(new Request("http://x/api/slack/connections"))
  ).json()) as unknown[];
  expect(JSON.stringify(list)).not.toContain("xoxb");
  expect(JSON.stringify(list)).not.toContain("appToken");
  const one = (await (
    await fetch(new Request("http://x/api/slack/connections/conn-1"))
  ).json()) as Record<string, unknown>;
  expect(one).toMatchObject({
    id: "conn-1",
    teamName: "Acme Inc",
    hasBotToken: true,
    hasAppToken: true,
  });
  expect(one.botToken).toBeUndefined();
  expect(one.appToken).toBeUndefined();
});

test("POST creates an unbound disabled connection without starting a socket", async () => {
  const { fetch, db, calls } = slackHandler();
  const res = await fetch(
    new Request("http://x/api/slack/connections", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "New", botToken: "xoxb-new", appToken: "xapp-new" }),
    }),
  );
  const body = (await res.json()) as { id: string; agentId: null; status: string };
  expect(res.status).toBe(201);
  expect(body).toMatchObject({ agentId: null, status: "disabled" });
  expect(getSlackConnection(db, body.id)?.agentId).toBeUndefined();
  expect(
    (
      await fetch(
        new Request(`http://x/api/slack/connections/${body.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: "Updated" }),
        }),
      )
    ).status,
  ).toBe(200);
  expect(calls).toEqual([]);
});

test("PUT with blank tokens keeps the stored tokens and restarts only a bound connection", async () => {
  const { fetch, db, vault, calls } = slackHandler();
  const res = await fetch(
    new Request("http://x/api/slack/connections/conn-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Renamed" }),
    }),
  );
  expect(res.status).toBe(200);
  const stored = getSlackConnection(db, "conn-1");
  expect(stored?.name).toBe("Renamed");
  expect(vault.decrypt(stored?.botToken ?? "")).toBe("xoxb-secret"); // unchanged
  expect(vault.decrypt(stored?.appToken ?? "")).toBe("xapp-secret"); // unchanged
  expect(calls).toEqual(["remove:conn-1", "add:conn-1"]);
});

test("bound edit leaves stored fields unchanged when stopping fails", async () => {
  const { fetch, db, vault, calls } = slackHandler(1);
  const before = getSlackConnection(db, "conn-1");
  const res = await fetch(
    new Request("http://x/api/slack/connections/conn-1", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Changed",
        botToken: "xoxb-changed",
        appToken: "xapp-changed",
      }),
    }),
  );

  expect(res.status).toBe(500);
  expect(getSlackConnection(db, "conn-1")).toEqual(before);
  expect(vault.decrypt(getSlackConnection(db, "conn-1")?.botToken ?? "")).toBe("xoxb-secret");
  expect(calls).toEqual(["remove:conn-1"]);
});

test("same-target binding preserves state and retries only a non-active connection", async () => {
  const { fetch, db, calls } = slackHandler();
  const put = () =>
    fetch(
      new Request("http://x/api/agents/coder/slack-connection", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId: "conn-1" }),
      }),
    );

  expect((await put()).status).toBe(200);
  expect(calls).toEqual([]);
  setSlackConnectionStatus(db, "conn-1", "error", "retry me");
  expect((await put()).status).toBe(200);
  expect(calls).toEqual(["add:conn-1"]);
  expect(getSlackConnection(db, "conn-1")).toMatchObject({
    status: "error",
    lastError: "retry me",
  });
  setSlackConnectionStatus(db, "conn-1", "disabled");
  expect((await put()).status).toBe(200);
  expect(calls).toEqual(["add:conn-1", "add:conn-1"]);
});

test("agent Slack endpoint swaps, unbinds, and rejects a connection bound elsewhere", async () => {
  const { fetch, db, vault, calls } = slackHandler();
  createAgent(db, {
    id: "other",
    name: "Other",
    harness: { id: "claude", config: { model: "claude-sonnet-4-5" } },
    systemPrompt: "x",
  });
  createSlackConnection(db, {
    id: "conn-2",
    name: "Second",
    botToken: vault.encrypt("xoxb-second"),
    appToken: vault.encrypt("xapp-second"),
    status: "disabled",
    createdAt: 2,
  });
  createSlackConnection(db, {
    id: "conn-3",
    name: "Other's",
    agentId: "other",
    botToken: vault.encrypt("xoxb-third"),
    appToken: vault.encrypt("xapp-third"),
    status: "active",
    createdAt: 3,
  });

  const put = (connectionId: string | null) =>
    fetch(
      new Request("http://x/api/agents/coder/slack-connection", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId }),
      }),
    );
  expect((await put("missing")).status).toBe(404);
  expect((await put("conn-3")).status).toBe(409);
  expect((await put("conn-2")).status).toBe(200);
  expect(getSlackConnection(db, "conn-1")).toMatchObject({
    agentId: undefined,
    status: "disabled",
  });
  expect(getSlackConnection(db, "conn-2")?.agentId).toBe("coder");
  expect(calls).toEqual(["remove:conn-1", "add:conn-2"]);

  expect(await (await put(null)).json()).toBeNull();
  expect(getSlackConnection(db, "conn-2")).toMatchObject({
    agentId: undefined,
    status: "disabled",
  });
  expect(calls).toContain("remove:conn-2");
  expect(
    (
      await fetch(
        new Request("http://x/api/agents/missing/slack-connection", {
          method: "PUT",
          body: JSON.stringify({ connectionId: null }),
        }),
      )
    ).status,
  ).toBe(404);
});

test("concurrent swaps serialize the full operation for one agent", async () => {
  let firstRemoveEntered!: () => void;
  let releaseFirstRemove!: () => void;
  const entered = new Promise<void>((resolve) => (firstRemoveEntered = resolve));
  const blocked = new Promise<void>((resolve) => (releaseFirstRemove = resolve));
  let removes = 0;
  const { fetch, db, vault, calls } = slackHandler(0, async () => {
    removes += 1;
    if (removes === 1) {
      firstRemoveEntered();
      await blocked;
    }
  });
  for (const id of ["conn-2", "conn-3"]) {
    createSlackConnection(db, {
      id,
      name: id,
      botToken: vault.encrypt(`xoxb-${id}`),
      appToken: vault.encrypt(`xapp-${id}`),
      status: "disabled",
      createdAt: Number(id.at(-1)),
    });
  }
  const put = (connectionId: string) =>
    fetch(
      new Request("http://x/api/agents/coder/slack-connection", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId }),
      }),
    );

  const first = put("conn-2");
  await entered;
  const second = put("conn-3");
  await Promise.resolve();
  expect(calls).toEqual(["remove:conn-1"]);
  releaseFirstRemove();
  expect((await first).status).toBe(200);
  expect((await second).status).toBe(200);
  expect(getSlackConnection(db, "conn-2")?.agentId).toBeUndefined();
  expect(getSlackConnection(db, "conn-3")?.agentId).toBe("coder");
  expect(calls).toEqual(["remove:conn-1", "add:conn-2", "remove:conn-2", "add:conn-3"]);
});

test("deleting an agent stops its bot and preserves the unbound connection", async () => {
  const { fetch, db, calls } = slackHandler();
  const res = await fetch(new Request("http://x/api/agents/coder", { method: "DELETE" }));
  expect(res.status).toBe(200);
  expect(calls).toContain("remove:conn-1");
  expect(getSlackConnection(db, "conn-1")).toMatchObject({
    agentId: undefined,
    status: "disabled",
  });
});

test("failed stops leave swap and unbind database state retryable", async () => {
  const { fetch, db, vault } = slackHandler(1);
  createSlackConnection(db, {
    id: "conn-2",
    name: "Second",
    botToken: vault.encrypt("xoxb-second"),
    appToken: vault.encrypt("xapp-second"),
    status: "disabled",
    createdAt: 2,
  });
  const put = (connectionId: string | null) =>
    fetch(
      new Request("http://x/api/agents/coder/slack-connection", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ connectionId }),
      }),
    );

  expect((await put("conn-2")).status).toBe(500);
  expect(getSlackConnection(db, "conn-1")?.agentId).toBe("coder");
  expect(getSlackConnection(db, "conn-2")?.agentId).toBeUndefined();
  expect((await put("conn-2")).status).toBe(200);

  const unbind = slackHandler(1);
  const failed = await unbind.fetch(
    new Request("http://x/api/agents/coder/slack-connection", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ connectionId: null }),
    }),
  );
  expect(failed.status).toBe(500);
  expect(getSlackConnection(unbind.db, "conn-1")?.agentId).toBe("coder");
  expect(
    (
      await unbind.fetch(
        new Request("http://x/api/agents/coder/slack-connection", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ connectionId: null }),
        }),
      )
    ).status,
  ).toBe(200);
});

test("failed stops leave agent and connection deletes retryable", async () => {
  const agentDelete = slackHandler(1);
  const request = () => new Request("http://x/api/agents/coder", { method: "DELETE" });
  expect((await agentDelete.fetch(request())).status).toBe(500);
  expect(getAgent(agentDelete.db, "coder")).toBeDefined();
  expect(getSlackConnection(agentDelete.db, "conn-1")?.agentId).toBe("coder");
  expect((await agentDelete.fetch(request())).status).toBe(200);

  const connectionDelete = slackHandler(1);
  const remove = () => new Request("http://x/api/slack/connections/conn-1", { method: "DELETE" });
  expect((await connectionDelete.fetch(remove())).status).toBe(500);
  expect(getSlackConnection(connectionDelete.db, "conn-1")).toBeDefined();
  expect((await connectionDelete.fetch(remove())).status).toBe(200);
});

test("DELETE stops the socket and removes the row", async () => {
  const { fetch, db, calls } = slackHandler();
  const res = await fetch(
    new Request("http://x/api/slack/connections/conn-1", { method: "DELETE" }),
  );
  expect(res.status).toBe(200);
  expect(getSlackConnection(db, "conn-1")).toBeUndefined();
  expect(calls).toContain("remove:conn-1");
});
