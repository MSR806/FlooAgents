# Floo Agents — Slack Mention Channel

Floo Agents responds when a user `@mention`s a bound bot in a Slack channel. Each Slack thread maps to a Floo Agents session, so follow-ups resume the same harness session and messages arriving during a run are queued. Slack Assistant and Agent views are deferred.

Implemented in `apps/control-plane/src/channels/slack.ts`. See [`channel.md`](../control-plane/channel.md).

## Connection lifecycle

Slack credentials are independent connections:

1. Create a bot from **Connections → New connection** using the generated manifest.
2. Install it to a workspace and enter the Bot User OAuth Token (`xoxb-…`) and an App-Level Token (`xapp-…`) with `connections:write`.
3. The bot is saved as **Available** and does not open a listener yet.
4. Open an agent, select **Add to Slack**, and bind an available bot. The Socket Mode listener starts immediately.
5. Invite the bot to a Slack channel and `@mention` it.

Each bot and agent has at most one inbound binding. Disconnecting or deleting an agent stops the listener but preserves the connection for reuse. Tokens are vault-encrypted in `slack_connections`; `SlackManager` owns live Bolt apps.

## Message flow

1. Bolt receives `app_mention`.
2. `mentionEventToInput()` strips the mention and builds a source key namespaced by connection, workspace, agent, channel, and thread.
3. Existing legacy thread sessions continue only when they already belong to the same agent.
4. Thread replies are fetched best-effort and added as context.
5. `engine.handle()` runs or queues the request.
6. Slack reactions and an editable progress message show queued, working, completed, or failed state.
7. The final answer is posted as standard Markdown blocks in the thread.

Reaction and presentation failures never suppress the answer.

## Manifest

The generated manifest enables Socket Mode and subscribes only to `app_mention`. Bot scopes are limited to:

- `app_mentions:read`
- `chat:write`
- `reactions:write`
- `channels:history` and `groups:history` for thread context
- `users:read` for user identity

The app-level token requires `connections:write`.

## Deferred

- Slack Assistant and Agent messaging views
- Direct messages
- Per-room allowlists and room-to-agent routing
- Shared-app OAuth installation
