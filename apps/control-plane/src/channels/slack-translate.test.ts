import { expect, test } from "bun:test";
import { formatTranscript, mentionEventToInput, slackSourceKey } from "./slack-translate.ts";

const identity = { connectionId: "conn-1", workspaceId: "T1", agentId: "echo" };

test("mention: strips the bot mention and trims", () => {
  const out = mentionEventToInput(
    { channel: "C1", ts: "1.0", text: "<@U123> review this  " },
    identity,
  );
  expect(out.userMessage).toBe("review this");
});

test("mention: source key namespaces the connection, workspace, agent, and thread", () => {
  expect(
    mentionEventToInput({ channel: "C1", ts: "2.0", thread_ts: "1.0" }, identity).sourceKey,
  ).toBe("slack:conn-1:T1:echo:C1:1.0");
  expect(mentionEventToInput({ channel: "C1", ts: "2.0" }, identity).sourceKey).toBe(
    "slack:conn-1:T1:echo:C1:2.0",
  );
  expect(mentionEventToInput({ channel: "C1", ts: "2.0" }, identity).source).toBe("slack");
});

test("legacy source keys continue only for Slack sessions owned by the same agent", () => {
  const event = { channel: "C1", ts: "2.0", thread_ts: "1.0" };
  expect(slackSourceKey(event, identity, () => ({ source: "slack", agentId: "echo" }))).toBe(
    "C1:1.0",
  );
  expect(slackSourceKey(event, identity, () => ({ source: "slack", agentId: "other" }))).toBe(
    "slack:conn-1:T1:echo:C1:1.0",
  );
  expect(slackSourceKey(event, identity, () => ({ source: "web", agentId: "echo" }))).toBe(
    "slack:conn-1:T1:echo:C1:1.0",
  );
});

test("mention passes through a resolved user id", () => {
  expect(mentionEventToInput({ channel: "C1", ts: "1.0" }, identity, "u-42").userId).toBe("u-42");
});

test("missing text yields an empty message", () => {
  expect(mentionEventToInput({ channel: "C1", ts: "1.0" }, identity).userMessage).toBe("");
});

test("formatTranscript labels authors, skips empties and the excluded ts", () => {
  const out = formatTranscript(
    [
      { user: "U1", text: "deploy is failing", ts: "1.0" },
      { bot_id: "B1", text: "looking into it", ts: "2.0" },
      { user: "U1", text: "  ", ts: "3.0" },
      { user: "U2", text: "@flooagents help", ts: "4.0" },
    ],
    "4.0",
  );
  expect(out).toBe("<@U1>: deploy is failing\nassistant: looking into it");
});
