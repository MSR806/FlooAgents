# Project Gilly — Connection

**A Connection is a link to an external system, holding its identity and secrets.** It's the foundation the other surfaces build on — channels, triggers, and targets all reference a Connection when they need to reach an outside system. See [`control-plane.md`](control-plane.md).

You connect things once and reuse them. The platform can hold many connections at the same time: several different Slack bots, GitHub, Jira, Confluence, and more as needed. Each is a distinct connection with its own credentials and health.

A Connection does nothing on its own — it's just identity plus the secrets needed to authenticate. An available Slack bot starts listening only after an agent binds it; each bot and agent has at most one inbound Slack binding. Future outbound targets may reuse the same credentials independently.

Secrets attached to a connection are stored securely and never held on the agent itself.
