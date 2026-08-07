import { Database } from "bun:sqlite";
import { expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDb } from "./client.ts";
import { getAgent, getGatewayToken } from "./repo.ts";

test("migrates legacy connector schemas with empty exact tool policy", () => {
  const path = join(mkdtempSync(join(tmpdir(), "gilly-db-migration-")), "legacy.db");
  const legacy = new Database(path);
  legacy.exec(`
    CREATE TABLE agents (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, model TEXT NOT NULL,
      system_prompt TEXT NOT NULL, tools TEXT, skills TEXT, connectors TEXT,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE gateway_tokens (
      token TEXT PRIMARY KEY, run_id TEXT NOT NULL, user_id TEXT NOT NULL, agent_id TEXT NOT NULL,
      connectors TEXT NOT NULL, grants TEXT NOT NULL, expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );
    INSERT INTO agents VALUES ('legacy', 'Legacy', 'sonnet', 'Old', NULL, NULL, '["echo"]', 1);
    INSERT INTO gateway_tokens VALUES (
      'legacy-token', 'run', 'user', 'legacy', '["echo"]', '["echo.*"]', 9999999999999, 1
    );
  `);
  legacy.close();

  const db = createDb(path);
  expect(getAgent(db, "legacy")?.gatewayTools).toBeUndefined();
  expect(getGatewayToken(db, "legacy-token")?.tools).toEqual([]);
});
