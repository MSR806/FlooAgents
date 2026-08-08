# Security Policy

## Reporting a vulnerability

**Please do not open a public issue for a security problem.**

Report it through GitHub's private vulnerability reporting:
[Report a vulnerability](https://github.com/MSR806/project-gilly/security/advisories/new).
If that isn't available to you, email **sujith@pratilipi.com** instead.

Please include what the problem is, how to reproduce it, and what an attacker could
reach. We'll acknowledge within a few working days and keep you posted while we work
on a fix. Credit in the advisory unless you'd rather stay anonymous.

## Supported versions

Gilly is in active development with no stable release. Only `master` is supported —
fixes land there and are not backported.

## What this project handles

Gilly is designed to hold credentials, so a few areas deserve extra care when
reporting or reviewing:

- **The gateway vault** (`apps/gateway/src/vault.ts`) — provider credentials encrypted
  at rest with `GILLY_VAULT_KEY`. Credentials must never appear in tool output, run
  tokens, agent context, or the sandbox.
- **Run-scoped gateway tokens** — opaque, checked per call, expiring with their run.
  Anything that lets a token outlive its run or widen its scope is a vulnerability.
- **Access resolution** (`apps/gateway/src/access.ts`) — invocation requires the agent's exact tool
  allowlist ∩ user-grants intersection. A path that invokes a tool or returns provider data without
  both is a vulnerability.
- **Run-scoped catalog metadata** — `/catalog` intentionally exposes names, descriptions, and input
  schemas for tools in the agent's exact allowlist before user-grant checks. This lets the agent
  explain and request missing access; `/invoke` and all provider data remain grant-gated.
- **Composio** — only its project API key belongs in Gilly's vault/environment. Downstream provider
  tokens remain in Composio and must never reach the harness, model, run token, or sandbox.
- **The agent sandbox** — agent-authored scripts run in the runtime workspace. Escapes,
  or agents reaching tools and credentials outside their configured access, matter here.

## Running Gilly yourself

Gilly executes model-authored code and shell commands by design. Self-hosted
deployments should treat the runtime as untrusted: keep it network-isolated from
anything you wouldn't grant an agent, and scope provider credentials to the minimum
the connected tools need.

The Tools administration page uses HTTP Basic authentication and the control-plane setup routes
require the internal gateway admin token. Other management pages still assume a trusted internal
deployment. Do not expose the control-plane management port publicly.
