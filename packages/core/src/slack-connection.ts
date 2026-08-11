import { z } from "zod";

/**
 * A Slack workspace connection owns bot/app tokens and may be bound to one agent. `botToken` and
 * `appToken` are stored vault-encrypted at rest and never returned to the browser.
 */
export const SlackConnection = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** The agent every message on this connection runs against, when bound. */
  agentId: z.string().min(1).optional(),
  /** Bot User OAuth token (`xoxb-…`), encrypted at rest. */
  botToken: z.string().min(1),
  /** App-level token (`xapp-…`) for Socket Mode, encrypted at rest. */
  appToken: z.string().min(1),
  /** Workspace, captured from `auth.test` on save. */
  teamId: z.string().optional(),
  teamName: z.string().optional(),
  status: z.enum(["active", "disabled", "error"]),
  /** Last start/runtime failure, when `status === "error"`. */
  lastError: z.string().optional(),
  createdAt: z.number(),
});
export type SlackConnection = z.infer<typeof SlackConnection>;

/** User-supplied fields when creating a connection (tokens are plaintext here, encrypted before storage). */
export const SlackConnectionInput = z.object({
  name: z.string().min(1),
  botToken: z.string().min(1).startsWith("xoxb-", "Bot token should start with xoxb-"),
  appToken: z.string().min(1).startsWith("xapp-", "App token should start with xapp-"),
});
export type SlackConnectionInput = z.infer<typeof SlackConnectionInput>;
