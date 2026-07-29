import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join, relative, resolve, sep } from "node:path";
import { providerFor, resolveCodexModel } from "@gilly/core";
import type { InvocationRequest, InvocationResult, StreamEvent } from "@gilly/harness-protocol";
import {
  Codex,
  type CodexOptions,
  type ThreadEvent,
  type ThreadOptions,
  type TurnOptions,
} from "@openai/codex-sdk";

const repoRoot = resolve(import.meta.dir, "../../../..");
const gatewayBridgePath = resolve(import.meta.dir, "gateway-mcp.ts");
const workspaceBridgePath = resolve(import.meta.dir, "workspace-mcp.ts");

type ThreadLike = {
  readonly id: string | null;
  runStreamed(
    input: string,
    options?: TurnOptions,
  ): Promise<{ events: AsyncIterable<ThreadEvent> }>;
};

type CodexLike = {
  startThread(options?: ThreadOptions): ThreadLike;
  resumeThread(id: string, options?: ThreadOptions): ThreadLike;
};

export type CodexFactory = (options: CodexOptions) => CodexLike;

// No pre-flight apiKey check (mirrors the Claude harness): when OPENAI_API_KEY/CODEX_API_KEY is
// unset, the codex CLI falls back to its own logged-in session (~/.codex/auth.json) just like the
// Claude Agent SDK falls back to a logged-in `claude` session. Auth failures surface from the CLI
// itself via formatCodexError.
const defaultCodexFactory: CodexFactory = (options) => new Codex(options);

function invocationHandle(req: InvocationRequest): string {
  const handle = req.workspace?.handle ?? `direct-${req.agent.id}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(handle)) {
    throw new Error(`Unsafe workspace handle: ${handle}`);
  }
  return handle;
}

/** Stable workspace for one Gilly session. */
export function workspaceDir(
  req: InvocationRequest,
  root = resolve(repoRoot, process.env.WORKSPACES_DIR ?? "data/workspaces"),
): string {
  return join(root, invocationHandle(req));
}

/** Persistent Codex state, deliberately outside the agent-writable workspace. */
export function codexHomeDir(
  req: InvocationRequest,
  root = resolve(repoRoot, process.env.CODEX_STATE_DIR ?? "data/codex"),
): string {
  return join(root, invocationHandle(req));
}

/** Codex has a shell-centric toolset, so sandboxing limits effects rather than naming SDK tools. */
export function sandboxModeFor(tools: string[]): "read-only" | "workspace-write" {
  return tools.includes("Write") || tools.includes("Bash") ? "workspace-write" : "read-only";
}

/** Build headless thread options using Codex's native workspace sandbox. */
export function buildThreadOptions(req: InvocationRequest, cwd: string): ThreadOptions {
  const tools = req.agent.tools ?? [];
  return {
    model: resolveCodexModel(req.agent.model).model,
    workingDirectory: cwd,
    skipGitRepoCheck: true,
    approvalPolicy: "never",
    sandboxMode: sandboxModeFor(tools),
    networkAccessEnabled: tools.includes("Bash"),
    webSearchMode: "disabled",
  };
}

type CodexOptionsInput = {
  codexHome: string;
  bridgePath?: string;
  workspaceBridgePath?: string;
  executablePath?: string;
  workspaceDir?: string;
  env?: NodeJS.ProcessEnv;
};

/** Build per-invocation SDK options without writing secrets to config files. */
export function buildCodexOptions(req: InvocationRequest, input: CodexOptionsInput): CodexOptions {
  providerFor(req.agent.model);
  const sourceEnv = input.env ?? process.env;
  const env = Object.fromEntries(
    Object.entries(sourceEnv).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  env.CODEX_HOME = input.codexHome;

  const shellEnabled = req.agent.tools?.includes("Bash") ?? false;
  const config: NonNullable<CodexOptions["config"]> = {
    developer_instructions: req.agent.systemPrompt,
    features: {
      apps: false,
      memories: false,
      multi_agent: false,
      remote_plugin: false,
      shell_tool: shellEnabled,
    },
    shell_environment_policy: {
      include_only: ["HOME", "LANG", "LC_ALL", "PATH", "SHELL", "TMPDIR", "USER"],
    },
  };
  const { serviceTier } = resolveCodexModel(req.agent.model);
  if (serviceTier) config.service_tier = serviceTier;

  const tools = req.agent.tools ?? [];
  // Never combine the host-side filesystem bridge with model-driven shell processes: a shell could
  // otherwise race path validation by swapping a directory for a symlink. Bash can perform the
  // requested reads/writes itself inside Codex's OS-enforced workspace profile.
  const workspaceTools = tools.includes("Bash")
    ? []
    : [
        ...(tools.includes("Read") ? ["read_file", "glob", "grep"] : []),
        ...(tools.includes("Write") ? ["write_file", "edit_file"] : []),
      ];
  const mcpServers: Record<string, NonNullable<CodexOptions["config"]>> = {};
  if (workspaceTools.length) {
    if (!input.workspaceDir) throw new Error("workspaceDir is required for Read or Write tools");
    env.GILLY_WORKSPACE_DIR = input.workspaceDir;
    mcpServers.workspace = {
      command: input.executablePath ?? process.execPath,
      args: [input.workspaceBridgePath ?? workspaceBridgePath],
      env_vars: ["GILLY_WORKSPACE_DIR"],
      enabled_tools: workspaceTools,
      default_tools_approval_mode: "approve",
      required: true,
    };
  }

  if (req.gateway) {
    env.GILLY_GATEWAY_URL = req.gateway.url;
    env.GILLY_GATEWAY_TOKEN = req.gateway.token;
    mcpServers.gateway = {
      command: input.executablePath ?? process.execPath,
      args: [input.bridgePath ?? gatewayBridgePath],
      env_vars: ["GILLY_GATEWAY_URL", "GILLY_GATEWAY_TOKEN"],
      enabled_tools: ["gateway_catalog", "gateway_invoke"],
      default_tools_approval_mode: "approve",
      required: true,
    };
  }
  if (Object.keys(mcpServers).length) config.mcp_servers = mcpServers;

  const apiKey = sourceEnv.OPENAI_API_KEY ?? sourceEnv.CODEX_API_KEY;
  return { ...(apiKey ? { apiKey } : {}), env, config };
}

/** Materialize attached skills while preserving project-owned native Codex skills. */
export function materializeWorkspace(
  req: InvocationRequest,
  cwd: string,
  managedStateDir: string,
): void {
  ensureDirectory(cwd, "workspace");
  ensureDirectory(managedStateDir, "managed skill state");
  const skillsRoot = resolve(cwd, ".agents", "skills");
  const manifestPath = resolve(managedStateDir, "managed-skills.json");
  assertNoSymlinkChain(cwd, skillsRoot);
  assertNoSymlinkChain(managedStateDir, manifestPath);

  const incoming = req.skills ?? [];
  const incomingNames = new Set<string>();
  for (const skill of incoming) {
    if (incomingNames.has(skill.name)) throw new Error(`Duplicate skill: ${skill.name}`);
    incomingNames.add(skill.name);
    validateSkill(
      skill.name,
      skill.files.map(({ path }) => path),
      cwd,
    );
  }

  const previous = readManagedSkills(manifestPath);
  for (const name of previous) {
    const skillRoot = resolve(skillsRoot, name);
    assertNoSymlinkChain(cwd, skillRoot);
    rmSync(skillRoot, { recursive: true, force: true });
  }

  for (const skill of incoming) {
    const skillRoot = resolve(skillsRoot, skill.name);
    if (existsSync(skillRoot) && !previous.includes(skill.name)) {
      throw new Error(`Skill conflicts with an existing project skill: ${skill.name}`);
    }
    for (const file of skill.files) {
      const destination = resolve(skillRoot, file.path);
      assertNoSymlinkChain(cwd, dirname(destination));
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, file.contents);
    }
  }
  writeFileSync(manifestPath, `${JSON.stringify(incoming.map(({ name }) => name))}\n`);
}

/** Create persistent Codex state and seed local login auth without following symlinks. */
export function materializeCodexHome(
  codexHome: string,
  sourceEnv: NodeJS.ProcessEnv = process.env,
  authPath: string = loginAuthPath(),
): void {
  ensureDirectory(codexHome, "Codex home");
  const configPath = resolve(codexHome, "config.toml");
  assertNoSymlinkChain(codexHome, configPath);
  rmSync(configPath, { force: true });
  seedAuthFromLogin(codexHome, sourceEnv, authPath);
}

/** Where this machine's `codex login` session lives. Exported so tests can point elsewhere. */
export function loginAuthPath(root: string = homedir()): string {
  return resolve(root, ".codex", "auth.json");
}

/**
 * Local-dev fallback, mirroring the Claude harness: when no OPENAI_API_KEY/CODEX_API_KEY is
 * configured, forward this machine's `codex login` session into the isolated per-invocation Codex
 * home so the sandboxed subprocess can still authenticate. No-ops (as it will in a real deployment,
 * where ~/.codex/auth.json won't exist) once an explicit key is set.
 */
function seedAuthFromLogin(
  codexHome: string,
  sourceEnv: NodeJS.ProcessEnv,
  authPath: string,
): void {
  if (sourceEnv.OPENAI_API_KEY || sourceEnv.CODEX_API_KEY) return;
  if (!existsSync(authPath) || lstatSync(authPath).isSymbolicLink()) return;
  copyFileSync(authPath, resolve(codexHome, "auth.json"));
}

function ensureDirectory(path: string, label: string): void {
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new Error(`${label} must not be a symbolic link: ${path}`);
  }
  mkdirSync(path, { recursive: true });
}

function validateSkill(name: string, paths: string[], cwd: string): void {
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
    throw new Error(`Unsafe skill name: ${name}`);
  }
  const skillRoot = resolve(cwd, ".agents", "skills", name);
  for (const path of paths) {
    if (!safeRelativePath(path)) throw new Error(`Unsafe skill path: ${path}`);
    const destination = resolve(skillRoot, path);
    if (!destination.startsWith(`${skillRoot}${sep}`))
      throw new Error(`Unsafe skill path: ${path}`);
    assertNoSymlinkChain(cwd, destination);
  }
}

function readManagedSkills(manifestPath: string): string[] {
  if (!existsSync(manifestPath)) return [];
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as unknown;
  if (
    !Array.isArray(parsed) ||
    !parsed.every((name) => typeof name === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name))
  ) {
    throw new Error("Invalid Gilly managed-skills manifest");
  }
  return parsed;
}

function assertNoSymlinkChain(root: string, destination: string): void {
  const path = relative(root, destination);
  if (path.startsWith("..") || resolve(root, path) !== destination) {
    throw new Error(`Path escapes workspace: ${destination}`);
  }
  let current = root;
  for (const segment of path.split(sep).filter(Boolean)) {
    current = join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error(`Symbolic links are not allowed in managed paths: ${current}`);
    }
  }
}

function safeRelativePath(path: string): boolean {
  if (!path || path.startsWith("/") || path.includes("\\")) return false;
  return !path.split("/").some((segment) => !segment || segment === "." || segment === "..");
}

/** Collapse a documented Codex event stream to its resumable id and final assistant response. */
export async function reduceCodexEvents(
  events: AsyncIterable<ThreadEvent>,
  initialSessionId: string | null = null,
): Promise<{ harnessSessionId: string | null; finalText: string }> {
  let harnessSessionId = initialSessionId;
  let finalText = "";
  let completed = false;

  for await (const event of events) {
    if (event.type === "thread.started") harnessSessionId = event.thread_id;
    else if (event.type === "item.completed" && event.item.type === "agent_message") {
      finalText = event.item.text;
    } else if (event.type === "turn.completed") completed = true;
    else if (event.type === "turn.failed") throw new Error(event.error.message);
    else if (event.type === "error") throw new Error(event.message);
  }

  if (!completed) throw new Error("Codex stream ended before turn.completed");
  return { harnessSessionId, finalText };
}

function summarizeItem(event: Extract<ThreadEvent, { type: "item.completed" }>): string {
  const { item } = event;
  if (item.type === "command_execution") return concise(item.command);
  if (item.type === "file_change") {
    return concise(item.changes.map(({ kind, path }) => `${kind} ${path}`).join(", "));
  }
  if (item.type === "mcp_tool_call") return concise(salient(item.arguments));
  return "";
}

function salient(value: unknown): string {
  if (!value || typeof value !== "object") return "";
  const record = value as Record<string, unknown>;
  for (const key of ["command", "tool", "path", "file_path", "query", "name"]) {
    if (typeof record[key] === "string") return record[key];
  }
  return "";
}

function concise(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > 120 ? `${normalized.slice(0, 117)}...` : normalized;
}

/** Convert verbose CLI retry logs into a stable user-facing runtime error. */
export function formatCodexError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/401 Unauthorized|Missing bearer or basic authentication/i.test(message)) {
    return "OpenAI authentication failed. Set a valid OPENAI_API_KEY in apps/harness/.env and restart the harness.";
  }
  const firstLine = message
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line && line !== "Reading prompt from stdin...");
  return concise(firstLine ?? message);
}

function toolEvent(event: Extract<ThreadEvent, { type: "item.completed" }>): StreamEvent | null {
  if (event.item.type === "command_execution") {
    return { type: "tool", name: "Bash", summary: summarizeItem(event) };
  }
  if (event.item.type === "file_change") {
    return { type: "tool", name: "Write", summary: summarizeItem(event) };
  }
  if (event.item.type === "mcp_tool_call") {
    if (event.item.server === "workspace") {
      return {
        type: "tool",
        name:
          event.item.tool === "write_file" || event.item.tool === "edit_file" ? "Write" : "Read",
        summary: summarizeItem(event),
      };
    }
    return {
      type: "tool",
      name: `${event.item.server}.${event.item.tool}`,
      summary: summarizeItem(event),
    };
  }
  return null;
}

/** Run one Codex turn and translate its events to the stable Gilly protocol. */
export async function* streamAgentLoop(
  req: InvocationRequest,
  codexFactory: CodexFactory = defaultCodexFactory,
  externalSignal?: AbortSignal,
): AsyncIterable<StreamEvent> {
  const abort = new AbortController();
  const forwardAbort = () => abort.abort();
  if (externalSignal?.aborted) abort.abort();
  else externalSignal?.addEventListener("abort", forwardAbort, { once: true });
  let active = true;
  let terminalError: string | null = null;
  try {
    const cwd = workspaceDir(req);
    const codexHome = codexHomeDir(req);
    materializeCodexHome(codexHome);
    materializeWorkspace(req, cwd, codexHome);

    const codex = codexFactory(
      buildCodexOptions(req, {
        codexHome,
        workspaceDir: cwd,
      }),
    );
    const threadOptions = buildThreadOptions(req, cwd);
    const thread = req.resumeSessionId
      ? codex.resumeThread(req.resumeSessionId, threadOptions)
      : codex.startThread(threadOptions);
    const { events } = await thread.runStreamed(req.userMessage, { signal: abort.signal });

    let harnessSessionId = thread.id;
    let pendingMessage = "";
    let turnCompleted = false;
    const emittedTools = new Set<string>();
    for await (const event of events) {
      if (event.type === "thread.started") {
        harnessSessionId = event.thread_id;
      } else if (
        !turnCompleted &&
        !terminalError &&
        event.type === "item.completed" &&
        event.item.type === "agent_message"
      ) {
        if (pendingMessage.trim()) yield { type: "message", text: pendingMessage.trim() };
        pendingMessage = event.item.text;
      } else if (!turnCompleted && !terminalError && event.type === "item.completed") {
        const translated = toolEvent(event);
        if (translated && !emittedTools.has(event.item.id)) {
          if (pendingMessage.trim()) {
            yield { type: "message", text: pendingMessage.trim() };
            pendingMessage = "";
          }
          emittedTools.add(event.item.id);
          yield translated;
        }
      } else if (event.type === "turn.completed") {
        turnCompleted = true;
      } else if (event.type === "turn.failed") {
        terminalError = event.error.message;
      } else if (event.type === "error") {
        terminalError = event.message;
      }
    }
    active = false;
    if (terminalError) yield { type: "error", error: terminalError };
    else if (turnCompleted) yield { type: "done", finalText: pendingMessage, harnessSessionId };
    else yield { type: "error", error: "Codex stream ended without a terminal event" };
  } catch (error) {
    active = false;
    yield { type: "error", error: terminalError ?? formatCodexError(error) };
  } finally {
    externalSignal?.removeEventListener("abort", forwardAbort);
    if (active) abort.abort();
  }
}

/** Non-streaming protocol adapter built on the same event translation path. Never throws. */
export async function runAgentLoop(
  req: InvocationRequest,
  codexFactory: CodexFactory = defaultCodexFactory,
): Promise<InvocationResult> {
  try {
    for await (const event of streamAgentLoop(req, codexFactory)) {
      if (event.type === "done") {
        return {
          status: "completed",
          finalText: event.finalText,
          harnessSessionId: event.harnessSessionId,
          error: null,
        };
      }
      if (event.type === "error") {
        return { status: "error", finalText: "", harnessSessionId: null, error: event.error };
      }
    }
    return {
      status: "error",
      finalText: "",
      harnessSessionId: null,
      error: "Codex stream ended without a terminal event",
    };
  } catch (error) {
    return {
      status: "error",
      finalText: "",
      harnessSessionId: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
