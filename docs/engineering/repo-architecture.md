# Project Gilly — Repo & Code Architecture

**A Bun + TypeScript monorepo.** Deployable control-plane, harness, gateway, and web apps share packages that encode the layer boundaries. See [`mvp-scope.md`](../mvp-scope.md) and [`control-plane/control-plane.md`](../control-plane/control-plane.md).

---

## Layout

```text
project-gilly/
├── apps/
│   ├── control-plane/      # Gilly server: channels, session/run engine, management API
│   ├── harness/            # One AgentCore server with Claude and OpenAI loops
├── packages/
│   ├── core/               # domain model + Zod schemas: Agent, Connection, Session, Run, Workspace
│   ├── harness-protocol/   # the control-plane ⇄ harness contract (invocation request / result)
│   ├── runtime/            # RuntimeProvider interface + LocalRuntimeProvider (AgentCore provider = stub)
│   └── db/                 # Drizzle schema + SQLite client for operational state
├── config/agents/          # *.json agent definitions, loaded at boot
├── docker/                 # Dockerfile.control-plane, Dockerfile.harness, compose.yaml
└── docs/
```

**The two packages that are the architecture.** The replaceable boundaries from the design docs map to code:

- `runtime/` is the **control plane → runtime** seam — swap `LocalRuntimeProvider` for `AgentCoreRuntimeProvider` and nothing above changes.
- `harness-protocol/` is the **control plane → harness** seam — the payload any harness receives (agent config, user message, resume id, workspace ref) and returns (final text, harness session id, status).

`core/` is the shared domain model. `db/` holds only operational records (Sessions, Runs, follow-up queue) — never agent config, which lives in JSON.

A third seam lives inside the control plane: the **`Channel` interface** (`apps/control-plane/src/channels/channel.ts`) is the named inbound surface. Slack conforms to it today; Web/Telegram are future implementations, each translating its native event into the engine's input — interface + composition, no inheritance.

---

## Toolchain — Bun

One tool covers package management, workspaces, test, and TS execution.

| Concern | Choice |
| --- | --- |
| Package manager + workspaces | **Bun** (`bun install`, workspaces in root `package.json`) |
| Run / dev | **Bun** native TS — `bun run`, `bun --watch`; no build step in dev |
| Test | **`bun test`** (built-in, Jest-style) |
| Schemas / validation | **Zod** — single source of types across the boundaries |
| Control-plane HTTP | **Fastify** (health, future webhooks) |
| Slack | **`@slack/bolt`** in Socket Mode |
| Operational store | **SQLite + Drizzle** |
| Lint / format | **Biome** (single fast tool) |

**Harness runtime.** Both SDKs run under Bun in one container and spawn their vendor CLI
subprocesses behind the same HTTP contract.

---

## Docker

- **`Dockerfile.control-plane`** — Bun base. Runs the Slack listener + session engine. Mounts `config/agents` and the SQLite volume.
- **`Dockerfile.harness`** - unified harness on `:8080`, including a native Codex CLI resolution
  check.
- **`compose.yaml`** - wires one harness URL to `RoutingRuntimeProvider`, with persistent shared
  workspaces and separate Codex session state.

---

## Testing Strategy

- **Unit** — session/run state machine, thread→Session mapping, follow-up queueing, config loading.
- **Contract** — `harness-protocol` schemas round-trip; control plane tests use fake runtime providers; harness tests inject fake SDK streams.
- **End-to-end** (optional, flagged) — `compose up` then drive a real invocation through `LocalRuntimeProvider`.

---

## Request Flow

```text
Slack thread message
  → control plane: resolve agent (JSON) + Session (SQLite)
  → RuntimeProvider.invoke({ agentConfig, userMessage, resumeSessionId, workspaceRef })
  → RoutingRuntimeProvider adds modelType from the model catalog
  → LocalRuntimeProvider POSTs the shared harness /invocations
  → harness selects its Claude or OpenAI loop → { finalText, harnessSessionId, status }
  → control plane records Run, posts reply to the thread
```

---

## Key Decisions

| Decision | Why |
| --- | --- |
| **Bun** over pnpm+Vitest+tsx | One tool; fast; native TS; built-in test. Runs both harness SDKs directly. |
| **JSON agent config**, no API | MVP needs no authoring surface; agents are files loaded at boot. |
| **SQLite** for operational state | Sessions/Runs must survive restarts (to resume threads) without an extra container. Same Drizzle schema swaps to Postgres later. |
| **Slack Socket Mode** | No public URL/tunnel for local dev. |
| **AgentCore contract from day one** | Same harness image runs locally and (later) in AgentCore; runtime swap is a provider change, not a rewrite. |
| **`runtime/` + `harness-protocol/` as packages** | Makes the design's "replaceable layers" real, enforced boundaries. |
