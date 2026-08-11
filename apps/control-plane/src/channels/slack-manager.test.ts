import { expect, test } from "bun:test";
import { makeVault, type SlackConnection } from "@agent-platform/core";
import { createAgent, createDb, createSlackConnection } from "@agent-platform/db";
import type { createEngine } from "../engine.ts";
import { createSlackManager } from "./slack-manager.ts";

function managerFixture(
  buildApp: NonNullable<Parameters<typeof createSlackManager>[0]["buildApp"]>,
) {
  const db = createDb(":memory:");
  const vault = makeVault("test-key");
  createAgent(db, {
    id: "coder",
    name: "Coder",
    harness: { id: "claude", config: { model: "claude-sonnet-4-5" } },
    systemPrompt: "x",
  });
  const connection: SlackConnection = {
    id: "conn-1",
    name: "Acme",
    agentId: "coder",
    botToken: vault.encrypt("xoxb-secret"),
    appToken: vault.encrypt("xapp-secret"),
    status: "active",
    createdAt: 1,
  };
  createSlackConnection(db, connection);
  return {
    connection,
    manager: createSlackManager({
      engine: {} as ReturnType<typeof createEngine>,
      db,
      vault,
      buildApp,
    }),
  };
}

test("Slack manager starts only bound, non-disabled connections", async () => {
  const db = createDb(":memory:");
  const vault = makeVault("test-key");
  createAgent(db, {
    id: "coder",
    name: "Coder",
    harness: { id: "claude", config: { model: "claude-sonnet-4-5" } },
    systemPrompt: "x",
  });
  createAgent(db, {
    id: "other",
    name: "Other",
    harness: { id: "claude", config: { model: "claude-sonnet-4-5" } },
    systemPrompt: "x",
  });
  const connection = (id: string, patch: Partial<SlackConnection> = {}): SlackConnection => ({
    id,
    name: id,
    botToken: vault.encrypt("xoxb-secret"),
    appToken: vault.encrypt("xapp-secret"),
    status: "disabled",
    createdAt: 1,
    ...patch,
  });
  createSlackConnection(db, connection("unbound"));
  const disabled = connection("disabled", { agentId: "coder" });
  createSlackConnection(db, disabled);
  const active = connection("active", { agentId: "other", status: "active" });
  createSlackConnection(db, active);

  const started: string[] = [];
  const manager = createSlackManager({
    engine: {} as ReturnType<typeof createEngine>,
    db,
    vault,
    buildApp: ({ connectionId }) => ({
      start: async () => void started.push(connectionId),
      stop: async () => {},
    }),
  });
  await manager.start();
  expect(started).toEqual(["active"]);
  await manager.add(disabled);
  expect(started).toEqual(["active", "disabled"]);
});

test("remove waits for an in-flight start and then stops that app", async () => {
  let startEntered!: () => void;
  let finishStart!: () => void;
  const entered = new Promise<void>((resolve) => (startEntered = resolve));
  const pending = new Promise<void>((resolve) => (finishStart = resolve));
  let stopped = false;
  const { connection, manager } = managerFixture(() => ({
    start: async () => {
      startEntered();
      await pending;
    },
    stop: async () => {
      stopped = true;
    },
  }));

  const adding = manager.add(connection);
  await entered;
  const removing = manager.remove(connection.id);
  await Promise.resolve();
  expect(stopped).toBe(false);
  finishStart();
  await adding;
  await removing;
  expect(stopped).toBe(true);
});

test("a failed stop keeps the app tracked so remove can retry", async () => {
  let stops = 0;
  const { connection, manager } = managerFixture(() => ({
    start: async () => {},
    stop: async () => {
      stops += 1;
      if (stops === 1) throw new Error("stop failed");
    },
  }));

  await manager.add(connection);
  await expect(manager.remove(connection.id)).rejects.toThrow("stop failed");
  await manager.remove(connection.id);
  expect(stops).toBe(2);
});
