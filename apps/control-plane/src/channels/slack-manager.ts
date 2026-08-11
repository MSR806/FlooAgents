import type { SlackConnection, Vault } from "@agent-platform/core";
import { type Db, listSlackConnections, setSlackConnectionStatus } from "@agent-platform/db";
import type { createEngine } from "../engine.ts";
import type { Channel } from "./channel.ts";
import { buildSlackApp } from "./slack.ts";

type SlackAppLifecycle = { start(): Promise<unknown>; stop(): Promise<unknown> };

/** A Channel that owns N Slack connections and can start/stop them live (no restart to reconfigure). */
export type SlackManager = Channel & {
  /** Start a newly-bound connection. */
  add(conn: SlackConnection): Promise<void>;
  /** Stop and forget a connection. */
  remove(id: string): Promise<void>;
  /** Restart a bound connection after its editable settings changed. */
  restart(conn: SlackConnection): Promise<void>;
};

/**
 * Manages the running Bolt apps, one per Slack connection. Tokens are decrypted only here, at start.
 * A connection that fails to start is recorded as `status: "error"` and skipped — one bad connection
 * never crashes boot or blocks the others.
 */
export function createSlackManager(deps: {
  engine: ReturnType<typeof createEngine>;
  db: Db;
  vault: Vault;
  buildApp?: (deps: Parameters<typeof buildSlackApp>[0]) => SlackAppLifecycle;
}): SlackManager {
  const running = new Map<string, SlackAppLifecycle>();
  const operations = new Map<string, Promise<void>>();

  function serialize(id: string, operation: () => Promise<void>): Promise<void> {
    const previous = operations.get(id) ?? Promise.resolve();
    const current = previous.then(operation, operation);
    operations.set(id, current);
    const cleanup = () => {
      if (operations.get(id) === current) operations.delete(id);
    };
    current.then(cleanup, cleanup);
    return current;
  }

  async function startOne(conn: SlackConnection, force = false): Promise<void> {
    if (running.has(conn.id)) await stopOne(conn.id);
    if (!conn.agentId || (!force && conn.status === "disabled")) return;
    try {
      const app = (deps.buildApp ?? buildSlackApp)({
        engine: deps.engine,
        db: deps.db,
        botToken: deps.vault.decrypt(conn.botToken),
        appToken: deps.vault.decrypt(conn.appToken),
        connectionId: conn.id,
        teamId: conn.teamId,
        agentId: conn.agentId,
      });
      await app.start();
      running.set(conn.id, app);
      setSlackConnectionStatus(deps.db, conn.id, "active");
      console.log(`[slack] connection "${conn.name}" (${conn.id}) started → agent ${conn.agentId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setSlackConnectionStatus(deps.db, conn.id, "error", msg);
      console.error(`[slack] connection "${conn.name}" (${conn.id}) failed to start:`, msg);
    }
  }

  async function stopOne(id: string): Promise<void> {
    const app = running.get(id);
    if (!app) return;
    await app.stop();
    if (running.get(id) === app) running.delete(id);
  }

  return {
    name: "slack",
    start: async () => {
      const conns = listSlackConnections(deps.db).filter(
        (conn) => conn.agentId && conn.status !== "disabled",
      );
      await Promise.all(conns.map((conn) => serialize(conn.id, () => startOne(conn))));
      console.log(`[slack] started ${running.size}/${conns.length} connection(s)`);
    },
    add: (conn) => serialize(conn.id, () => startOne(conn, true)),
    remove: (id) => serialize(id, () => stopOne(id)),
    restart: (conn) =>
      serialize(conn.id, async () => {
        await stopOne(conn.id);
        await startOne(conn, true);
      }),
  };
}
