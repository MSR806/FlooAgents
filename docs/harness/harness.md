# Project Gilly - Harnesses

The harness drives one agent loop behind Gilly's stable `harness-protocol` HTTP contract. One
server hosts both implementations; Claude remains the default.

## Routing

`MODEL_CATALOG` in `packages/core` is the source of truth for the model picker and routing.
`RoutingRuntimeProvider` sets `InvocationRequest.harnessType` to `anthropic` or `openai`, then sends
both through the same `HARNESS_URL`. The shared server dispatches to the matching loop. Requests
that omit `harnessType` use the Claude loop.

Catalog variants may map display choices to Codex runtime settings. `gpt-5.4-fast` runs model `gpt-5.4` with Codex `service_tier = "fast"`.

Session ids are opaque above the runtime seam. The router namespaces them as `anthropic:<id>` or `openai:<id>`, strips the matching prefix before a resume, and starts fresh rather than passing an id to the wrong harness after a provider change. Existing unprefixed ids are treated as legacy Anthropic sessions.

## Claude Harness

`apps/harness/src/harness-claude` wraps the Claude Agent SDK. It maps Gilly's `Read`, `Write`, and
`Bash` abstractions to Claude SDK tool names, materializes skills under `.claude/skills`, and
exposes the tooling gateway through an in-process MCP server.

## OpenAI Harness

`apps/harness/src/harness-openai` wraps `@openai/codex-sdk`. For every invocation it:

1. Creates an isolated persistent workspace.
2. Stores `CODEX_HOME` under a separate persistent state root so the agent cannot edit its own session files.
3. Injects the agent role through Codex `developer_instructions`.
4. Materializes attached skills under `.agents/skills`.
5. Starts or resumes a Codex thread with its native sandbox and web search disabled.
6. Translates completed Codex items into Gilly `message`, `tool`, `done`, and `error` events.

The current Codex SDK emits item snapshots rather than token deltas, so this harness streams completed messages and tool events. It does not synthesize fake token events.

## Gateway Bridge

Gilly's gateway speaks `POST /catalog` and `POST /invoke`; it is not itself an MCP endpoint. The OpenAI harness configures a local stdio MCP bridge with `gateway_catalog` and `gateway_invoke`. Run-scoped credentials are forwarded by environment-variable name rather than serialized into Codex command-line config. MCP results use the gateway's model-visible direct lane and therefore retain its result-size cap.

## Tool Boundary

Codex permissions constrain filesystem and network effects but are not themselves a vendor tool allowlist. Gilly does not synthesize Codex filesystem tools for `Read` or `Write`; Codex receives its native OS-sandboxed shell only when `Bash` is configured. Gilly selects Codex's native `read-only` sandbox unless the agent has `Write` or `Bash`, when it selects `workspace-write`. Bash-enabled agents also receive command network access for remote Git operations. Provider-side web search remains disabled, and Gilly never grants `danger-full-access`.

The shell environment is allowlisted so model-generated commands do not receive OpenAI or gateway secrets.

## Persistence

Codex resume needs both the thread id and files under `CODEX_HOME`. Docker Compose therefore persists:

- `/data/workspaces` for both loops.
- `/data/codex` for OpenAI session state.

Losing the Codex state volume makes stored OpenAI session ids non-resumable.
