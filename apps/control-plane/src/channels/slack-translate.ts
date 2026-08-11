import type { MessageInput } from "../engine.ts";

/** Fields we read off a Slack app mention event. */
export type SlackMessageFields = {
  channel: string;
  ts: string;
  thread_ts?: string;
  text?: string;
  user?: string;
  team?: string;
  channel_type?: string;
};

export type SlackSourceIdentity = { connectionId: string; workspaceId: string; agentId: string };
type LegacySession = { source: string; agentId: string };

export function slackSourceKey(
  event: SlackMessageFields,
  identity: SlackSourceIdentity,
  getSession?: (sourceKey: string) => LegacySession | undefined,
): string {
  const legacy = `${event.channel}:${event.thread_ts ?? event.ts}`;
  const session = getSession?.(legacy);
  if (session?.source === "slack" && session.agentId === identity.agentId) return legacy;
  return [
    "slack",
    identity.connectionId,
    identity.workspaceId,
    identity.agentId,
    event.channel,
    event.thread_ts ?? event.ts,
  ]
    .map(encodeURIComponent)
    .join(":");
}

/** Pure translation of a channel `app_mention` event — strips the bot mention. */
export function mentionEventToInput(
  event: SlackMessageFields,
  identity: SlackSourceIdentity,
  userId?: string,
  getSession?: (sourceKey: string) => LegacySession | undefined,
): MessageInput {
  return {
    agentId: identity.agentId,
    source: "slack",
    sourceKey: slackSourceKey(event, identity, getSession),
    userMessage: (event.text ?? "").replace(/<@[^>]+>/g, "").trim(),
    userId,
  };
}

/** A prior message in a Slack thread (subset of conversations.replies output). */
export type ThreadMessage = { user?: string; bot_id?: string; text?: string; ts?: string };

/** Render prior thread messages as a simple transcript; skips empties and `excludeTs`. */
export function formatTranscript(messages: ThreadMessage[], excludeTs?: string): string {
  return messages
    .filter((m) => m.text?.trim() && m.ts !== excludeTs)
    .map((m) => {
      const who = m.bot_id ? "assistant" : `<@${m.user ?? "user"}>`;
      return `${who}: ${(m.text ?? "").trim()}`;
    })
    .join("\n");
}
