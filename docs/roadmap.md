# Floo Agents — Roadmap

**Goal: a public open-source launch.** Order is driven by what a stranger needs to be
impressed and get running — not by what's most fun to build. Everything here is
optional to reorder; the phases exist so dependencies are visible.

The launch pitch is already written in the README: *the harness should be replaceable,
bring your own tools, trigger from where work starts.* The roadmap's job is to make
each of those three claims true and demonstrable before anyone reads it.

---

## Phase 0 — Brand foundation  ·  [#7](https://github.com/MSR806/flooagents/issues/7)

**Locked:** Floo Agents, [flooagents.com](https://flooagents.com), and the tagline
**Any agent. Any harness. Any channel.** The owl is the product mascot.

This phase covers the repository, package scope, product UI, Slack app, documentation, diagrams,
and deploy-time configuration. Internal capability names remain brand-neutral so the architecture
describes responsibilities instead of duplicating the product name.

**Done when:** the brand is consistent across every current-tree surface and no legacy identifiers
remain outside Git history or explicitly retained backups.

---

## Phase 1 — Make an agent do real work

This is the substance. Without it, launching is launching a diagram.

### 1. Composio in the Tool Gateway  ·  [#8](https://github.com/MSR806/flooagents/issues/8)
The gateway already wraps custom API and MCP implementations ([`gateway.md`](gateway/gateway.md),
`apps/gateway/src/connectors/`). Composio becomes another upstream provider behind the same catalog:
one integration, ~1000 apps, managed auth. It reduces the need to hand-write
`amplitude.ts` / `meta.ts` / `jira.ts` per provider without becoming agent-visible.

The provider-neutral catalog contract is owned by [`gateway.md`](gateway/gateway.md); shared
identity and credential ownership are defined in
[`connectors-and-auth.md`](gateway/connectors-and-auth.md).

**Done when:** an admin authenticates Gmail or Linear from the Tools UI, its concrete tools join
the unified catalog, an agent selects one exact tool without knowing its provider, and the call is
authorized and traced under its canonical tool name in `tool_calls`.

### 2. Git + gh CLI access for agents  ·  [#9](https://github.com/MSR806/flooagents/issues/9)
`config/skills/our-repos/SKILL.md` already tells agents to `git clone` — but nothing
injects credentials into the workspace, so private repos fail. The `coder` agent isn't
real until this works.

Scope: gateway-vaulted GitHub credential injected into the run's workspace as git
credential helper + `GH_TOKEN`, so `git` and `gh` work without the token reaching model
context. Distinct from the existing `github` MCP connector — that's for API calls, this
is for the sandbox doing actual code work.

**Done when:** the `coder` agent clones a private Pratilipi repo, branches, commits, and
opens a PR from a Slack message.

### 3. More default skills  ·  [#10](https://github.com/MSR806/flooagents/issues/10)
Bundled skills are the difference between "here's a framework" and "here's something
that works". Two clusters:
- **Agent tooling skill** — teach the direct-vs-script lane discipline for Composio-era
  tools (extend `config/skills/agent-tooling/`), plus git/gh workflow conventions.
- **Agent-builder skills** — the `agent-builder` agent should be able to write a good
  agent JSON, pick exact gateway tools, and scaffold a skill folder unaided.

**Done when:** a fresh install can build a working agent by talking to `agent-builder`,
with no hand-editing of JSON.

### Launch gate: [#6](https://github.com/MSR806/flooagents/issues/6)
Agents currently inherit the host developer's Claude tools and MCP connectors. That's a
correctness *and* trust bug — not shippable to strangers. Fix before anything public.

---

## Phase 2 — Prove the harness bet

### 4. Claude, Codex, and an open-model harness  ·  [#11](https://github.com/MSR806/flooagents/issues/11)
The README's central claim is harness-agnosticism, and today `apps/harness-claude` is
the only harness. Launching with one harness undercuts the whole pitch.

- Land [PR #5](https://github.com/MSR806/flooagents/pull/5) (OpenAI) — currently
  `changes_requested`.
- Add Codex.
- Add an open-model harness (pi, or whichever fits) so self-hosters aren't forced onto
  a paid API.

The constraint that matters more than the choice: each harness is its own container
speaking the AgentCore contract (`POST /invocations`, `GET /ping` on `:8080`) via
`packages/harness-protocol`. If a candidate can't be wrapped in that, it's the wrong
candidate. Gateway MCP wiring and skill materialization must work identically across
all of them, or "replaceable" is marketing.

This item must also land a **harness registry** — today there is exactly one harness,
wired by a single `HARNESS_URL` env var (`apps/control-plane/src/index.ts`). A second
harness turns that into a set: which harnesses exist, whether each is enabled, its
endpoint, its provider credentials, and which models it offers. Agent config gains a
`harness` field selecting from that set. The registry is what item 6 configures — build
it as data, not env vars, or the dashboard has nothing to edit.

Agent creation follows a **harness-first configuration** hierarchy
([#26](https://github.com/MSR806/flooagents/issues/26)): select and persist the harness,
then show the settings that harness owns. Model is the only setting initially and its real
harness model ID passes through unchanged. Future settings such as Codex service tier become
explicit harness options, not pseudo-model names or control-plane inference.

**Done when:** the same agent JSON runs on three harnesses by changing one field, and
the gateway works on all three; creating an agent selects its harness before its model.

---

## Phase 3 — The self-host story

A stranger's first ten minutes decide whether they come back.

### 5. CLI to deploy on EC2  ·  [#12](https://github.com/MSR806/flooagents/issues/12)
One command from clone to running stack. The Compose stack (`docker/compose.yaml`)
already exists — the CLI provisions an instance, ships env, brings the stack up, and
prints the URL. Reuse Compose; don't write a second orchestration path.

**Done when:** `<name> deploy` on a clean AWS account yields a reachable web UI and a
working Slack connection.

### 6. Setup / config dashboard for the operator  ·  [#13](https://github.com/MSR806/flooagents/issues/13)
Distinct from the existing per-resource pages under `apps/web/app/`. This is the
first-run surface for whoever installs Floo Agents, with a checklist that says what's still
unconfigured:

- **Harnesses** — enable and configure each installed harness (Claude Code, Codex, an
  open-model one, whatever ships later): endpoint, provider credentials, which models it
  exposes, default harness for new agents, and a reachability check per harness. Reads
  and writes the harness registry from item 4, so adding a future harness means it shows
  up here without new UI.
- Credentials and connectors (gateway vault, grants)
- Slack app / channel setup
- Users and grants
- Health of control plane, gateway, and each harness

**Done when:** a new operator gets from empty install to first working agent — including
picking and configuring a harness — without touching a `.env` file or reading a doc.

---

## Phase 4 — Launch surface

Do these together, after the product's shape stops moving. Building them earlier means
rebuilding them.

### 7. UI revamp  ·  [#14](https://github.com/MSR806/flooagents/issues/14)
`apps/web` works but was built feature-by-feature. Revamp against the vocabulary
already settled — Channels / Tools / Built-in tools — with a coherent information
architecture and chat as the centrepiece. Stack stays Tailwind v4 + shadcn (Base UI).

### 8. Open-source technical documentation  ·  [#15](https://github.com/MSR806/flooagents/issues/15)
The `docs/` tree is good design material but is written for us, not for a newcomer.
A launch needs a real docs site: install, concepts, build-your-first-agent, connect a
tool, write a skill, harness authoring, self-hosting, and an architecture reference.
Existing design docs become the reference layer; the missing layer is tutorials and
how-tos. Should be published from the repo so it can't drift.

### 9. Website  ·  [#16](https://github.com/MSR806/flooagents/issues/16)
Landing page: the pitch, one honest demo (Slack thread → agent → PR or report), the
harness-agnostic diagram, install command, link to docs and GitHub. Small; the docs
site does the heavy lifting.

### 10. Repo development skills  ·  [#19](https://github.com/MSR806/flooagents/issues/19)
`coding-conventions` and `test-conventions` already make an agent productive in this repo
on day one. Three gaps, same treatment — these are skills *for people working on Floo Agents*,
not skills shipped to the platform's agents (that's item 3):

- **ui-conventions** — `apps/web` patterns: Tailwind v4 + shadcn (Base UI) with the render
  prop rather than `asChild`, components vendored in `apps/web/components/ui`, server vs
  client boundaries, how a page reaches the control plane, and the settled vocabulary
  (Channels / Tools / Built-in tools). Write this *after* the revamp (item 7) or it
  documents a UI that's about to change.
- **local-deployment** — the dev loop: `bun install`, the four `dev:*` scripts and their
  ports, which `.env` each app reads, the Compose stack, SQLite location and reset,
  running a harness against a real Slack app. Stable today — **pull forward now.**
- **deployment** — the production path: images, the EC2 CLI (item 5), env and secrets,
  what the operator configures vs what ships in the image, upgrades. Follows item 5.

`.claude/skills/` is the single source of truth; `.agents/skills` is a symlink to it, so
a new skill is written once. (These were duplicated copies that had already drifted — the
`.agents` one carried a find/replaced `apps/harness-Codex/` path that never existed.)

---

## Phase 5 — Depth after launch

### 11. Cron triggers  ·  [#17](https://github.com/MSR806/flooagents/issues/17)
Design is already written ([`trigger.md`](control-plane/trigger.md)) — a cron is a
trigger with a schedule instead of an event filter, plus the optional "deliver to"
channel. Small and self-contained; **pull this forward any time as filler.**

### 12. Knowledge bases  ·  [#18](https://github.com/MSR806/flooagents/issues/18)
The one genuinely new concept on the list — needs a design doc before code. Decide
early whether a knowledge base is a first-class registry entry alongside agents and
skills, or just a skill that queries a store through the gateway. The lazy answer
(gateway-backed retrieval tool + a skill) may be enough; write the doc, then decide.

---

## Sequencing at a glance

```text
Phase 0  Brand foundation                        ← blocks all branding work
Phase 1  Composio · git/gh · default skills      ← + fix #6 (launch gate)
Phase 2  Codex + OpenAI + open-model harness
Phase 3  EC2 CLI · operator dashboard
Phase 4  UI revamp · tech docs · website · repo dev skills
Phase 5  Crons · knowledge bases
```

Parallel-safe from day one: harnesses (Phase 2), Composio (Phase 1), and crons touch
different seams and can run concurrently with different people. The name is the only
hard serial dependency.

Every item above is a GitHub issue labelled `roadmap` + `phase:N`. Filter with
`gh-axi issue list --label roadmap --label phase:1`.
