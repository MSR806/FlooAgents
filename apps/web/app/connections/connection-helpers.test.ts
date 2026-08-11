import { expect, test } from "bun:test";
import { safeAgentReturnTo, slackStartupError, validateSlackBotName } from "./connection-helpers";

test("validateSlackBotName requires a non-empty normalized suffix", () => {
  expect(validateSlackBotName("Acme Support")).toEqual({
    name: "flooagents-acme-support",
    error: null,
  });
  expect(validateSlackBotName("---")).toEqual({ name: "", error: null });
  expect(validateSlackBotName("  ")).toEqual({ name: "", error: null });
});

test("validateSlackBotName enforces Slack's 35-character display-name limit", () => {
  expect(validateSlackBotName("a".repeat(24))).toEqual({
    name: `flooagents-${"a".repeat(24)}`,
    error: null,
  });
  expect(validateSlackBotName("a".repeat(25))).toEqual({
    name: "",
    error: "Use 24 or fewer characters after “flooagents-” (Slack's limit is 35).",
  });
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
