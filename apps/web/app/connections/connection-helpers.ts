export type SlackConnection = {
  id: string;
  name: string;
  agentId?: string | null;
  teamId?: string;
  teamName?: string;
  status: "active" | "disabled" | "error";
  lastError?: string;
};

const SLACK_BOT_PREFIX = "flooagents-";
const SLACK_BOT_NAME_MAX_LENGTH = 35;
const SLACK_BOT_SUFFIX_MAX_LENGTH = SLACK_BOT_NAME_MAX_LENGTH - SLACK_BOT_PREFIX.length;

export type SlackBotNameValidation = {
  name: string;
  error: string | null;
};

export function validateSlackBotName(suffix: string): SlackBotNameValidation {
  const normalizedSuffix = suffix
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!normalizedSuffix) return { name: "", error: null };
  if (normalizedSuffix.length > SLACK_BOT_SUFFIX_MAX_LENGTH) {
    return {
      name: "",
      error: `Use ${SLACK_BOT_SUFFIX_MAX_LENGTH} or fewer characters after “${SLACK_BOT_PREFIX}” (Slack's limit is ${SLACK_BOT_NAME_MAX_LENGTH}).`,
    };
  }

  return { name: `${SLACK_BOT_PREFIX}${normalizedSuffix}`, error: null };
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
