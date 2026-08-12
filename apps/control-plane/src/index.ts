import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { makeVault } from "@floo/core";
import {
  createDb,
  failRunningRunsBySource,
  getAgent,
  setAdmin,
  upsertUserBySlackId,
} from "@floo/db";
import { LocalRuntimeProvider } from "@floo/runtime";
import type { Channel } from "./channels/channel.ts";
import { createSlackManager } from "./channels/slack-manager.ts";
import { createWebChannel } from "./channels/web.ts";
import { loadBuiltinAgents, pruneBuiltinAgents, syncAgents } from "./config.ts";
import { createEngine } from "./engine.ts";
import { LocalSkillStore } from "./stores/local-skill-store.ts";

// Defaults are anchored to the repo root (this file lives at apps/control-plane/src/),
// so dev works regardless of cwd. Env vars override (Docker sets absolute paths).
// Resolve against the repo root: relative env values (e.g. from .env) anchor here
// regardless of cwd; absolute values (Docker) pass through unchanged.
const repoRoot = resolve(import.meta.dir, "../../..");
const AGENTS_DIR = resolve(repoRoot, process.env.AGENTS_DIR ?? "config/agents");
const BUILTIN_AGENTS_DIR = resolve(
  repoRoot,
  process.env.BUILTIN_AGENTS_DIR ?? "config/builtin-agents",
);
const SKILLS_DIR = resolve(repoRoot, process.env.SKILLS_DIR ?? "config/skills");
const DATABASE_PATH = resolve(repoRoot, process.env.DATABASE_PATH ?? "data/platform.db");
const HARNESS_URL = process.env.HARNESS_URL ?? "http://localhost:8080";
const WEB_PORT = Number(process.env.WEB_PORT ?? 4000);
const TOOL_GATEWAY_URL = process.env.TOOL_GATEWAY_URL;
const INTERNAL_API_TOKEN = process.env.INTERNAL_API_TOKEN;
const GATEWAY_DISCOVERY_TIMEOUT_MS = Number(
  process.env.TOOL_GATEWAY_DISCOVERY_TIMEOUT_MS ?? 10_000,
);

const vaultKey = process.env.CREDENTIAL_VAULT_KEY;
if (!vaultKey)
  throw new Error("CREDENTIAL_VAULT_KEY is required (encrypts Slack connection tokens)");

mkdirSync(dirname(DATABASE_PATH), { recursive: true });
const db = createDb(DATABASE_PATH);
const abandoned = failRunningRunsBySource(
  db,
  "gateway",
  "Control plane restarted before the run completed.",
);
if (abandoned) console.warn(`[engine] failed ${abandoned} abandoned background run(s)`);
syncAgents(db, AGENTS_DIR); // every boot: upsert config/agents/*.json into the DB (files win)
// Built-ins ship with the product and stay out of the DB entirely, so they never appear in the
// agents directory and can only change through code. Prune rows left by older seeded installs.
const builtinAgents = loadBuiltinAgents(BUILTIN_AGENTS_DIR);
const prunedBuiltins = pruneBuiltinAgents(db, builtinAgents.keys());
if (prunedBuiltins) console.warn(`[config] removed ${prunedBuiltins} stale built-in agent row(s)`);
const skillStore = new LocalSkillStore(SKILLS_DIR);
const vault = makeVault(vaultKey);

// Web chat has no auth yet: every web request runs as one shared admin user, so it gets full
// access to the agent's gateway tool patterns. Replace with real identity when web auth lands.
const webUser = upsertUserBySlackId(db, { slackUserId: "web", name: "Web (shared)" });
setAdmin(db, webUser.id, true);

const runtime = new LocalRuntimeProvider(HARNESS_URL);
const engine = createEngine({
  db,
  runtime,
  getAgent: (id) => builtinAgents.get(id) ?? getAgent(db, id),
  getSkill: (name) => skillStore.get(name),
  gatewayUrl: TOOL_GATEWAY_URL,
  gatewayAdminToken: INTERNAL_API_TOKEN,
  gatewayDiscoveryTimeoutMs: GATEWAY_DISCOVERY_TIMEOUT_MS,
});

// The Slack manager owns all web-configured connections (started from the DB); it's also handed to
// the web channel so the management API can add/edit/remove connections without a restart.
const slack = createSlackManager({ engine, db, vault });

// Web is always on (the UI + management API); Slack starts whatever connections exist in the DB.
const channels: Channel[] = [
  createWebChannel({
    engine,
    db,
    skillStore,
    port: WEB_PORT,
    gatewayUrl: TOOL_GATEWAY_URL,
    adminToken: INTERNAL_API_TOKEN,
    vault,
    slackManager: slack,
    webUserId: webUser.id,
    builtinAgents,
  }),
  slack,
];

await Promise.all(channels.map((c) => c.start()));
console.log(
  `⚡️ Floo Agents control plane ready — channels: ${channels.map((c) => c.name).join(", ")}`,
);
