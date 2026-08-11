# Floo Agents — Channel

**A Channel is an interactive, conversational surface where people talk to an agent.** Slack, WhatsApp, Telegram, and the platform's own Web chat are all channels. Unlike a trigger, a channel holds a continuing, stateful conversation. See [`control-plane.md`](control-plane.md) and [`connection.md`](connection.md).

*(We use "channel" for this concept; a Slack room like `#releases` is always called a "Slack channel" to keep the two apart.)*

**Web is the default channel** — it needs no setup and no connection, because there's no outside system to authenticate to. Create an agent and you can immediately chat with it in the Web UI, picking which agent to talk to.

**External channels build on a Connection.** For Slack, create a bot [Connection](connection.md), then attach an available bot to an agent from the agent page. The listener responds to `@mention`s anywhere that bot is present. Per-room allowlists are deferred.

What makes a channel different from a trigger is that it *owns the conversation*: it maps a thread to a [Session](session-lifecycle.md), resumes that Session on follow-ups, and queues messages that arrive while the agent is still running. A channel is inherently two-way — it both receives messages and speaks back — which is why a channel can also serve as a place results are delivered. The shared Session, Run, follow-up, and queueing rules live in [`session-lifecycle.md`](session-lifecycle.md).
