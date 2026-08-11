/**
 * The agent-builder is a *built-in* agent: its config ships in `config/builtin-agents/` and is never
 * written to the DB, so it never appears in the agents directory and can only change through code.
 * The home page chats with it directly — this id is the one place the web app names it.
 */
export const BUILDER_AGENT_ID = "agent-builder";

/**
 * Home is a launcher, not the conversation: it hands the first message to the existing chat view
 * rather than duplicating the streaming/history machinery. The chat page auto-sends `prompt` once.
 */
export function builderChatHref(prompt?: string): string {
  const trimmed = prompt?.trim();
  return trimmed
    ? `/chat/${BUILDER_AGENT_ID}?prompt=${encodeURIComponent(trimmed)}`
    : `/chat/${BUILDER_AGENT_ID}`;
}

/** Relative age for conversation rows — "just now", "4h ago", "3d ago". */
export function relativeTime(timestamp: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
