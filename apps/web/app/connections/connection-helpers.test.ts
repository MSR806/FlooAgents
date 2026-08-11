import { expect, test } from "bun:test";
import { safeAgentReturnTo, slackBotName, slackStartupError } from "./connection-helpers";

test("slackBotName requires a non-empty slug", () => {
  expect(slackBotName("Acme Support")).toBe("flooagents-acme-support");
  expect(slackBotName("---")).toBe("");
  expect(slackBotName("  ")).toBe("");
});

test("slackStartupError surfaces failed bot startup", () => {
  expect(
    slackStartupError({ id: "conn-1", name: "Bot", status: "error", lastError: "bad token" }),
  ).toBe("bad token");
  expect(slackStartupError({ id: "conn-1", name: "Bot", status: "active" })).toBeNull();
  expect(slackStartupError(null)).toBeNull();
});

test("safeAgentReturnTo accepts one agent path segment only", () => {
  expect(safeAgentReturnTo("/agents/helper")).toBe("/agents/helper");
  expect(safeAgentReturnTo("/agents/team%20helper")).toBe("/agents/team%20helper");
  expect(safeAgentReturnTo("//example.com/agents/helper")).toBeNull();
  expect(safeAgentReturnTo("/agents/helper/settings")).toBeNull();
  expect(safeAgentReturnTo("/agents/helper?tab=slack")).toBeNull();
  expect(safeAgentReturnTo("/agents/%2e%2e")).toBeNull();
  expect(safeAgentReturnTo("/agents/helper%2Fsettings")).toBeNull();
});
