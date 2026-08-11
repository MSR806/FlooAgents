export type SlackConnection = {
  id: string;
  name: string;
  agentId?: string | null;
  teamId?: string;
  teamName?: string;
  status: "active" | "disabled" | "error";
  lastError?: string;
};

export function slackBotName(suffix: string): string {
  const slug = suffix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `flooagents-${slug}` : "";
}

export function slackStartupError(connection: SlackConnection | null): string | null {
  if (connection?.status !== "error") return null;
  return connection.lastError?.trim() || "Slack bot failed to start";
}

export function safeAgentReturnTo(value: string | null | undefined): string | null {
  const match = value?.match(/^\/agents\/([^/?#]+)$/);
  if (!match) return null;

  try {
    const segment = decodeURIComponent(match[1]);
    if (
      segment === "." ||
      segment === ".." ||
      segment.includes("/") ||
      segment.includes("\\") ||
      Array.from(segment).some((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127;
      })
    )
      return null;
  } catch {
    return null;
  }

  return match[0];
}
